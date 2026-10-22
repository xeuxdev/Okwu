function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Compares editor text ignoring whitespace, since paragraphs and <br>s don't survive textContent. */
function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, '');
}

export function editorTextMatches(editor: HTMLElement, text: string): boolean {
  return normalizeForCompare(editor.textContent || '') === normalizeForCompare(text);
}

/**
 * Puts a collapsed caret at the end of the editor's last text node, so inserted text joins the
 * last paragraph instead of creating a new block after it.
 */
function placeCaretAtEnd(editor: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;

  let node: Node = editor;
  while (node.lastChild) node = node.lastChild;

  const range = document.createRange();
  if (node.nodeType === Node.TEXT_NODE) {
    range.setStart(node, node.textContent?.length || 0);
  } else if (node.nodeName === 'BR' && node.parentNode) {
    range.setStartBefore(node);
  } else {
    range.selectNodeContents(node);
    range.collapse(false);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Appends text at the end of the editor as if typed. Used while streaming so each update only
 * inserts the new words instead of rewriting the whole editor.
 */
export function appendTextToEditor(editor: HTMLElement, suffix: string): boolean {
  if (!suffix) return true;
  try {
    // preventScroll stops the page from jumping back to the editor on every streamed chunk
    editor.focus({ preventScroll: true });
    placeCaretAtEnd(editor);
    return document.execCommand('insertText', false, suffix);
  } catch {
    return false;
  }
}

/**
 * Replaces the editor's contents with the given text. Supports Tiptap/ProseMirror, Quill, and contenteditable.
 */
export function replaceEditorText(editor: HTMLElement, text: string): boolean {
  const cleanText = text.trim();

  try {
    editor.focus({ preventScroll: true });

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Strategy A: execCommand insertText (native input simulation for ProseMirror / Tiptap)
    let insertedSuccessfully = false;
    try {
      insertedSuccessfully = document.execCommand('insertText', false, cleanText);
    } catch {
      insertedSuccessfully = false;
    }

    // Strategy B: if execCommand was not accepted, populate the DOM directly
    if (!insertedSuccessfully || !editorTextMatches(editor, cleanText)) {
      const paragraphs = cleanText
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');

      editor.innerHTML = paragraphs || `<p>${escapeHtml(cleanText)}</p>`;

      editor.classList.remove('is-editor-empty');
      editor.querySelectorAll('.is-editor-empty, .is-empty').forEach((el) => {
        el.classList.remove('is-editor-empty', 'is-empty');
      });
      editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    placeCaretAtEnd(editor);
    return true;
  } catch (err: unknown) {
    console.error('Failed to insert text into LinkedIn editor:', err);
    return false;
  }
}

/**
 * Tells LinkedIn the editor content changed and wakes its submit button. Run once after the
 * final text is in place, not on every streamed chunk.
 */
export function finalizeEditorInput(editor: HTMLElement): void {
  editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  editor.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  const commentBoxContainer =
    editor.closest('.ckymfu, .comments-comment-box, div[id*="asyncInlineCommentBoxSlot"]') || editor.parentElement;
  if (commentBoxContainer) {
    const submitBtn = commentBoxContainer.querySelector<HTMLButtonElement>(
      'button.comments-comment-box__submit-button, button[type="submit"], button[aria-label*="Post" i], button[aria-label*="Comment" i]'
    );
    if (submitBtn && submitBtn.disabled) {
      submitBtn.removeAttribute('disabled');
      submitBtn.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

/**
 * Inserts comment text into LinkedIn's comment editor, replacing what is there.
 */
export async function insertCommentIntoEditor(editor: HTMLElement, commentText: string): Promise<boolean> {
  const inserted = replaceEditorText(editor, commentText);
  if (inserted) finalizeEditorInput(editor);
  return inserted;
}

const COMMENT_EDITOR_SELECTOR = [
  'div[data-testid="ui-core-tiptap-text-editor-wrapper"] div[contenteditable="true"]',
  'div.tiptap.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"][aria-label*="comment" i]',
  'div.ql-editor[contenteditable="true"]',
  'div.comments-comment-box__editor div[contenteditable="true"]',
  'div.comments-comment-texteditor div[contenteditable="true"]'
].join(', ');

/**
 * Searches for all active comment editors in a given root container.
 */
export function findCommentEditors(root: Document | HTMLElement = document): HTMLElement[] {
  // One combined query returns each element once, in document order
  return Array.from(root.querySelectorAll<HTMLElement>(COMMENT_EDITOR_SELECTOR));
}
