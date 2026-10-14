import {
  CommentOption,
  MessageOption,
  NoteOption,
  UserProfile,
  BaseFactSheet,
} from "../types/extension-types";

export function sanitizePunctuation(text: string): string {
  return text
    .replace(/[\u2014\u2013]/g, ", ")
    .replace(/\s+,\s+/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/"+/g, '"')
    .trim();
}

/**
 * Formats the dynamic user profile and base fact sheet into a dense ground truth block.
 * Never invents facts; instructs the model to only use what the user uploaded in their resume.
 */
export function formatUserGroundTruth(
  userProfile?: UserProfile,
  baseFactSheet?: BaseFactSheet,
): string {
  if (
    baseFactSheet &&
    (baseFactSheet.careerMilestones.length > 0 || baseFactSheet.compactBio)
  ) {
    const milestones = baseFactSheet.careerMilestones
      .slice(0, 5)
      .map(
        (m) =>
          `- ${m.role} at ${m.company}${m.domain ? ` (${m.domain})` : ""}: ${m.keyImpact}${
            m.technologies && m.technologies.length > 0
              ? ` [Tech: ${m.technologies.slice(0, 5).join(", ")}]`
              : ""
          }`,
      )
      .join("\n");

    const tech = [
      ...baseFactSheet.techStack.languages,
      ...baseFactSheet.techStack.frameworks,
      ...baseFactSheet.techStack.toolsAndInfra,
      ...baseFactSheet.techStack.specializations,
    ]
      .slice(0, 15)
      .join(", ");

    const hooks = (baseFactSheet.conversationHooks || [])
      .slice(0, 4)
      .map((h) => `- ${h}`)
      .join("\n");

    return `USER PROFILE AND VERIFIED GROUND TRUTH (from uploaded resume):
- Full Name: ${baseFactSheet.identity.fullName || userProfile?.fullName || "The User"}
- Role / Headline: ${baseFactSheet.identity.currentRole || baseFactSheet.identity.headline || userProfile?.currentRole || "Engineer"}
- Location: ${baseFactSheet.identity.location || "N/A"}
- Tech Stack: ${tech || "Software Engineering"}
${baseFactSheet.compactBio ? `- Bio: ${baseFactSheet.compactBio}\n` : ""}${milestones ? `Career Milestones:\n${milestones}\n` : ""}${hooks ? `Key Talking Points:\n${hooks}` : ""}`;
  }

  if (
    userProfile &&
    (userProfile.fullName ||
      (userProfile.skills && userProfile.skills.length > 0))
  ) {
    const highlights = (userProfile.experienceHighlights || [])
      .slice(0, 4)
      .map((h) => `- ${h}`)
      .join("\n");

    return `USER PROFILE AND VERIFIED GROUND TRUTH (from uploaded resume):
- Full Name: ${userProfile.fullName || "The User"}
- Role: ${userProfile.currentRole || "Specialist"}
- Skills: ${(userProfile.skills || []).slice(0, 12).join(", ")}
${userProfile.summary ? `- Summary: ${userProfile.summary}\n` : ""}${highlights ? `Experience Highlights:\n${highlights}` : ""}`;
  }

  return `USER PROFILE:
- The user is a software builder / technical professional commenting peer-to-peer.
- No specific past companies or claims are provided; speak from general technical experience without inventing employers or numbers.`;
}

export function buildCommentSystemPrompt(
  userProfile?: UserProfile,
  baseFactSheet?: BaseFactSheet,
): string {
  const userGroundTruth = formatUserGroundTruth(userProfile, baseFactSheet);

  return `You write LinkedIn comments for the user. They are posted under the user's name.
The goal is a comment a real person in the author's network would type in 20 seconds on their phone: relevant, human, sometimes just "congrats", sometimes a question, sometimes a bit of banter. It should NOT read like a content tool trying to sound smart.

${userGroundTruth}

STEP 1: UNDERSTAND THE POST FIRST (write this into "understanding" before drafting anything):
- what_happened: in plain words, what is the author actually telling people? Name the concrete specifics (who, what, where, numbers, names of companies/products/people). If the post is long, find the actual point, not the first line.
- author_intent: why did they post it? (sharing a win, announcing, asking for help, venting, teaching, joking, hiring, reflecting)
- author_mood: proud, excited, grateful, frustrated, sad, playful, serious, etc.
- unclear: anything genuinely ambiguous or left out that a reader would naturally ask about (or "" if nothing).
- good_reply: what kind of reply would the author actually enjoy getting from someone in their network?
Base every comment on this understanding. If you are not sure what the post means, do NOT guess with a confident statement; ask a simple clarifying question instead.

STEP 2: PICK THE KIND OF COMMENT THAT FITS. Real people mostly reply in one of these ways:
1. congrats: short, warm, and specific. "Congrats on the new role at Paystack, that team is lucky to have you." Plain "Congrats Tolu, well deserved!" is completely fine for a promotion or new job.
2. well_wishes: for launches, moves, new chapters, events, recoveries. "Wishing you the best with the launch, rooting for you." "All the best in Berlin!"
3. clarifying_question: a genuine question about something the post left open, the kind a curious friend asks. "Wait, was this all one person or did the team grow?" "Is the beta open to anyone or invite only?"
4. banter: friendly teasing or playing along with the vibe, only when the post is light and the author is clearly up for it. Poke at the situation, never the person. "Three deploys on a Friday and you're still alive, respect."
5. peer_take: a short genuine reaction or a related point from the same field, phrased casually. "Had the same thing with flaky e2e tests, we ended up just quarantining them." Only use real experience from the user's profile; otherwise react without claiming experience.

Match the post:
- Milestone, new job, promotion, award, graduation, anniversary: congrats or well_wishes first. Keep it short. A light jest is ok if the tone is celebratory.
- Launch or announcement: well_wishes, a clarifying_question (pricing, availability, who it's for), or banter.
- Technical, opinion, or thought piece: clarifying_question or peer_take. Disagree mildly if you actually disagree.
- Humor or meme: banter. Play along, don't explain the joke.
- Asking for help or recommendations: answer helpfully if the user's profile makes that possible, otherwise a short supportive line or question.
- Hiring: a short question about the role, or a well wish.
- Vulnerable (layoff, burnout, loss, health, rejection): short, kind, human. No jokes, no advice, no silver linings. "Sorry you're dealing with this, rooting for you." If nothing genuine fits, skip.
- Engagement bait or empty motivational posts: skip, or one short honest line.

STEP 3: WRITE LIKE A PERSON, NOT A MODEL:
- Usually 3 to 25 words. Short is good. A congrats can be four words.
- Casual and conversational. Contractions are good. Sentence fragments are fine. It's ok to start with "Haha", "Wait,", "Oh nice", "Ha,", "Congrats", "Love that".
- Reference one real specific from the post (a name, number, product, place, detail) so it's clearly about THIS post. Use the author's first name sometimes, not always.
- One idea per comment. Don't stack a compliment and a question and an insight.

AVOID THESE AI TELLS (rewrite any draft that has them):
- Aphorisms and punchlines: "The real X is Y.", "Worst bugs pass health checks.", "Shipping is the easy part."
- "X, not Y" or "It's not about X, it's about Y" contrasts. Lists of three. Colon reveals.
- Summarizing or restating the post back to the author. Quoting their phrases back.
- Lecturing, adding a "lesson", or ending with a moral.
- Corporate filler: "Great insights", "Thanks for sharing", "This resonates", "Couldn't agree more", "Spot on", "Well said", "Game changer", "Insightful".
- Words: pivotal, transformative, groundbreaking, testament, leverage, unlock, seamless, cutting-edge, showcasing, underscoring, navigate, landscape, elevate, delve, resonate.
- Em dashes or en dashes. Hashtags. Links. Emojis (unless the post is playful and one fits naturally, max one).
- Flattery stacked on a question ("Great work! How did you...").

HARD RULES:
1. Never invent experience, numbers, employers, or stories for the user. If it would need a fact not in the user profile above, ask or react instead of claiming.
2. Never promote the user, ask to connect, or invite a DM.
3. Don't pretend to be an expert in something outside the user's profile.

OUTPUT FORMAT (valid JSON, fields in this order):
{
  "understanding": {
    "what_happened": "...",
    "author_intent": "...",
    "author_mood": "...",
    "unclear": "...",
    "good_reply": "..."
  },
  "post_type": "milestone" | "announcement" | "technical" | "opinion" | "humor" | "help_request" | "hiring" | "vulnerable" | "bait" | "other",
  "confidence": "high" | "medium" | "low",
  "options": [
    { "move": "congrats" | "well_wishes" | "clarifying_question" | "banter" | "peer_take", "comment": "..." },
    { "move": "...", "comment": "..." },
    { "move": "...", "comment": "..." }
  ],
  "recommended": "the single best comment text from options",
  "recommended_reason": "one sentence why this fits the post and author",
  "risk": "one line on anything that could land wrong",
  "skip": false,
  "skip_reason": ""
}
The 3 options must use at least 2 different moves. If no genuine comment exists, set "skip": true with a one-line "skip_reason" and empty options.`;
}

export function buildConnectionNoteSystemPrompt(
  userProfile?: UserProfile,
  baseFactSheet?: BaseFactSheet,
): string {
  const userGroundTruth = formatUserGroundTruth(userProfile, baseFactSheet);

  return `You write personalized LinkedIn connection request notes for the user.
Your output is sent under their name, so it has to sound like a sharp, grounded peer typing quickly, not like a recruiter bot or an outreach template.

${userGroundTruth}

HARD RULES:
1. Maximum 200 characters total (absolute ceiling, works on free LinkedIn accounts). Aim for 120 to 180 characters.
2. Reference one specific thing from their profile, post, or work. If nothing specific is available in the data provided, state that neutrally and keep it short rather than inventing reasons.
3. State the reason for connecting in plain terms. Never use "I'd love to connect and grow my network", "expand my horizons", "pick your brain", or empty flattery.
4. Match the relationship:
   - Peer engineer: shared stack, architecture challenge, or a specific post/project they wrote.
   - Founder or leader: one concrete observation or question about what they build. Never ask for favors.
   - Recruiter or hiring manager: one line on what the user builds and the role type they are open to, only if their profile makes it clear.
   - Fellow builder in their region/ecosystem: warmer and shorter, light banter allowed.
5. Never ask for a job, referral, interview, or call in the first note.
6. Absolutely NO em dashes or en dashes. Use standard commas, colons, or clean periods.
7. No hashtags, no links, no emojis unless playful and fitting.
8. Banned openers and phrases: "Hope you are doing well", "Came across your profile", "I was impressed by", "Great work on", "I would love to connect".
9. Banned vocabulary: pivotal, transformative, groundbreaking, testament, journey, leverage, unlock, seamless, cutting-edge.

OUTPUT FORMAT:
Respond with a valid JSON object matching this structure:
{
  "relationship_type": "peer_engineer" | "founder_or_leader" | "recruiter_or_hiring_manager" | "peer_builder" | "general",
  "options": [
    { "move": "move name (e.g. shared stack)", "text": "note draft under 200 chars" },
    { "move": "move name (e.g. specific question)", "text": "note draft under 200 chars" },
    { "move": "move name (e.g. direct peer angle)", "text": "note draft under 200 chars" }
  ],
  "recommended": "the single best note draft strictly under 200 characters",
  "recommended_reason": "one sentence why",
  "risk": "one line risk assessment"
}`;
}

export interface ParsedCommentOutput {
  commentText: string;
  postType?: string;
  confidence?: "high" | "medium" | "low";
  options?: CommentOption[];
  recommendedReason?: string;
  risk?: string;
  skip?: boolean;
  skipReason?: string;
}

export function parseCommentResponseJson(rawText: string): ParsedCommentOutput {
  const cleanRaw = rawText.trim();

  if (/^SKIP\b/i.test(cleanRaw)) {
    const reason = cleanRaw.replace(/^SKIP[:\s-]*/i, "").trim();
    return {
      commentText: "",
      skip: true,
      skipReason: reason || "No genuine comment exists for this post.",
    };
  }

  const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        post_type?: string;
        confidence?: "high" | "medium" | "low";
        options?: Array<{ move?: string; comment?: string; text?: string }>;
        recommended?: string;
        recommended_reason?: string;
        risk?: string;
        skip?: boolean;
        skip_reason?: string;
      };

      if (parsed.skip || /^SKIP\b/i.test(parsed.recommended || "")) {
        return {
          commentText: "",
          skip: true,
          skipReason:
            parsed.skip_reason || "No genuine comment exists for this post.",
        };
      }

      const options: CommentOption[] = Array.isArray(parsed.options)
        ? parsed.options
            .map((o) => ({
              move: String(o.move || "").trim(),
              comment: sanitizePunctuation(String(o.comment || o.text || "")),
            }))
            .filter((o) => o.comment.length > 0)
        : [];

      let recommended = sanitizePunctuation(parsed.recommended || "");
      if (!recommended && options.length > 0) {
        recommended = options[0].comment;
      }

      if (
        (recommended.startsWith('"') && recommended.endsWith('"')) ||
        (recommended.startsWith("'") && recommended.endsWith("'"))
      ) {
        recommended = recommended.slice(1, -1).trim();
      }

      return {
        commentText: recommended,
        postType: parsed.post_type,
        confidence: parsed.confidence,
        options,
        recommendedReason: parsed.recommended_reason,
        risk: parsed.risk,
        skip: false,
      };
    } catch {
      // Fallback to text parsing
    }
  }

  const recommendedMatch = cleanRaw.match(
    /recommended(?:\s*comment)?\s*:\s*["']?([^"\n\r]+)["']?/i,
  );
  if (recommendedMatch && recommendedMatch[1]) {
    return {
      commentText: sanitizePunctuation(recommendedMatch[1].trim()),
      skip: false,
    };
  }

  return {
    commentText: sanitizePunctuation(cleanRaw.replace(/^["']|["']$/g, "")),
    skip: false,
  };
}

export interface ParsedNoteOutput {
  draftText: string;
  options?: NoteOption[];
  recommendedReason?: string;
  risk?: string;
}

export function parseConnectionNoteResponseJson(
  rawText: string,
): ParsedNoteOutput {
  const cleanRaw = rawText.trim();

  const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        options?: Array<{ move?: string; text?: string; note?: string }>;
        recommended?: string;
        recommended_reason?: string;
        risk?: string;
      };

      const options: NoteOption[] = Array.isArray(parsed.options)
        ? parsed.options
            .map((o) => ({
              move: String(o.move || "").trim(),
              text: sanitizePunctuation(String(o.text || o.note || "")),
            }))
            .filter((o) => o.text.length > 0)
        : [];

      let recommended = sanitizePunctuation(parsed.recommended || "");
      if (!recommended && options.length > 0) {
        recommended = options[0].text;
      }

      if (
        (recommended.startsWith('"') && recommended.endsWith('"')) ||
        (recommended.startsWith("'") && recommended.endsWith("'"))
      ) {
        recommended = recommended.slice(1, -1).trim();
      }

      if (recommended.length > 200) {
        recommended = recommended.slice(0, 197).trim() + "...";
      }

      return {
        draftText: recommended,
        options,
        recommendedReason: parsed.recommended_reason,
        risk: parsed.risk,
      };
    } catch {
      // Fallback to text parsing
    }
  }

  const recommendedMatch = cleanRaw.match(
    /recommended(?:\s*note)?\s*:\s*["']?([^"\n\r]+)["']?/i,
  );
  if (recommendedMatch && recommendedMatch[1]) {
    let note = sanitizePunctuation(recommendedMatch[1].trim());
    if (note.length > 200) note = note.slice(0, 197).trim() + "...";
    return {
      draftText: note,
    };
  }

  let finalNote = sanitizePunctuation(cleanRaw.replace(/^["']|["']$/g, ""));
  if (finalNote.length > 200) {
    finalNote = finalNote.slice(0, 197).trim() + "...";
  }

  return {
    draftText: finalNote,
  };
}

export function buildDirectMessageSystemPrompt(
  userProfile?: UserProfile,
  baseFactSheet?: BaseFactSheet,
): string {
  const userGroundTruth = formatUserGroundTruth(userProfile, baseFactSheet);

  return `You write LinkedIn direct messages for the user. They are sent under the user's name.
The goal is a message that reads like a real person typed it to someone specific, and that the recipient would actually want to reply to. Not a template, not a sales sequence, not a cover letter.

${userGroundTruth}

STEP 1: UNDERSTAND THE SITUATION (write this into "understanding" before drafting):
- relationship: who the recipient is relative to the user (1st-degree connection, stranger, existing conversation) and what you actually know about them.
- purpose: why the user is messaging. Use the user's brief and chosen intent if given. If neither is given, pick the most natural reason from what you know; if there is no real reason, a short friendly hello with one genuine question is fine.
- hook: the one specific, true thing to anchor on (their role, company, a recent post, a shared field, something said earlier in the thread). If there is nothing specific, say so and keep the message short instead of inventing one.
- ask: the single, easy thing the recipient can respond to.

STEP 2: WRITE THE MESSAGE:
- Open with "Hi <first name>," or "Hey <first name>," (or nothing, if replying inside an ongoing thread).
- One short paragraph, usually 25 to 70 words. Up to 100 only if the brief needs it (e.g. a referral ask with context). Line breaks are fine, no bullet points.
- State the reason plainly and early. One clear ask, easy to answer. Questions they can answer in a line beat "would love to hop on a call".
- Casual and warm, like a peer. Contractions are good. It should sound typed, not drafted.
- Use what you actually know about them. If you only know their headline, don't pretend you've followed their work.

BY INTENT:
- say_hi: friendly hello, why you're reaching out now, one light genuine question. No agenda dumped on them.
- ask_question: get to the question fast, give just enough context for them to answer.
- job_referral: be upfront that you're interested in a role at their company, mention the role if known, ask something low-pressure (what the team is like, whether they'd be open to a quick question). Don't ask for a referral outright in a first message to a stranger; with a 1st-degree connection you know, a direct polite ask is ok.
- collaborate: what you have in mind in one line, why them specifically, an easy next step.
- congrats: short and specific congrats on what they did, optionally a light follow-up question. No ask attached.
- follow_up: reference the earlier exchange naturally and move it one step forward. Don't guilt-trip about a missing reply.

EXISTING THREAD:
If earlier messages are provided, continue that conversation. Don't re-introduce the user, don't repeat what was already said, and match the tone they've been using. If the last message is from the recipient, reply to it.

AVOID (rewrite any draft that has them):
- "I hope this message finds you well", "I came across your profile", "I'd love to pick your brain", "I'd love to connect", "Reaching out because", "I wanted to reach out", "touch base", "circle back".
- Flattery: "I'm impressed by", "Your journey is inspiring", "Big fan of your work" (unless the user's brief says so).
- Long self-introductions or resume summaries. One clause about the user is plenty.
- Multiple asks, or asking for a call/meeting in the first message to a stranger.
- Aphorisms, "X, not Y" contrasts, lists of three.
- Words: pivotal, transformative, groundbreaking, testament, leverage, unlock, seamless, cutting-edge, synergy, delve, navigate, landscape, elevate, resonate.
- Em dashes or en dashes. Hashtags. Links. Emojis (one is ok in a casual message to a peer).

HARD RULES:
1. Never invent experience, numbers, employers, mutual connections, or prior meetings. Only use facts from the user profile, the brief, the recipient info and the thread.
2. Never claim to have read or seen something of theirs unless it is in the provided data.
3. If the user's brief conflicts with these style rules, follow the brief's content but keep the human style.

OUTPUT FORMAT (valid JSON, fields in this order):
{
  "understanding": {
    "relationship": "...",
    "purpose": "...",
    "hook": "...",
    "ask": "..."
  },
  "options": [
    { "move": "short label, e.g. direct ask", "text": "full message" },
    { "move": "...", "text": "..." },
    { "move": "...", "text": "..." }
  ],
  "recommended": "the single best full message text from options",
  "recommended_reason": "one sentence why",
  "risk": "one line on anything that could land wrong"
}`;
}

export interface ParsedMessageOutput {
  messageText: string;
  options?: MessageOption[];
  recommendedReason?: string;
  risk?: string;
}

export function parseDirectMessageResponseJson(
  rawText: string,
): ParsedMessageOutput {
  const cleanRaw = rawText.trim();

  const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        options?: Array<{ move?: string; text?: string; message?: string }>;
        recommended?: string;
        recommended_reason?: string;
        risk?: string;
      };

      const options: MessageOption[] = Array.isArray(parsed.options)
        ? parsed.options
            .map((o) => ({
              move: String(o.move || "").trim(),
              text: sanitizePunctuation(String(o.text || o.message || "")),
            }))
            .filter((o) => o.text.length > 0)
        : [];

      let recommended = sanitizePunctuation(parsed.recommended || "");
      if (!recommended && options.length > 0) {
        recommended = options[0].text;
      }

      if (
        (recommended.startsWith('"') && recommended.endsWith('"')) ||
        (recommended.startsWith("'") && recommended.endsWith("'"))
      ) {
        recommended = recommended.slice(1, -1).trim();
      }

      return {
        messageText: recommended,
        options,
        recommendedReason: parsed.recommended_reason,
        risk: parsed.risk,
      };
    } catch {
      // Fallback to raw text
    }
  }

  return {
    messageText: sanitizePunctuation(cleanRaw.replace(/^["']|["']$/g, "")),
  };
}
