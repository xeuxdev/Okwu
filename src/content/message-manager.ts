import {
  ConversationContext,
  ExtensionMessageResponse,
  GenerateMessageResponse,
  MessageIntent,
  ThreadMessage
} from '../types/extension-types';
import { extractTargetProfileFromDom } from './dom-extractor';
import { insertCommentIntoEditor } from './comment-injector';
import { showCommentToast } from './comment-manager';

const MESSAGE_EDITOR_SELECTOR = 'div.msg-form__contenteditable[contenteditable="true"]';
const CONVERSATION_CONTAINER_SELECTOR =
  '.msg-convo-wrapper, .msg-overlay-conversation-bubble, .msg-thread, .msg-conversations-container__convo-detail, .scaffold-layout__detail';

const INTENT_MENU_ITEMS: Array<{ intent: MessageIntent; label: string }> = [
  { intent: 'auto', label: 'Best guess' },
  { intent: 'say_hi', label: 'Say hi / reconnect' },
  { intent: 'ask_question', label: 'Ask a question' },
  { intent: 'job_referral', label: 'Job / referral' },
  { intent: 'collaborate', label: 'Collaborate' },
  { intent: 'congrats', label: 'Congrats' },
  { intent: 'follow_up', label: 'Follow up' }
];

let intentMenuHost: HTMLDivElement | null = null;
let intentMenuButton: HTMLButtonElement | null = null;
let isGeneratingMessage = false;

let cachedShadowRoots: ShadowRoot[] = [];
let lastShadowScan = 0;

function collectShadowRoots(root: Document | ShadowRoot, found: ShadowRoot[], depth: number): void {
  if (depth > 3) return;
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.shadowRoot && !found.includes(el.shadowRoot)) {
      found.push(el.shadowRoot);
      collectShadowRoots(el.shadowRoot, found, depth + 1);
    }
  });
}

/**
 * LinkedIn renders the chat overlay inside an open shadow root (e.g. #interop-outlet),
 * which document.querySelectorAll cannot see, so search those roots too.
 */
function getSearchRoots(): Array<Document | ShadowRoot> {
  const now = Date.now();
  if (now - lastShadowScan > 2000) {
    lastShadowScan = now;
    const found: ShadowRoot[] = [];
    collectShadowRoots(document, found, 0);
    cachedShadowRoots = found;
  }
  return [document, ...cachedShadowRoots.filter((r) => r.host.isConnected)];
}

function cleanText(text?: string | null): string {
  if (!text) return '';
  return text.replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim();
}

/** Text of an element without screen-reader-only labels like "Status is offline". */
function visibleText(el?: Element | null): string {
  if (!el) return '';
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.visually-hidden, .a11y-text').forEach((n) => n.remove());
  return cleanText(clone.textContent);
}

function profileSlug(url?: string | null): string {
  const match = (url || '').match(/\/in\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]).toLowerCase() : '';
}

function getEditorText(editor: HTMLElement): string {
  return (editor.innerText || editor.textContent || '').trim();
}

/**
 * Reads the recipient, connection degree and earlier messages from a LinkedIn chat window or thread page.
 */
export function extractConversationContext(editor: HTMLElement): ConversationContext {
  const container =
    editor.closest<HTMLElement>(CONVERSATION_CONTAINER_SELECTOR) || document.body;

  // Recipients picked in a new-message compose window
  const pillNames = Array.from(
    container.querySelectorAll<HTMLElement>('.msg-connections-typeahead__added-recipients .artdeco-pill__text')
  )
    .map((el) => cleanText(el.textContent))
    .filter(Boolean);

  // One-to-one profile card at the top of the conversation
  const card = container.querySelector<HTMLElement>('.msg-s-profile-card');
  const cardLink = card?.querySelector<HTMLAnchorElement>('a[href*="/in/"]');
  const cardName = cleanText(
    card?.querySelector('.artdeco-entity-lockup__title a span.truncate, .artdeco-entity-lockup__title a')?.textContent
  );
  const cardHeadline = visibleText(card?.querySelector('.artdeco-entity-lockup__subtitle'));
  const degreeText = cleanText(
    card?.querySelector('.artdeco-entity-lockup__badge .a11y-text, .artdeco-entity-lockup__degree')?.textContent
  );
  const degreeMatch = degreeText.match(/(1st|2nd|3rd\+?)/i);

  // Existing-thread headers (chat bubble and full messaging page)
  const headerTitle = cleanText(
    container.querySelector('.msg-overlay-bubble-header__title, .msg-entity-lockup__entity-title, h2.msg-thread__title')?.textContent
  );
  const headerName = /^new message$/i.test(headerTitle) ? '' : headerTitle;
  const headerLink = container.querySelector<HTMLAnchorElement>(
    '.msg-thread__link-to-profile, .msg-overlay-bubble-header a[href*="/in/"], .msg-title-bar a[href*="/in/"]'
  );
  const headerHeadline = visibleText(
    container.querySelector('.msg-entity-lockup__entity-info, .msg-thread__subtitle')
  );

  const recipientName = cardName || pillNames[0] || headerName || '';
  const recipientProfileUrl = cardLink?.href || headerLink?.href || undefined;
  const otherRecipients = pillNames.filter((n) => n !== recipientName);

  // Earlier messages in the thread, oldest first
  const history: ThreadMessage[] = [];
  const usesOtherClass = Boolean(container.querySelector('.msg-s-event-listitem--other'));
  let currentSender = '';
  container
    .querySelectorAll<HTMLElement>('.msg-s-message-list__event, .msg-s-event-listitem')
    .forEach((eventEl) => {
      const senderName = cleanText(eventEl.querySelector('.msg-s-message-group__name')?.textContent);
      if (senderName) currentSender = senderName;

      // Only read bodies at the list-item level to avoid counting nested matches twice
      if (!eventEl.matches('.msg-s-event-listitem')) return;
      const body = cleanText(eventEl.querySelector('.msg-s-event-listitem__body')?.textContent);
      if (!body) return;

      const fromMe = usesOtherClass
        ? !eventEl.classList.contains('msg-s-event-listitem--other')
        : Boolean(currentSender) && currentSender !== recipientName;
      history.push({ fromMe, text: body });
    });

  // On the recipient's own profile page we can read their full profile for better context
  let recipientProfile: ConversationContext['recipientProfile'];
  const pageSlug = profileSlug(window.location.href);
  if (pageSlug && pageSlug === profileSlug(recipientProfileUrl)) {
    try {
      recipientProfile = extractTargetProfileFromDom();
    } catch {
      recipientProfile = undefined;
    }
  }

  return {
    recipientName,
    recipientHeadline: cardHeadline || headerHeadline || recipientProfile?.headline || undefined,
    recipientProfileUrl,
    connectionDegree: degreeMatch ? degreeMatch[1] : undefined,
    otherRecipients: otherRecipients.length > 0 ? otherRecipients : undefined,
    history: history.slice(-12),
    recipientProfile
  };
}

function closeIntentMenu(): void {
  if (intentMenuHost) {
    intentMenuHost.remove();
    intentMenuHost = null;
  }
  intentMenuButton = null;
  document.removeEventListener('mousedown', handleOutsideClick, true);
  document.removeEventListener('keydown', handleMenuKeydown, true);
}

function handleOutsideClick(e: MouseEvent): void {
  if (!intentMenuHost) return;
  // composedPath sees through shadow roots; let the Okwu button's own click toggle the menu
  const path = e.composedPath();
  if (path.includes(intentMenuHost) || (intentMenuButton && path.includes(intentMenuButton))) return;
  closeIntentMenu();
}

function handleMenuKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeIntentMenu();
}

function setButtonBusy(btn: HTMLButtonElement | null, busy: boolean): void {
  if (!btn) return;
  btn.disabled = busy;
  const label = btn.querySelector('span');
  if (label) label.textContent = busy ? 'Drafting...' : 'Okwu';
}

/**
 * Generates a message for the conversation and writes it into the message box.
 */
async function generateMessage(
  editor: HTMLElement,
  intent: MessageIntent,
  btn: HTMLButtonElement | null,
  briefOverride?: string
): Promise<void> {
  if (isGeneratingMessage) return;

  const conversation = extractConversationContext(editor);
  if (!conversation.recipientName) {
    showCommentToast('Okwu: Add a recipient first, then try again.', true);
    return;
  }

  // Whatever the user already typed is treated as the brief for the message
  const brief = briefOverride !== undefined ? briefOverride : getEditorText(editor);

  isGeneratingMessage = true;
  setButtonBusy(btn, true);
  showCommentToast(`Okwu: Drafting message to ${conversation.recipientName.split(/\s+/)[0]}...`);

  chrome.runtime.sendMessage(
    {
      type: 'GENERATE_MESSAGE',
      payload: { conversation, intent, brief: brief || undefined }
    },
    async (response: ExtensionMessageResponse<GenerateMessageResponse>) => {
      isGeneratingMessage = false;
      setButtonBusy(btn, false);

      if (chrome.runtime.lastError) {
        showCommentToast('AI Error: Extension was reloaded. Refresh the page and retry.', true);
        return;
      }

      const text = response?.data?.messageText;
      if (response?.success && text) {
        await insertCommentIntoEditor(editor, text);
        showCommentToast(
          'Okwu message drafted, review before sending',
          true,
          () => generateMessage(editor, intent, btn, brief),
          'Try another'
        );
      } else {
        const errorMsg = response?.error || response?.data?.error || 'Failed to generate message.';
        showCommentToast(`AI Error: ${errorMsg}`, true);
      }
    }
  );
}

function openIntentMenu(editor: HTMLElement, btn: HTMLButtonElement): void {
  closeIntentMenu();

  const hasBrief = getEditorText(editor).length > 0;
  const rect = btn.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.id = 'okwu-message-intent-menu';
  menu.style.cssText = `
    position: fixed;
    left: ${Math.max(8, Math.min(rect.left, window.innerWidth - 228))}px;
    bottom: ${Math.max(8, window.innerHeight - rect.top + 6)}px;
    z-index: 9999999;
    width: 220px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
    padding: 6px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const header = document.createElement('div');
  header.style.cssText = 'font-size: 11px; color: #64748b; padding: 4px 8px 6px; line-height: 1.35;';
  header.textContent = hasBrief
    ? 'What is this message for? Your typed text will be used as the brief.'
    : 'What is this message for? Tip: type rough notes first to steer it.';
  menu.appendChild(header);

  for (const item of INTENT_MENU_ITEMS) {
    const option = document.createElement('button');
    option.type = 'button';
    option.textContent = item.label;
    option.style.cssText = `
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      border-radius: 6px;
      padding: 7px 8px;
      font-size: 13px;
      color: #0f172a;
      cursor: pointer;
      font-family: inherit;
    `;
    option.addEventListener('mouseenter', () => {
      option.style.backgroundColor = '#eff6ff';
    });
    option.addEventListener('mouseleave', () => {
      option.style.backgroundColor = 'transparent';
    });
    option.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeIntentMenu();
      generateMessage(editor, item.intent, btn);
    });
    menu.appendChild(option);
  }

  document.body.appendChild(menu);
  intentMenuHost = menu;
  intentMenuButton = btn;
  document.addEventListener('mousedown', handleOutsideClick, true);
  document.addEventListener('keydown', handleMenuKeydown, true);
}

function injectMessageButton(editor: HTMLElement): void {
  const form = editor.closest<HTMLElement>('form.msg-form, form');
  if (!form || form.querySelector('.okwu-message-btn')) return;

  const actions = form.querySelector<HTMLElement>('.msg-form__left-actions, footer');
  if (!actions) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'okwu-message-btn';
  btn.setAttribute('aria-label', 'Draft message with Okwu');
  btn.title = 'Draft message with Okwu';
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    margin: 0 6px;
    border-radius: 9999px;
    background-color: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    align-self: center;
  `;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    <span>Okwu</span>
  `;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (intentMenuHost) {
      closeIntentMenu();
      return;
    }
    // Re-resolve the editor in case LinkedIn re-rendered the form
    const liveEditor = form.querySelector<HTMLElement>(MESSAGE_EDITOR_SELECTOR) || editor;
    openIntentMenu(liveEditor, btn);
  });

  actions.appendChild(btn);
}

/**
 * Adds the Okwu button to every open LinkedIn message box (chat bubbles and the messaging page).
 */
export function checkAndInjectMessageButtons(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
  for (const root of getSearchRoots()) {
    root.querySelectorAll<HTMLElement>(MESSAGE_EDITOR_SELECTOR).forEach((editor) => {
      injectMessageButton(editor);
    });
  }
}
