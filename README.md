# Okwu

> **Okwu** (*noun*, Igbo: "speech", "word", "conversation")  
> An authentic AI voice for LinkedIn. Craft thoughtful, human connection notes and high-signal comments without corporate bot slop.

## Key Features

- **Authentic Voice & Comments**: Generates human, peer-to-peer reactions for LinkedIn posts (celebrating milestones first before dropping witty or post-matched remarks) without forced questions or AI slop.
- **Smart Connection Notes**: Crafts personalized LinkedIn connection requests tailored to your background, resume fact sheets, and the recipient's profile within character limits.
- **Client-Side Resume Parsing**: Extracts text from PDF and DOCX resumes locally in the browser using PDF.js and Mammoth without uploading raw files to external servers.
- **Structured Profile Editor**: Automatically extracts full name, current role, key skills, and notable highlights, allowing inline editing.
- **Tone & Style Customization**: Select tones (Conversational, Professional, Direct, Enthusiastic) and set specific custom instructions, sample notes, and topics to avoid.
- **Non-Intrusive LinkedIn Integration**: Injects a clean "Okwu Note" action button into LinkedIn profile headers (`linkedin.com/in/*`) and an "Okwu" toolbar button for inline comments.
- **Shadow DOM Isolation**: Renders drafting modals in a Shadow DOM with Tailwind styles so LinkedIn styles do not interfere.
- **Safe Insertion**: Automatically fills LinkedIn's native "Add a note" textarea or comment box when requested. Never clicks the Send button; the user always retains manual control.

## Tech Stack

- **Framework**: React 19
- **Styling**: Tailwind CSS v4
- **Build System**: Vite 6 / 8 (Multi-target build for options, popup, content script, and service worker)
- **Document Extractors**: `pdfjs-dist` (PDF) and `mammoth` (DOCX)
- **AI Integration**: OpenAI Chat Completions API (`https://api.openai.com/v1/chat/completions`)

## How to Build & Install

### 1. Build the Extension
```bash
pnpm install
pnpm run build
```

This generates the complete unpacked extension in the `dist/` directory:
- `dist/manifest.json`
- `dist/options.html`
- `dist/popup.html`
- `dist/content-script.js`
- `dist/service-worker.js`
- `dist/icons/`

### 2. Load into Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `dist` folder inside this repository (`c:\Users\hp\Desktop\projects\xeux-labs\linkedin-connect\dist`).

### 3. Onboarding & Configuration
1. The Options page opens automatically on first install (or click the extension icon and select Settings).
2. Enter your OpenAI API key and click **Test OpenAI Connection**.
3. Upload your resume (PDF or DOCX).
4. Review the extracted skills, highlights, and role.
5. Set your style preferences and click **Save Settings**.

### 4. Drafting Notes on LinkedIn
1. Navigate to any LinkedIn profile (e.g. `https://www.linkedin.com/in/...`).
2. Click the injected **Draft Note** button on the profile header or the floating trigger in the bottom right corner.
3. Review the drafted note, tweak with quick adjustment chips (e.g. "Shorter", "More Casual"), and click **Insert into LinkedIn Note**.
4. Review the note directly in LinkedIn and click LinkedIn's Send button manually.
