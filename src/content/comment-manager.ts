import {
  ExtensionMessageResponse,
  ExtensionSettings,
  GenerateCommentResponse,
  CommentAnglePreference
} from '../types/extension-types';
import {
  findPostContainer,
  extractPostContext,
  expandPostText,
  isCommentEditorEmpty
} from './comment-extractor';
import {
  insertCommentIntoEditor,
  findCommentEditors
} from './comment-injector';

let commentToastHost: HTMLDivElement | null = null;
let isCurrentlyGeneratingComment = false;

function removeCommentToast(): void {
  if (commentToastHost) {
    commentToastHost.remove();
    commentToastHost = null;
  }
}

/**
 * Renders the floating notification toast for comment generation with spinner or completion state.
 */
export function showCommentToast(
  message: string,
  isDone: boolean = false,
  onAdjust?: () => void,
  actionLabel: string = 'New Angle'
): void {
  removeCommentToast();

  const toast = document.createElement('div');
  toast.id = 'linkedin-ai-comment-toast';
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999999;
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: #0f172a;
    color: #ffffff;
    padding: 10px 18px;
    border-radius: 9999px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
    font-size: 13px;
    font-weight: 500;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid #334155;
  `;

  const iconSvg = isDone
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: linkedinSpin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

  const actionButtons = isDone && onAdjust
    ? `<button id="linkedin-ai-comment-adjust-btn" style="background-color: #2563eb; color: #ffffff; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; margin-left: 4px;">${actionLabel}</button>`
    : '';

  toast.innerHTML = `
    <style>@keyframes linkedinSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
    <div style="display:flex; align-items:center; gap:8px;">
      ${iconSvg}
      <span>${message}</span>
    </div>
    ${actionButtons}
    <button id="linkedin-ai-comment-close-btn" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:0 4px; font-size:16px; line-height:1; display:flex; align-items:center;" aria-label="Dismiss notification">&times;</button>
  `;

  document.body.appendChild(toast);
  commentToastHost = toast;

  toast.querySelector('#linkedin-ai-comment-close-btn')?.addEventListener('click', () => {
    removeCommentToast();
  });

  if (isDone && onAdjust) {
    toast.querySelector('#linkedin-ai-comment-adjust-btn')?.addEventListener('click', () => {
      onAdjust();
    });
  }

  if (isDone) {
    setTimeout(() => {
      removeCommentToast();
    }, 6000);
  }
}

/**
 * Triggers generation of an unconventional comment for a specific editor and post.
 */
export async function triggerCommentGeneration(
  editor: HTMLElement,
  angleOverride?: CommentAnglePreference
): Promise<void> {
  if (isCurrentlyGeneratingComment) return;

  // Lock immediately: expanding the post below is async and auto-fill polls in the meantime
  isCurrentlyGeneratingComment = true;
  editor.setAttribute('data-ai-comment-handled', 'pending');
  updateToolbarButtonState(editor, true);
  showCommentToast('Okwu: Reading the full post...');

  let postContainer = findPostContainer(editor);
  let postContext = postContainer ? extractPostContext(postContainer) : null;

  // Spatial fallback: search for nearest post commentary above this editor in the viewport
  if (!postContext?.postText || postContext.postText.length < 15) {
    const allTextBoxes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="expandable-text-box"], [data-sdui-anchor-id*="commentary"], .feed-shared-update-v2__description, .update-components-text'
      )
    );

    const editorRect = editor.getBoundingClientRect();
    let closestAbove: HTMLElement | null = null;
    let closestDist = Infinity;

    for (const box of allTextBoxes) {
      if (
        box.closest('[id^="replaceableComment_"], [data-testid*="commentList"], .comments-comment-item') ||
        editor.contains(box)
      ) {
        continue;
      }
      const boxRect = box.getBoundingClientRect();
      const dist = editorRect.top - boxRect.bottom;
      // Accept elements that appear above the comment box
      if (dist >= -50 && dist < closestDist) {
        closestDist = dist;
        closestAbove = box;
      }
    }

    if (closestAbove) {
      const parentCard =
        closestAbove.closest<HTMLElement>(
          'div[role="listitem"], [componentkey^="expanded"], [id^="expanded"], .feed-shared-update-v2, article'
        ) || closestAbove.parentElement;

      if (parentCard) {
        postContainer = parentCard;
        postContext = extractPostContext(parentCard);
      }
    }
  }

  // Expand "...more" so the model reads the whole post, then re-read it
  if (postContainer) {
    try {
      await expandPostText(postContainer);
      const fullContext = extractPostContext(postContainer);
      if (fullContext.postText.length >= (postContext?.postText.length || 0)) {
        postContext = fullContext;
      }
    } catch {
      // Keep the context we already have
    }
  }

  if (!postContext?.postText || postContext.postText.length < 15) {
    isCurrentlyGeneratingComment = false;
    updateToolbarButtonState(editor, false);
    editor.setAttribute('data-ai-comment-handled', 'no_post');
    showCommentToast('Could not detect post text. Click AI Comment to retry.', true);
    return;
  }

  // Show the user: spinner and "Drafting authentic comment with Okwu..."
  showCommentToast('Okwu: Drafting authentic comment...');

  // First draft lets the model pick the move that fits the post; 'New Angle' cycles through explicit moves
  const angles: CommentAnglePreference[] = [
    'auto',
    'congrats',
    'clarifying_question',
    'banter',
    'well_wishes',
    'peer_take'
  ];

  const chosenAngle = angleOverride || 'auto';

  chrome.runtime.sendMessage(
    {
      type: 'GENERATE_COMMENT',
      payload: {
        postContext,
        commentAngle: chosenAngle
      }
    },
    async (response: ExtensionMessageResponse<GenerateCommentResponse>) => {
      isCurrentlyGeneratingComment = false;
      updateToolbarButtonState(editor, false);

      if (response?.success && response.data?.commentText) {
        const comment = response.data.commentText;
        await insertCommentIntoEditor(editor, comment);
        editor.setAttribute('data-ai-comment-handled', 'true');

        showCommentToast('Okwu comment applied', true, () => {
          // Allow user to click 'New Angle' to regenerate
          const nextAngle =
            angles[(angles.indexOf(chosenAngle) + 1) % angles.length];
          editor.removeAttribute('data-ai-comment-handled');
          triggerCommentGeneration(editor, nextAngle);
        });
      } else {
        editor.setAttribute('data-ai-comment-handled', 'error');
        const errorMsg =
          response?.error ||
          response?.data?.error ||
          'Failed to generate comment. Click Okwu to retry.';
        showCommentToast(`AI Error: ${errorMsg}`, true);
      }
    }
  );
}

/**
 * Updates the state of the toolbar button inside the comment box.
 */
function updateToolbarButtonState(editor: HTMLElement, isGenerating: boolean): void {
  const commentBox = editor.closest('.ckymfu, .comments-comment-box, div[id*="asyncInlineCommentBoxSlot"]') || editor.parentElement;
  if (!commentBox) return;

  const btn = commentBox.querySelector<HTMLButtonElement>('.linkedin-ai-generate-comment-btn');
  if (!btn) return;

  if (isGenerating) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: linkedinSpin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <span style="font-size:11px; font-weight:600; color:#2563eb;">Drafting...</span>
    `;
  } else {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      </svg>
      <span style="font-size:11px; font-weight:600;">Okwu</span>
    `;
  }
}

/**
 * Injects a handy "✨ Okwu" button into the comment box toolbar.
 */
function injectCommentToolbarButton(editor: HTMLElement): void {
  const commentBox = editor.closest('.ckymfu, .comments-comment-box, div[id*="asyncInlineCommentBoxSlot"]') || editor.parentElement;
  if (!commentBox) return;

  if (commentBox.querySelector('.linkedin-ai-generate-comment-btn')) return;

  // Find toolbar button row (e.g. next to Emoji, GIF, Photo buttons)
  const toolbar =
    commentBox.querySelector('.ckymbx, .comments-comment-box__tools, div[class*="toolbar"]') ||
    commentBox.querySelector('div[class*="ProseMirror"]')?.parentElement;

  if (!toolbar) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'linkedin-ai-generate-comment-btn';
  btn.setAttribute('aria-label', 'Generate authentic comment with Okwu');
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    margin-left: 6px;
    border-radius: 9999px;
    background-color: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 150ms ease;
  `;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    <span style="font-size:11px; font-weight:600;">Okwu</span>
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = '#dbeafe';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = '#eff6ff';
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    editor.removeAttribute('data-ai-comment-handled');
    triggerCommentGeneration(editor);
  });

  toolbar.appendChild(btn);
}

/**
 * Checks all visible comment editors across the document and auto-drafts when a new comment box comes up.
 */
export function checkAndAutofillComments(): void {
  // Prevent calling chrome API if extension context has been invalidated or reloaded
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;

  const editors = findCommentEditors(document);
  if (editors.length === 0) return;

  // Pre-filter: only query extension settings if at least one editor needs button injection or auto-fill
  const needsAction = editors.some((editor) => {
    const commentBox =
      editor.closest('.ckymfu, .comments-comment-box, div[id*="asyncInlineCommentBoxSlot"]') ||
      editor.parentElement;
    const hasButton = Boolean(commentBox?.querySelector('.linkedin-ai-generate-comment-btn'));
    const isHandled = Boolean(editor.getAttribute('data-ai-comment-handled'));
    const isEmpty = isCommentEditorEmpty(editor);

    return !hasButton || (!isHandled && isEmpty);
  });

  if (!needsAction) return;

  try {
    chrome.runtime.sendMessage(
      { type: 'GET_SETTINGS' },
      (response: ExtensionMessageResponse<ExtensionSettings>) => {
        if (chrome.runtime?.lastError || !response?.data) return;
        const settings = response.data;
        if (settings.useCustomApiKey && !settings.openaiApiKey) return;

        for (const editor of editors) {
          // Ensure toolbar button is attached
          injectCommentToolbarButton(editor);

          // Automatic trigger: when the comment box comes up and is empty
          if (settings.autoFillComment === false) continue;
          if (editor.getAttribute('data-ai-comment-handled')) continue;
          if (!isCommentEditorEmpty(editor)) continue;

          // Verify editor is visible in the viewport or active
          const rect = editor.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            triggerCommentGeneration(editor);
            break; // Process one comment box at a time to prevent duplicate calls
          }
        }
      }
    );
  } catch {
    // Context invalidated, ignore
  }
}
