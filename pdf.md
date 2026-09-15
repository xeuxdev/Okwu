# PRD: LinkedIn Connection Message Assistant (Browser Extension)

## 1. Overview

A Chrome browser extension (Manifest V3) that helps the user write personalized LinkedIn connection request notes. The user uploads their resume once and sets style preferences; when they visit a LinkedIn profile, the extension reads what's on the page, drafts a short connection note using Claude, and fills it into LinkedIn's native "Add a note" box. The user always reviews and clicks Send manually — no automated sending.

## 2. Goals

- Reduce time spent writing connection notes.
- Keep notes personalized (referencing the specific person) rather than generic templates.
- Keep the user in full control of what gets sent and when.
- Avoid any behavior that resembles scraping-at-scale or automated outreach (ToS risk on LinkedIn).

## 3. Non-Goals

- No automatic sending of connection requests.
- No bulk/background crawling of LinkedIn profiles the user hasn't opened.
- No storage of scraped LinkedIn data beyond the current session (privacy — don't build a shadow database of people's profiles).
- No messaging beyond the initial connection note (this is not a full outreach/CRM tool).

## 4. Users

Single-user tool, for personal use by the person installing it. No multi-user/team features in v1.

## 5. User Flow

### 5.1 Onboarding (one-time setup)

1. User installs extension, clicks icon, opens Settings/Options page.
2. User uploads resume file (PDF or DOCX).
3. Extension parses resume client-side into a structured profile:
   - Name
   - Current role / title
   - Key skills (list)
   - Notable experience (2–4 bullet highlights)
4. User manually adds free-text "style notes" — e.g. tone preferences, things to avoid, a sample note they like.
5. User enters their Anthropic API key (stored locally only).
6. Profile is saved to `chrome.storage.local`. User can return to Settings anytime to edit/re-upload.

### 5.2 Core flow (per connection)

1. User navigates to a LinkedIn profile (`linkedin.com/in/*`) in their normal browsing.
2. Content script detects the profile page and injects a small "Draft note" button near the native Connect button (or the user can trigger via the extension's toolbar icon).
3. On click, content script extracts visible profile data:
   - Name
   - Headline
   - Current company/role
   - About section (if present)
   - Recent activity/post text (if visible on page — optional, best-effort)
4. Extracted data + user's stored profile + style notes are sent to the background service worker.
5. Background worker calls the Claude API with a prompt combining both profiles, requesting a connection note under LinkedIn's character limit (300 chars).
6. Draft is returned and shown in a small popup/preview overlay for the user to review and edit inline.
7. User clicks "Insert" — content script locates LinkedIn's native "Add a note" textarea (opened after clicking LinkedIn's own Connect button) and fills it with the (possibly edited) draft.
8. User reviews the filled note directly in LinkedIn's UI and clicks LinkedIn's own Send button. Extension does not touch the Send action.

### 5.3 Edge cases

- If LinkedIn's DOM structure has changed and selectors fail to find expected elements, show a clear error ("Couldn't read this profile — LinkedIn may have updated their page") rather than silently failing.
- If profile has minimal public info (locked/limited profile), fall back to a generic-but-still-personalized note using just name + headline.
- If API call fails (rate limit, network, bad key), show inline error with retry option; never block the user from manually writing a note instead.
- Respect LinkedIn's connection note character limit (300 chars) — truncate/warn if generated draft exceeds it.

## 6. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR1 | Extension must parse PDF and DOCX resumes client-side (no upload to external servers except the resume text sent to Claude for context). |
| FR2 | User profile (resume summary + style notes) persists in `chrome.storage.local` across sessions. |
| FR3 | Content script only activates on `linkedin.com/in/*` profile pages the user actively navigates to. |
| FR4 | No background/automatic visiting of other profiles or bulk scraping. |
| FR5 | Generated draft must respect LinkedIn's 300-character connection note limit. |
| FR6 | User must be able to edit the draft before it's inserted into LinkedIn's note field. |
| FR7 | Extension never programmatically clicks LinkedIn's "Send" button — insertion only. |
| FR8 | API key stored locally, never transmitted anywhere except directly to Anthropic's API. |
| FR9 | Settings page allows editing/re-uploading resume and style notes at any time. |
| FR10 | Scraped profile data from a visited page is used only in-memory for that session's draft generation — not persisted to storage. |

## 7. Technical Architecture

```
/extension
  manifest.json          # Manifest V3 config, permissions, content script matches
  /popup
    popup.html/js/css     # Quick-access UI: trigger draft, view/edit result
  /options
    options.html/js/css   # Onboarding + settings: resume upload, style notes, API key
  /content
    content.js            # Runs on linkedin.com/in/* — scrapes DOM, injects button, fills note field
  /background
    service-worker.js     # Handles API calls to Claude, message passing between content script and popup
  /lib
    pdf-parse.js           # pdf.js wrapper for resume parsing
    docx-parse.js          # mammoth.js wrapper for resume parsing
```

**Key libraries:**

- `pdf.js` — client-side PDF text extraction
- `mammoth.js` — client-side DOCX text extraction
- Anthropic API (`/v1/messages`) — called from the service worker with the user's stored API key

**Permissions needed in manifest.json:**

- `activeTab` — read the currently open LinkedIn tab
- `storage` — persist user profile locally
- `scripting` — inject content script / button
- Host permission for `https://api.anthropic.com/*` and `https://*.linkedin.com/*`

## 8. Prompt Design (for background worker → Claude API call)

Inputs to the prompt:

- User's resume summary (role, skills, highlights)
- User's style notes
- Scraped target profile info (name, headline, company, about excerpt)

Prompt should instruct Claude to:

- Write 1–3 sentences, under 300 characters total
- Reference something specific and genuine about the target person (not generic flattery)
- Match the user's stated tone
- Avoid clichés ("I'd love to connect and pick your brain")
- Output plain text only, no preamble

## 9. Privacy & Compliance Notes

- This tool assists a human doing manual, one-at-a-time outreach — it does not automate LinkedIn actions beyond filling a text field the user already opened.
- No data about third parties (the people being messaged) is stored beyond the active drafting session.
- Resume and style data live only in the user's local browser storage.
- Because LinkedIn's Terms of Service restrict automated scraping/interaction, this design deliberately avoids: background crawling, auto-connecting, auto-sending, and persisting scraped profile data. The agent building this should not add these behaviors even as "convenience" features without re-checking ToS implications.

## 10. Open Questions for Build

- Should style notes support multiple "modes" (e.g. more formal for recruiters vs casual for peers), or is one fixed style sufficient for v1?
- Should the injected "Draft note" button appear automatically on every profile visit, or only on demand (toolbar icon click) to minimize DOM footprint?
- Any interest in a lightweight history log (locally stored) of past drafts sent, for the user's own reference?

## 11. Success Criteria (v1)

- User can go from resume upload to a usable draft on a real profile in under 2 minutes of setup.
- Generated drafts require light editing (not full rewrites) in the majority of cases.
- Zero automated sends; user retains the final click every time.