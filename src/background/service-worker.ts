import {
  ExtensionMessageType,
  ExtensionMessageResponse,
  GenerateDraftRequest,
  GenerateDraftResponse,
  GenerateCommentResponse,
  GenerateMessageResponse,
  GenerateCommentRequest,
  GenerateMessageRequest,
  GenerationStreamEvent,
  GENERATION_PORT_NAME,
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
import { generateDirectMessage } from '../services/message-service';
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

/**
 * Streaming channel: the content script connects, sends one GENERATE_COMMENT or
 * GENERATE_MESSAGE request, receives { event: 'draft' } updates while the model writes,
 * and a final { event: 'done' } with the same response shape as sendMessage.
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== GENERATION_PORT_NAME) return;

  let disconnected = false;
  port.onDisconnect.addListener(() => {
    disconnected = true;
  });

  const post = (msg: GenerationStreamEvent) => {
    if (disconnected) return;
    try {
      port.postMessage(msg);
    } catch {
      disconnected = true;
    }
  };

  port.onMessage.addListener((message: ExtensionMessageType) => {
    const onDraft = (text: string) => post({ event: 'draft', text });
    const run =
      message.type === 'GENERATE_COMMENT'
        ? runCommentGeneration(message.payload, onDraft)
        : message.type === 'GENERATE_MESSAGE'
          ? runMessageGeneration(message.payload, onDraft)
          : message.type === 'GENERATE_DRAFT'
            ? runDraftGeneration(message.payload, onDraft)
            : Promise.resolve<ExtensionMessageResponse<unknown>>({
                success: false,
                error: 'Unsupported streaming request.'
              });

    run
      .catch((err: unknown) => ({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown internal error'
      }))
      .then((response) => {
        post({ event: 'done', response });
        if (!disconnected) port.disconnect();
      });
  });
});

type GenerationContext =
  | { ok: false; response: ExtensionMessageResponse<unknown> }
  | {
      ok: true;
      settings: ExtensionSettings;
      planStatus: ReturnType<typeof getPlanStatus>;
      apiKey: string;
      model: string;
    };

/** Shared plan-limit and API-key checks for metered generations. */
async function prepareGeneration(): Promise<GenerationContext> {
  const settings = await getSettings();
  const planStatus = getPlanStatus(settings);

  if (!planStatus.canGenerate) {
    return {
      ok: false,
      response: {
        success: false,
        error: 'You have used your 3 free messages for this month. Upgrade to Pro ($5/month) or switch to BYOK in settings.',
        data: {
          success: false,
          error: 'Monthly limit reached (3/3 used this month).',
          monthlyLimitReached: true,
          messagesRemaining: 0
        }
      }
    };
  }

  const { apiKey, model } = resolveEffectiveApiKeyAndModel(
    settings.openaiApiKey,
    settings.openaiModel,
    settings.useCustomApiKey
  );

  if (!apiKey) {
    return {
      ok: false,
      response: {
        success: false,
        error: 'AI service is not configured. Please open Extension Settings to enable Cloud Plan or enter your OpenAI key.'
      }
    };
  }

  return { ok: true, settings, planStatus, apiKey, model };
}

/** Records usage after a successful generation and attaches plan info to the result. */
async function finalizeUsage<T extends { planUsed?: string; messagesRemaining?: number }>(
  ctx: Extract<GenerationContext, { ok: true }>,
  result: T
): Promise<ExtensionMessageResponse<T>> {
  const updatedSettings = recordMessageUsage(ctx.settings);
  await saveSettings(updatedSettings);

  const updatedStatus = getPlanStatus(updatedSettings);
  result.planUsed = ctx.planStatus.planLabel;
  result.messagesRemaining = updatedStatus.isFreeTrial ? updatedStatus.messagesRemaining : undefined;

  return { success: true, data: result };
}

async function runDraftGeneration(
  payload: GenerateDraftRequest,
  onDraft?: (text: string) => void
): Promise<ExtensionMessageResponse<unknown>> {
  const ctx = await prepareGeneration();
  if (!ctx.ok) return ctx.response;

  const effectiveJobTarget = {
    ...ctx.settings.jobTargetSettings,
    ...(payload.jobTargetOverride || {})
  };

  const draftResult: GenerateDraftResponse = await generateConnectionNote(
    ctx.apiKey,
    ctx.model,
    ctx.settings.userProfile,
    ctx.settings.stylePreferences,
    payload.targetProfile,
    payload.customPromptModifier,
    effectiveJobTarget,
    ctx.settings.baseFactSheet,
    onDraft
  );

  if (!draftResult.success) {
    return { success: false, error: draftResult.error || 'Failed to generate note.' };
  }
  return finalizeUsage(ctx, draftResult);
}

async function runCommentGeneration(
  payload: GenerateCommentRequest,
  onDraft?: (text: string) => void
): Promise<ExtensionMessageResponse<unknown>> {
  const ctx = await prepareGeneration();
  if (!ctx.ok) return ctx.response;

  const commentResult: GenerateCommentResponse = await generatePostComment(
    ctx.apiKey,
    ctx.model,
    ctx.settings.userProfile,
    ctx.settings.stylePreferences,
    payload.postContext,
    payload.customPromptModifier,
    ctx.settings.baseFactSheet,
    payload.commentAngle,
    payload.previousDrafts,
    onDraft
  );

  if (!commentResult.success) {
    return { success: false, error: commentResult.error || 'Failed to generate comment.' };
  }
  return finalizeUsage(ctx, commentResult);
}

async function runMessageGeneration(
  payload: GenerateMessageRequest,
  onDraft?: (text: string) => void
): Promise<ExtensionMessageResponse<unknown>> {
  const ctx = await prepareGeneration();
  if (!ctx.ok) return ctx.response;

  const messageResult: GenerateMessageResponse = await generateDirectMessage(
    ctx.apiKey,
    ctx.model,
    ctx.settings.userProfile,
    ctx.settings.stylePreferences,
    payload.conversation,
    payload.intent,
    payload.brief,
    ctx.settings.baseFactSheet,
    ctx.settings.jobTargetSettings,
    onDraft
  );

  if (!messageResult.success) {
    return { success: false, error: messageResult.error || 'Failed to generate message.' };
  }
  return finalizeUsage(ctx, messageResult);
}

async function handleMessage(
  message: ExtensionMessageType
): Promise<ExtensionMessageResponse<unknown>> {
  switch (message.type) {
    case 'GENERATE_DRAFT':
      return runDraftGeneration(message.payload);

    case 'GENERATE_COMMENT':
      return runCommentGeneration(message.payload);

    case 'GENERATE_MESSAGE':
      return runMessageGeneration(message.payload);

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
