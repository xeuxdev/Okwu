import { createRoot, Root } from 'react-dom/client';
import { extractTargetProfileFromDom } from './dom-extractor';
import { DraftCard } from './draft-card';

let currentShadowHost: HTMLDivElement | null = null;
let currentReactRoot: Root | null = null;
let injectedButton: HTMLButtonElement | null = null;
let floatingTrigger: HTMLButtonElement | null = null;

// Complete isolated styles for Shadow DOM (zero leaking from or to host page)
const SHADOW_CSS = `
  *, ::before, ::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border-width: 0;
    border-style: solid;
    border-color: #e2e8f0;
  }
  html, :host {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
  button {
    background-color: transparent;
    color: inherit;
    border: none;
    cursor: pointer;
    font: inherit;
    padding: 0;
    margin: 0;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
  textarea {
    background-color: #ffffff !important;
    color: #0f172a !important;
    font-family: inherit;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
  textarea::placeholder {
    color: #94a3b8 !important;
  }
  .fixed { position: fixed; }
  .relative { position: relative; }
  .absolute { position: absolute; }
  .inset-0 { inset: 0px; }
  .top-6 { top: 1.5rem; }
  .bottom-6 { bottom: 1.5rem; }
  .right-6 { right: 1.5rem; }
  .z-\\[999999\\] { z-index: 999999; }
  .w-\\[480px\\] { width: 480px; }
  .max-w-\\[calc\\(100vw-2rem\\)\\] { max-width: calc(100vw - 2rem); }
  .max-w-\\[280px\\] { max-width: 280px; }
  .w-full { width: 100%; }
  .rounded-2xl { border-radius: 1rem; }
  .rounded-xl { border-radius: 0.75rem; }
  .rounded-lg { border-radius: 0.5rem; }
  .rounded-md { border-radius: 0.375rem; }
  .rounded-full { border-radius: 9999px; }
  .border { border-width: 1px; }
  .border-b { border-bottom-width: 1px; }
  .border-t { border-top-width: 1px; }
  .border-slate-100 { border-color: #f1f5f9; }
  .border-slate-200 { border-color: #e2e8f0; }
  .border-slate-300 { border-color: #cbd5e1; }
  .border-amber-200 { border-color: #fde68a; }
  .border-red-200 { border-color: #fecaca; }
  .border-blue-100 { border-color: #dbeafe; }
  .border-blue-200\\/60 { border-color: rgba(191, 219, 254, 0.6); }
  .border-blue-300 { border-color: #93c5fd; }
  .bg-blue-50\\/60 { background-color: rgba(239, 246, 255, 0.6); }
  .bg-blue-50 { background-color: #eff6ff; }
  .bg-blue-100 { background-color: #dbeafe; }
  .text-blue-950 { color: #172554 !important; }
  .text-blue-900 { color: #1e3a8a !important; }
  .text-blue-800 { color: #1e40af !important; }
  .text-blue-700 { color: #1d4ed8 !important; }
  .w-9 { width: 2.25rem; }
  .grid { display: grid; }
  .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hover\\:bg-blue-100:hover { background-color: #dbeafe; }
  .hover\\:underline:hover { text-decoration-line: underline; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }
  .peer:checked ~ div { background-color: #2563eb !important; }
  .peer:checked ~ div::after { transform: translateX(100%) !important; }
  .bg-transparent { background-color: transparent !important; }
  .bg-white { background-color: #ffffff !important; }
  .bg-white\\/90 { background-color: rgba(255, 255, 255, 0.9); }
  .bg-slate-50 { background-color: #f8fafc; }
  .bg-slate-100 { background-color: #f1f5f9; }
  .bg-amber-50 { background-color: #fffbeb; }
  .bg-red-50 { background-color: #fef2f2; }
  .bg-emerald-50 { background-color: #ecfdf5; }
  .bg-blue-600 { background-color: #2563eb; }
  .bg-blue-700 { background-color: #1d4ed8; }
  .p-1\\.5 { padding: 0.375rem; }
  .p-2 { padding: 0.5rem; }
  .p-2\\.5 { padding: 0.625rem; }
  .p-3 { padding: 0.75rem; }
  .p-3\\.5 { padding: 0.875rem; }
  .p-4 { padding: 1rem; }
  .p-5 { padding: 1.25rem; }
  .p-6 { padding: 1.5rem; }
  .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
  .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
  .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
  .px-4 { padding-left: 1rem; padding-right: 1rem; }
  .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
  .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
  .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
  .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
  .py-2\\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; }
  .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
  .pb-3 { padding-bottom: 0.75rem; }
  .pb-4 { padding-bottom: 1rem; }
  .pt-1 { padding-top: 0.25rem; }
  .pt-2 { padding-top: 0.5rem; }
  .mb-1 { margin-bottom: 0.25rem; }
  .mb-1\\.5 { margin-bottom: 0.375rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-3 { margin-bottom: 0.75rem; }
  .mb-4 { margin-bottom: 1rem; }
  .mt-0\\.5 { margin-top: 0.125rem; }
  .mt-1 { margin-top: 0.25rem; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-2\\.5 { margin-top: 0.625rem; }
  .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
  .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
  .text-slate-900 { color: #0f172a !important; }
  .text-slate-800 { color: #1e293b !important; }
  .text-slate-700 { color: #334155 !important; }
  .text-slate-600 { color: #475569 !important; }
  .text-slate-500 { color: #64748b !important; }
  .text-slate-400 { color: #94a3b8 !important; }
  .text-white { color: #ffffff !important; }
  .text-blue-600 { color: #2563eb !important; }
  .text-amber-600 { color: #d97706 !important; }
  .text-amber-800 { color: #92400e !important; }
  .text-amber-900 { color: #78350f !important; }
  .text-red-600 { color: #dc2626 !important; }
  .text-red-800 { color: #991b1b !important; }
  .text-emerald-600 { color: #059669 !important; }
  .text-emerald-700 { color: #047857 !important; }
  .text-emerald-800 { color: #065f46 !important; }
  .flex { display: flex; }
  .inline-flex { display: inline-flex; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .justify-between { justify-content: space-between; }
  .justify-center { justify-content: center; }
  .flex-wrap { flex-wrap: wrap; }
  .flex-1 { flex: 1 1 0%; }
  .gap-1 { gap: 0.25rem; }
  .gap-1\\.5 { gap: 0.375rem; }
  .gap-2 { gap: 0.5rem; }
  .gap-2\\.5 { gap: 0.625rem; }
  .gap-3 { gap: 0.75rem; }
  .h-3 { height: 0.75rem; }
  .w-3 { width: 0.75rem; }
  .h-3\\.5 { height: 0.875rem; }
  .w-3\\.5 { width: 0.875rem; }
  .h-4 { height: 1rem; }
  .w-4 { width: 1rem; }
  .h-5 { height: 1.25rem; }
  .w-5 { width: 1.25rem; }
  .h-8 { height: 2rem; }
  .w-8 { width: 2rem; }
  .h-10 { height: 2.5rem; }
  .w-10 { width: 2.5rem; }
  .text-base { font-size: 1rem; line-height: 1.5rem; }
  .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
  .text-xs { font-size: 0.75rem; line-height: 1rem; }
  .text-center { text-align: center; }
  .font-medium { font-weight: 500; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  .leading-tight { line-height: 1.25; }
  .leading-snug { line-height: 1.375; }
  .leading-relaxed { line-height: 1.625; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
  .transition-colors { transition-property: color, background-color, border-color; transition-duration: 150ms; }
  .cursor-pointer { cursor: pointer; }
  .hover\\:bg-slate-50:hover { background-color: #f8fafc; }
  .hover\\:bg-slate-100:hover { background-color: #f1f5f9; }
  .hover\\:bg-blue-700:hover { background-color: #1d4ed8; }
  .hover\\:text-slate-900:hover { color: #0f172a !important; }
  .hover\\:border-slate-300:hover { border-color: #cbd5e1; }
  .disabled\\:opacity-40:disabled { opacity: 0.4; }
  .disabled\\:opacity-50:disabled { opacity: 0.5; }
  .disabled\\:bg-slate-300:disabled { background-color: #cbd5e1; }
  .disabled\\:text-slate-500:disabled { color: #64748b !important; }
  .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed; }
  .animate-spin { animation: spin 1s linear infinite; }
  .focus\\:border-blue-600:focus { border-color: #2563eb; }
  .focus\\:outline-none:focus { outline: none; }
  .focus\\:ring-1:focus { box-shadow: 0 0 0 1px #2563eb; }
  .focus\\:ring-2:focus { box-shadow: 0 0 0 2px #2563eb; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

function isLinkedInProfilePage(): boolean {
  return window.location.pathname.includes('/in/');
}

function openAssistantModal() {
  if (currentShadowHost) {
    currentShadowHost.remove();
    currentShadowHost = null;
    currentReactRoot = null;
  }

  const targetProfile = extractTargetProfileFromDom();

  // Create Shadow DOM host
  const host = document.createElement('div');
  host.id = 'linkedin-note-assistant-host';
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject Styles
  const styleEl = document.createElement('style');
  styleEl.textContent = SHADOW_CSS;
  shadowRoot.appendChild(styleEl);

  // Mount point
  const mountPoint = document.createElement('div');
  shadowRoot.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  currentShadowHost = host;
  currentReactRoot = root;

  root.render(
    <DraftCard
      targetProfile={targetProfile}
      onClose={() => {
        if (currentReactRoot) {
          currentReactRoot.unmount();
          currentReactRoot = null;
        }
        if (currentShadowHost) {
          currentShadowHost.remove();
          currentShadowHost = null;
        }
      }}
    />
  );
}

function injectProfileButton() {
  if (!isLinkedInProfilePage()) return;
  if (document.getElementById('linkedin-ai-draft-note-btn')) return;

  // Find the action buttons container on LinkedIn profile
  const actionContainer =
    document.querySelector('.pv-top-card-v2-ctas') ||
    document.querySelector('.pvs-profile-actions') ||
    document.querySelector('div.ph5 div.display-flex.mt2') ||
    document.querySelector('.pv-top-card--list + div');

  if (!actionContainer) return;

  const btn = document.createElement('button');
  btn.id = 'linkedin-ai-draft-note-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Draft personalized connection note with AI');
  btn.className = 'artdeco-button artdeco-button--2 artdeco-button--secondary ember-view mr2 inline-flex items-center';
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-right: 8px;
    background-color: #0a66c2;
    color: #ffffff;
    border: 1px solid #0a66c2;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 600;
    padding: 6px 14px;
    cursor: pointer;
    font-family: inherit;
  `;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    <span>Draft Note</span>
  `;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openAssistantModal();
  });

  actionContainer.prepend(btn);
  injectedButton = btn;
}

function injectFloatingTrigger() {
  if (document.getElementById('linkedin-ai-floating-trigger')) return;

  const floating = document.createElement('button');
  floating.id = 'linkedin-ai-floating-trigger';
  floating.type = 'button';
  floating.setAttribute('aria-label', 'Open LinkedIn Note Assistant');
  floating.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #0a66c2;
    color: #ffffff;
    padding: 10px 16px;
    border-radius: 9999px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  floating.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    <span>Draft Note</span>
  `;

  floating.addEventListener('click', () => {
    openAssistantModal();
  });

  document.body.appendChild(floating);
  floatingTrigger = floating;
}

function updateInjection() {
  if (isLinkedInProfilePage()) {
    injectProfileButton();
    if (!floatingTrigger) {
      injectFloatingTrigger();
    } else {
      floatingTrigger.style.display = 'flex';
    }
  } else {
    if (floatingTrigger) {
      floatingTrigger.style.display = 'none';
    }
    if (injectedButton) {
      injectedButton.remove();
      injectedButton = null;
    }
  }
}

// Initial run
updateInjection();

// Observe DOM mutations to handle client-side route transitions
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    updateInjection();
  } else if (isLinkedInProfilePage() && !document.getElementById('linkedin-ai-draft-note-btn')) {
    injectProfileButton();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
