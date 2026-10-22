import {
  ExtensionMessageResponse,
  ExtensionMessageType,
  GENERATION_PORT_NAME,
  GenerationStreamEvent
} from '../types/extension-types';
import {
  appendTextToEditor,
  editorTextMatches,
  finalizeEditorInput,
  replaceEditorText
} from './comment-injector';

/**
 * Sends a generation request over a port and reports the draft as the model writes it.
 * Resolves with the same response shape chrome.runtime.sendMessage would return.
 */
export function streamGeneration<T>(
  message: ExtensionMessageType,
  onDraft: (textSoFar: string) => void
): Promise<ExtensionMessageResponse<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response: ExtensionMessageResponse<T>) => {
      if (settled) return;
      settled = true;
      resolve(response);
    };

    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: GENERATION_PORT_NAME });
    } catch {
      finish({ success: false, error: 'Extension was reloaded. Refresh the page and retry.' });
      return;
    }

    port.onMessage.addListener((msg: GenerationStreamEvent) => {
      if (msg.event === 'draft') {
        onDraft(msg.text);
      } else if (msg.event === 'done') {
        finish(msg.response as ExtensionMessageResponse<T>);
      }
    });

    port.onDisconnect.addListener(() => {
      finish({ success: false, error: 'Connection to Okwu was lost. Please retry.' });
    });

    port.postMessage(message);
  });
}

/**
 * Writes a growing draft into a LinkedIn editor without flooding it: updates are
 * coalesced and applied at most every ~60ms, always with the latest text. When the new
 * text extends what is already written, only the new words are typed in.
 */
export function createEditorStreamWriter(editor: HTMLElement) {
  let latest = '';
  let written = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  const write = (text: string) => {
    const canAppend = written && text.startsWith(written) && editorTextMatches(editor, written);
    if (!(canAppend && appendTextToEditor(editor, text.slice(written.length)))) {
      replaceEditorText(editor, text);
    }
    written = text;
  };

  const writeLatest = () => {
    timer = null;
    writing = writing.then(() => {
      if (latest !== written) write(latest);
    });
  };

  return {
    /** Queue the latest draft text for display. */
    update(text: string) {
      latest = text;
      if (!timer) timer = setTimeout(writeLatest, 60);
    },
    /** Write the final text immediately and wait until it is in the editor. */
    async finish(text: string) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      latest = text;
      writeLatest();
      await writing;
      finalizeEditorInput(editor);
    },
    /** True if any streamed text was written into the editor. */
    get hasWritten() {
      return written.length > 0;
    },
    /** Remove a partial draft after a failure. */
    async clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await writing;
      if (written) {
        editor.innerHTML = '<p><br></p>';
        editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        written = '';
      }
    }
  };
}
