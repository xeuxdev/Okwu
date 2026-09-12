import {
  ExtensionMessageType,
  ExtensionMessageResponse,
  GenerateDraftResponse,
  ParseResumeResponse,
  TestConnectionResponse,
  ExtensionSettings
} from '../types/extension-types';
import { getSettings, saveSettings } from '../services/storage-service';
import {
  generateConnectionNote,
  parseResumeWithOpenAi,
  testOpenAiApiKey
} from '../services/openai-service';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on fresh install for onboarding
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessageType,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessageResponse<unknown>) => void
  ) => {
    // Handle async message processing
    handleMessage(message)
      .then((res) => {
        sendResponse(res);
      })
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : 'Unknown internal error';
        sendResponse({ success: false, error: errorMsg });
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
      if (!settings.openaiApiKey) {
        return {
          success: false,
          error: 'OpenAI API key is missing. Please configure it in extension settings.'
        };
      }

      const effectiveJobTarget = {
        ...settings.jobTargetSettings,
        ...(message.payload.jobTargetOverride || {})
      };

      const draftResult: GenerateDraftResponse = await generateConnectionNote(
        settings.openaiApiKey,
        settings.openaiModel,
        settings.userProfile,
        settings.stylePreferences,
        message.payload.targetProfile,
        message.payload.customPromptModifier,
        effectiveJobTarget
      );

      if (!draftResult.success) {
        return {
          success: false,
          error: draftResult.error || 'Failed to generate note.'
        };
      }

      return {
        success: true,
        data: draftResult
      };
    }

    case 'PARSE_RESUME_TEXT': {
      const settings = await getSettings();
      if (!settings.openaiApiKey) {
        return {
          success: false,
          error: 'OpenAI API key is required to parse the resume into structured profile data.'
        };
      }

      const parseResult: ParseResumeResponse = await parseResumeWithOpenAi(
        message.payload.rawText,
        settings.openaiApiKey,
        settings.openaiModel
      );

      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse resume.'
        };
      }

      return {
        success: true,
        data: parseResult.profile
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

    default: {
      return {
        success: false,
        error: 'Unsupported message type.'
      };
    }
  }
}
