export interface InsertResult {
  success: boolean;
  message: string;
}

export async function insertNoteIntoLinkedIn(noteText: string): Promise<InsertResult> {
  const cleanNote = noteText.replace(/[\u2014\u2013]/g, '-').trim();

  // 1. Check if the note textarea is already visible on screen (piercing shadow roots)
  let textarea = findNoteTextarea();

  // 2. If not visible yet, check if LinkedIn's modal is open showing an "Add a note" button
  if (!textarea) {
    const addNoteBtn = findAddNoteButton();
    if (addNoteBtn) {
      addNoteBtn.click();
      textarea = await waitForTextarea(2500);
    }
  }

  // 3. If neither is visible, check if we need to click LinkedIn's profile "Connect" button
  if (!textarea) {
    // Only attempt profile Connect click if NO modal is currently open
    if (!isModalCurrentlyOpen()) {
      const connectBtn = await findOrRevealConnectButton();
      if (connectBtn) {
        connectBtn.click();
        await delay(500);

        const addNoteBtn = findAddNoteButton();
        if (addNoteBtn) {
          addNoteBtn.click();
          textarea = await waitForTextarea(2500);
        } else {
          textarea = await waitForTextarea(1500);
        }
      }
    }
  }

  // 4. Final check across all open shadow roots and document
  if (!textarea) {
    textarea = findNoteTextarea();
  }

  if (!textarea) {
    return {
      success: false,
      message: 'Could not detect LinkedIn note textarea. Please make sure the "Add a note" dialog is open on LinkedIn, then click Insert again.'
    };
  }

  // 5. Fill the textarea safely with React, Ember, and Shadow DOM support
  try {
    textarea.focus();

    // Strategy A: Native prototype setter (bypasses Ember/React property interception)
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(textarea, cleanNote);
    } else {
      textarea.value = cleanNote;
    }

    // Strategy B: Browser execCommand insertText (simulates genuine typing for Ember data bindings)
    try {
      textarea.select();
      document.execCommand('insertText', false, cleanNote);
    } catch {
      // execCommand optional
    }

    // Strategy C: Dispatch bubbling events with composed: true to cross shadow boundaries
    textarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true }));

    // Scroll into view gently
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return {
      success: true,
      message: 'Note inserted into LinkedIn! Review and click Send on LinkedIn when ready.'
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown insertion error';
    return {
      success: false,
      message: `Failed to fill textarea: ${msg}`
    };
  }
}

/**
 * Recursively pierces open shadow roots in the page (e.g. LinkedIn's artdeco-modal-outlet)
 */
function findDeepElement<T extends Element = Element>(
  predicate: (el: Element) => boolean,
  root: Document | Element | ShadowRoot = document
): T | null {
  // Do not search inside our extension's assistant UI container
  if (root instanceof Element && root.id === 'linkedin-note-assistant-host') {
    return null;
  }

  try {
    const all = root.querySelectorAll('*');
    for (const el of all) {
      if (el.id === 'linkedin-note-assistant-host') continue;

      if (predicate(el)) {
        return el as T;
      }

      // If this element has an open shadowRoot, search inside it
      if (el.shadowRoot) {
        const foundInShadow = findDeepElement<T>(predicate, el.shadowRoot);
        if (foundInShadow) return foundInShadow;
      }
    }
  } catch (err: unknown) {
    console.warn('Deep element search warning:', err);
  }

  return null;
}

export function findNoteTextarea(): HTMLTextAreaElement | null {
  // Fast path: the common light-DOM invite modal, before walking every element and shadow root
  const direct = document.querySelector<HTMLTextAreaElement>(
    'textarea#custom-message, textarea.connect-button-send-invite__custom-message, textarea[name="message"], .artdeco-modal textarea, div[role="dialog"] textarea, .send-invite textarea'
  );
  if (direct) return direct;

  return findDeepElement<HTMLTextAreaElement>((el) => {
    if (el.tagName.toLowerCase() !== 'textarea') return false;

    // Check specific LinkedIn id / class / name
    if (el.id === 'custom-message') return true;
    if (el.classList.contains('connect-button-send-invite__custom-message')) return true;
    if (el.getAttribute('name') === 'message') return true;

    // Check placeholder
    const placeholder = el.getAttribute('placeholder') || '';
    if (placeholder.toLowerCase().includes('we know each other')) return true;

    // Any textarea inside an artdeco modal or role="dialog"
    if (el.closest('.artdeco-modal, div[role="dialog"], .send-invite')) return true;

    // Any visible textarea on document (Shadow DOM elements are isolated from document.querySelectorAll)
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

export function findAddNoteButton(): HTMLButtonElement | null {
  return findDeepElement<HTMLButtonElement>((el) => {
    if (el.tagName.toLowerCase() !== 'button') return false;
    const text = (el.textContent || '').trim().toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
    return (
      text === 'add a note' ||
      text.includes('add a note') ||
      aria === 'add a note' ||
      aria.includes('add a note')
    );
  });
}

function isModalCurrentlyOpen(): boolean {
  const modal = findDeepElement((el) => {
    if (el.id === 'artdeco-modal-outlet') return true;
    if (el.getAttribute('data-test-modal-id') === 'send-invite-modal') return true;
    if (el.getAttribute('role') === 'dialog') return true;
    if (el.classList.contains('artdeco-modal') || el.classList.contains('send-invite')) return true;
    return false;
  });
  return Boolean(modal);
}

async function findOrRevealConnectButton(): Promise<HTMLButtonElement | null> {
  const actionButtons = Array.from(
    document.querySelectorAll(
      '.pv-top-card-v2-ctas button, .pvs-profile-actions button, main section button, .ph5 button'
    )
  );

  for (const el of actionButtons) {
    if (el instanceof HTMLButtonElement && isConnectButton(el)) {
      return el;
    }
  }

  // If hidden in More actions dropdown
  const moreButton = findMoreActionsButton();
  if (moreButton) {
    moreButton.click();
    await delay(350);

    const dropdownButtons = Array.from(
      document.querySelectorAll(
        '.artdeco-dropdown__content button, div[role="menu"] button, .artdeco-dropdown--is-dropdown-element button'
      )
    );

    for (const el of dropdownButtons) {
      if (el instanceof HTMLButtonElement && isConnectButton(el)) {
        return el;
      }
    }
  }

  return null;
}

function isConnectButton(btn: HTMLButtonElement): boolean {
  const text = (btn.textContent || '').trim().toLowerCase();
  const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();

  if (
    text.includes('pending') ||
    aria.includes('pending') ||
    text === 'message' ||
    text === 'follow' ||
    text === 'more'
  ) {
    return false;
  }

  return (
    text === 'connect' ||
    text.includes('connect') ||
    aria.startsWith('invite') ||
    aria.includes('to connect')
  );
}

function findMoreActionsButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll('main button, .ph5 button'));
  for (const btn of buttons) {
    if (btn instanceof HTMLButtonElement) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
      if (
        text === 'more' ||
        aria.includes('more actions') ||
        aria === 'more' ||
        btn.classList.contains('artdeco-dropdown__trigger')
      ) {
        return btn;
      }
    }
  }
  return null;
}

function waitForTextarea(maxWaitMs: number): Promise<HTMLTextAreaElement | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const el = findNoteTextarea();
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - start >= maxWaitMs) {
        resolve(null);
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
