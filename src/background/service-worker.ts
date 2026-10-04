import {
  ExtensionMessageType,
  ExtensionMessageResponse,
  GenerateDraftResponse,
  GenerateCommentResponse,
  ParseResumeResponse,
  TestConnectionResponse,
  ExtensionSettings
} from '../types/extension-types';
import { getSettings, saveSettings } from '../services/storage-service';
import {
  generateConnectionNote,
  parseResumeToBaseFactSheet,
  testOpenAiApiKey,
  resolveEffectiveApiKeyAndModel
} from '../services/openai-service';
import { generatePostComment } from '../services/comment-service';
import { syncLinkedInProfileFromBrowser } from '../services/linkedin-sync-service';
import {
  getPlanStatus,
  recordMessageUsage,
  activateProSubscription,
  switchToByok,
  switchToFreeTrial
} from '../services/plan-service';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on fresh install for onboarding
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessageResponse<unknown>) => void
  ) => {
    // Only handle messages structured for this extension
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return false;
    }

    const extMessage = message as ExtensionMessageType;

    // Handle async message processing
    handleMessage(extMessage)
      .then((res) => {
        try {
          sendResponse(res);
        } catch {
          // Channel might have closed
        }
      })
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : 'Unknown internal error';
        try {
          sendResponse({ success: false, error: errorMsg });
        } catch {
          // Channel might have closed
        }
      });

    // Return true to signal asynchronous response in Chrome extensions
    return true;
  }
);

async function handleMessage(
  message: ExtensionMessageType
): Promise<ExtensionMessageResponse<unknown>> {
  switch (message.type) {
    case 'GENERATE_DRAFT': {
      const settings = await getSettings();
      const planStatus = getPlanStatus(settings);

      if (!planStatus.canGenerate) {
        return {
          success: false,
          error: 'You have used your 3 free messages for this month. Upgrade to Pro ($5/month) or switch to BYOK in settings for unlimited notes.',
          data: {
            success: false,
            error: 'Monthly free trial limit reached (3/3 notes used this month).',
            monthlyLimitReached: true,
            messagesRemaining: 0
          } as GenerateDraftResponse
        };
      }

      const { apiKey, model } = resolveEffectiveApiKeyAndModel(
        settings.openaiApiKey,
        settings.openaiModel,
        settings.useCustomApiKey
      );

      if (!apiKey) {
        return {
          success: false,
          error: 'AI service is not configured. Please open Extension Settings to enable Cloud Plan or enter your OpenAI key.'
        };
      }

      const effectiveJobTarget = {
        ...settings.jobTargetSettings,
        ...(message.payload.jobTargetOverride || {})
      };

      const draftResult: GenerateDraftResponse = await generateConnectionNote(
        apiKey,
        model,
        settings.userProfile,
        settings.stylePreferences,
        message.payload.targetProfile,
        message.payload.customPromptModifier,
        effectiveJobTarget,
        settings.baseFactSheet
      );

      if (!draftResult.success) {
        return {
          success: false,
          error: draftResult.error || 'Failed to generate note.'
        };
      }

      // Record message usage and save settings
      const updatedSettings = recordMessageUsage(settings);
      await saveSettings(updatedSettings);

      const updatedStatus = getPlanStatus(updatedSettings);
      draftResult.planUsed = planStatus.planLabel;
      draftResult.messagesRemaining = updatedStatus.isFreeTrial ? updatedStatus.messagesRemaining : undefined;

      return {
        success: true,
        data: draftResult
      };
    }

    case 'GENERATE_COMMENT': {
      const settings = await getSettings();
      const planStatus = getPlanStatus(settings);

      if (!planStatus.canGenerate) {
        return {
          success: false,
          error: 'You have used your 3 free messages for this month. Upgrade to Pro ($5/month) or switch to BYOK in settings.',
          data: {
            success: false,
            error: 'Monthly limit reached (3/3 used this month).',
            monthlyLimitReached: true,
            messagesRemaining: 0
          } as GenerateCommentResponse
        };
      }

      const { apiKey, model } = resolveEffectiveApiKeyAndModel(
        settings.openaiApiKey,
        settings.openaiModel,
        settings.useCustomApiKey
      );

      if (!apiKey) {
        return {
          success: false,
          error: 'AI service is not configured. Please open Extension Settings to enable Cloud Plan or enter your OpenAI key.'
        };
      }

      const commentResult: GenerateCommentResponse = await generatePostComment(
        apiKey,
        model,
        settings.userProfile,
        settings.stylePreferences,
        message.payload.postContext,
        message.payload.customPromptModifier,
        settings.baseFactSheet,
        message.payload.commentAngle
      );

      if (!commentResult.success) {
        return {
          success: false,
          error: commentResult.error || 'Failed to generate comment.'
        };
      }

      // Record usage and persist settings
      const updatedSettings = recordMessageUsage(settings);
      await saveSettings(updatedSettings);

      const updatedStatus = getPlanStatus(updatedSettings);
      commentResult.planUsed = planStatus.planLabel;
      commentResult.messagesRemaining = updatedStatus.isFreeTrial ? updatedStatus.messagesRemaining : undefined;

      return {
        success: true,
        data: commentResult
      };
    }

    case 'PARSE_RESUME_TO_FACT_SHEET': {
      const settings = await getSettings();
      const { apiKey, model } = resolveEffectiveApiKeyAndModel(
        settings.openaiApiKey,
        settings.openaiModel,
        settings.useCustomApiKey
      );

      if (!apiKey) {
        return {
          success: false,
          error: 'AI service is not configured. Please open Extension Settings to enable Cloud Plan or enter your OpenAI key.'
        };
      }

      const linkedInOverride = message.payload.linkedInProfile || settings.linkedInSelfProfile;

      const parseResult: ParseResumeResponse = await parseResumeToBaseFactSheet(
        message.payload.rawText,
        apiKey,
        model,
        linkedInOverride
      );

      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse resume into Base Fact Sheet.'
        };
      }

      // Automatically persist parsed baseFactSheet and updated userProfile
      if (parseResult.baseFactSheet) {
        settings.baseFactSheet = parseResult.baseFactSheet;
      }
      if (parseResult.profile) {
        settings.userProfile = parseResult.profile;
      }
      await saveSettings(settings);

      return {
        success: true,
        data: {
          profile: parseResult.profile,
          baseFactSheet: parseResult.baseFactSheet
        }
      };
    }

    case 'SYNC_MY_LINKEDIN_PROFILE': {
      const syncResult = await syncLinkedInProfileFromBrowser();
      if (!syncResult.success || !syncResult.profile) {
        return {
          success: false,
          error: syncResult.error || 'Failed to sync LinkedIn profile.'
        };
      }

      const settings = await getSettings();
      settings.linkedInSelfProfile = syncResult.profile;

      // Update basic profile details if not set or user wants synced info
      if (syncResult.profile.fullName) {
        settings.userProfile.fullName = syncResult.profile.fullName;
      }
      if (syncResult.profile.currentRole) {
        settings.userProfile.currentRole = syncResult.profile.currentRole;
      }
      if (settings.baseFactSheet) {
        settings.baseFactSheet.identity.fullName = syncResult.profile.fullName || settings.baseFactSheet.identity.fullName;
        settings.baseFactSheet.identity.headline = syncResult.profile.headline || settings.baseFactSheet.identity.headline;
        settings.baseFactSheet.identity.currentRole = syncResult.profile.currentRole || settings.baseFactSheet.identity.currentRole;
        settings.baseFactSheet.identity.location = syncResult.profile.location || settings.baseFactSheet.identity.location;
        settings.baseFactSheet.linkedInSyncedAt = new Date().toISOString();
      }

      await saveSettings(settings);

      return {
        success: true,
        data: syncResult.profile
      };
    }

    case 'TEST_OPENAI_KEY': {
      const testResult: TestConnectionResponse = await testOpenAiApiKey(
        message.payload.apiKey,
        message.payload.model
      );

      return {
        success: testResult.success,
        data: testResult,
        error: testResult.error
      };
    }

    case 'GET_SETTINGS': {
      const settings: ExtensionSettings = await getSettings();
      return {
        success: true,
        data: settings
      };
    }

    case 'SAVE_SETTINGS': {
      await saveSettings(message.payload);
      return {
        success: true
      };
    }

    case 'OPEN_OPTIONS_PAGE': {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
      return {
        success: true
      };
    }

    case 'SET_PLAN_TIER': {
      let settings = await getSettings();
      if (message.payload.activatePro || message.payload.tier === 'pro_subscription') {
        settings = activateProSubscription(settings);
      } else if (message.payload.tier === 'byok') {
        settings = switchToByok(settings);
      } else {
        settings = switchToFreeTrial(settings);
      }
      await saveSettings(settings);
      return {
        success: true,
        data: settings
      };
    }

    default: {
      return {
        success: false,
        error: 'Unsupported message type.'
      };
    }
  }
}
