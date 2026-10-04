function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Inserts comment text into LinkedIn's comment editor with support for Tiptap/ProseMirror, Quill, and contenteditable.
 */
export async function insertCommentIntoEditor(
  editor: HTMLElement,
  commentText: string
): Promise<boolean> {
  const cleanComment = commentText.replace(/[\u2014\u2013]/g, '-').trim();

  try {
    editor.focus();

    // 1. Select all existing contents in editor
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // 2. Strategy A: execCommand insertText (Native input simulation for ProseMirror / Tiptap)
    let insertedSuccessfully = false;
    try {
      insertedSuccessfully = document.execCommand('insertText', false, cleanComment);
    } catch {
      insertedSuccessfully = false;
    }

    // 3. Strategy B: If execCommand was not accepted or editor still empty, populate DOM directly
    const currentText = (editor.textContent || '').trim();
    if (!insertedSuccessfully || !currentText.includes(cleanComment.slice(0, 15))) {
      // Create paragraphs for multiline or single line comment
      const paragraphs = cleanComment
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');

      editor.innerHTML = paragraphs || `<p>${escapeHtml(cleanComment)}</p>`;

      // Remove empty placeholder markers
      editor.classList.remove('is-editor-empty');
      editor.querySelectorAll('.is-editor-empty, .is-empty').forEach((el) => {
        el.classList.remove('is-editor-empty', 'is-empty');
      });
    }

    // 4. Dispatch bubbling events across shadow and composition boundaries
    const beforeInputEvt = new InputEvent('beforeinput', {
      bubbles: true,
      composed: true,
      cancelable: true,
      inputType: 'insertText',
      data: cleanComment
    });
    editor.dispatchEvent(beforeInputEvt);

    editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
    editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true, composed: true }));

    // 5. Move cursor to end of text
    try {
      const newSelection = window.getSelection();
      const newRange = document.createRange();
      newRange.selectNodeContents(editor);
      newRange.collapse(false);
      newSelection?.removeAllRanges();
      newSelection?.addRange(newRange);
    } catch {
      // Cursor repositioning is optional
    }

    // 6. Wake up LinkedIn's comment submit button
    const commentBoxContainer = editor.closest('.ckymfu, .comments-comment-box, div[id*="asyncInlineCommentBoxSlot"]') || editor.parentElement;
    if (commentBoxContainer) {
      const submitBtn = commentBoxContainer.querySelector<HTMLButtonElement>(
        'button.comments-comment-box__submit-button, button[type="submit"], button[aria-label*="Post" i], button[aria-label*="Comment" i]'
      );
      if (submitBtn && submitBtn.disabled) {
        submitBtn.removeAttribute('disabled');
        submitBtn.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    return true;
  } catch (err: unknown) {
    console.error('Failed to insert comment into LinkedIn editor:', err);
    return false;
  }
}

/**
 * Searches for all active comment editors in a given root container.
 */
export function findCommentEditors(root: Document | HTMLElement = document): HTMLElement[] {
  const selectors = [
    'div[data-testid="ui-core-tiptap-text-editor-wrapper"] div[contenteditable="true"]',
    'div.tiptap.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="comment" i]',
    'div[contenteditable="true"][role="textbox"][aria-label*="comment" i]',
    'div.ql-editor[contenteditable="true"]',
    'div.comments-comment-box__editor div[contenteditable="true"]',
    'div.comments-comment-texteditor div[contenteditable="true"]'
  ];

  const found: HTMLElement[] = [];
  for (const selector of selectors) {
    const els = Array.from(root.querySelectorAll<HTMLElement>(selector));
    for (const el of els) {
      if (!found.includes(el)) {
        found.push(el);
      }
    }
  }

  return found;
}
