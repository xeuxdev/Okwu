import {
  UserProfile,
  StylePreferences,
  BaseFactSheet,
  PostContext,
  CommentAnglePreference,
  GenerateCommentResponse,
} from "../types/extension-types";
import { resolveEffectiveApiKeyAndModel } from "./openai-service";

interface OpenAiChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string;
  }>;
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

export async function generatePostComment(
  apiKey: string = "",
  model: string = "gpt-6-luna",
  _userProfile: UserProfile,
  stylePreferences: StylePreferences,
  postContext: PostContext,
  customPromptModifier?: string,
  _baseFactSheet?: BaseFactSheet,
  commentAngle?: CommentAnglePreference,
): Promise<GenerateCommentResponse> {
  const resolved = resolveEffectiveApiKeyAndModel(
    apiKey,
    model,
    Boolean(apiKey.trim()),
  );
  const cleanKey = resolved.apiKey || apiKey.trim();
  const effectiveModel = resolved.model || model || "gpt-6-luna";

  if (!cleanKey) {
    return {
      success: false,
      error:
        "AI service is not configured. Please open Extension Settings to select a plan or enter an API key.",
    };
  }

  const selectedAngle = commentAngle || "grounded_peer";

  const angleInstructions: Record<CommentAnglePreference, string> = {
    grounded_peer:
      "If celebratory, celebrate them or their milestone first, then share a grounded, relatable peer observation directly tied to the post. Use a punchy declarative statement; do not force a question.",
    witty_perspective:
      "If celebratory, celebrate them or their milestone first, then drop lighthearted, witty banter or relatable humor matching the post's reality. Keep it punchy; no questions needed.",
    counter_intuitive:
      "If celebratory, celebrate them or their milestone first, then add a knowing nod to the hidden friction or grind behind that win. Use a declarative statement; do not ask a question.",
    tactical_question:
      "If the post is celebratory, celebrate the win first and drop a relevant observation or witty remark (avoid grilling them with questions). On discussion posts, ask a brief, curiosity-driven peer question.",
  };

  const systemPrompt = `You write short, natural, human comments on LinkedIn posts.
You sound like a smart, friendly colleague texting on Slack or speaking at a coffee break. You NEVER sound like an AI, a corporate bot, or a lecturing professor.

CRITICAL RULES TO AVOID "AI SLOP":
1. NEVER PREFIX WITH A NAME:
   - NEVER start the comment with "[Name]," (e.g. NEVER write "Nathan,", "Afolabi,", "Hey John,"). Real people almost never do this on LinkedIn posts, and it screams bot. Start straight into the reaction or observation.
2. ACCURATELY UNDERSTAND WHO DID WHAT IN THE POST BODY:
   - Read the POST BODY carefully to understand what the author is actually sharing:
     * Distinguish who built/launched a product versus who is sponsoring, investing, playing, or congratulating!
     * If the author says they got addicted to a game and their company (e.g. Salary Index) became head sponsor, do NOT congratulate the author as if they built or launched the game! React to their smart sponsorship play, the game's viral traction, or the in-game advertising angle.
     * If the author congratulates someone else (e.g. "Congratulations to Shalom"), do not confuse the author with the person being congratulated.
     * Ground your comment directly in the concrete facts mentioned in the post body (e.g. 1M visitors, in-game ads, specific metrics).
3. CELEBRATORY POSTS & MILESTONES (TWO-STEP STRUCTURE):
   - When a post has a celebratory tone or celebrates a milestone (e.g. product launch, funding round, revenue/user metric, promotion, new role, graduation, certification, award, anniversary, personal/team achievement):
     * STEP 1 - RESPOND FIRST CELEBRATING THEM OR THE MILESTONE: Open with a punchy, genuine congratulatory nod acknowledging the specific accomplishment (e.g. "Huge congrats on the launch!", "Big congratulations on hitting 100k users!", "Huge milestone on closing the round!", "Massive congrats on the new role!").
     * STEP 2 - DROP SOMETHING FUNNY OR CLOSELY RELATED TO THE POST: Immediately follow the celebration with EITHER:
       (a) Something funny or lighthearted peer banter matching the reality of the post (e.g. finally getting to sleep after launch week, surviving production deployments, dealing with 10x calendar meetings, celebrating with pizza), OR
       (b) Something substantive and directly related to what was shared in the post body (e.g. noting a specific metric, surviving a rigorous cohort filter, or a smart strategic choice).
     * THE COMMENT MUST CLOSELY MATCH THE POST: Ground both the celebration and the witty/relevant follow-up strictly in what actually happened in the post. Never use disconnected generic humor or irrelevant trivia.
     * NEVER LEAVE EMPTY FLUFF: Never leave generic bot praise like "Congrats! So well deserved!" or "Congratulations, keep shining!".
     * DO NOT ASK QUESTIONS ON CELEBRATORY POSTS: When someone is celebrating a win, celebrate them and drop a witty or relatable remark. Do not interrogate them with questions like "What was the hardest part?" or "What's next?".
4. NOT ALL COMMENTS NEED TO BE QUESTIONS (STATEMENTS OVER QUESTIONS):
   - Comments DO NOT need to be questions! In fact, most great LinkedIn comments are NOT questions.
   - Default to natural declarative statements, relatable peer observations, dry banter, or nods to the grind.
   - Do NOT tack on artificial, forced questions at the end (e.g. "What do you think?", "How are you handling X?", "What's your biggest takeaway?").
   - Only ask a question if the angle explicitly requires it AND it is an analytical discussion post where a question feels completely effortless.
5. TALK DIRECTLY TO THE AUTHOR:
   - Always speak directly to the person ("you", "your team", "your cohort") without using their name as a prefix.
   - NEVER write a detached third-person essay or philosophical reflection about the topic.
6. ABSOLUTELY BANNED OPENINGS (NEVER START WITH THESE):
   - "The real value of..."
   - "The true measure/test of..."
   - "The hard part isn't X, it's Y..."
   - "It's all about..." or "At the end of the day..."
   - "This underscores/highlights the importance of..."
   - "A great reminder that..."
   - "In today's fast-paced..."
7. BREVITY IS MANDATORY:
   - 1 or 2 punchy sentences ONLY.
   - Strictly 10 to 28 words maximum.
   - Do NOT use semicolons (;). Use casual punctuation: commas, periods, or exclamation marks.
   - No em dashes or en dashes: use standard commas, colons, or clean periods.
   - No bullet points, lists, or hashtags.
   - No generic bot cliches on their own: never just "Kudos", "Inspiring", "Great post", "Thanks for sharing", or "Can't wait to see where this journey takes you".
8. EXAMPLES OF HUMAN VS AI:
   - Bad (AI slop / Preachy): "The real value of a graduate programme shows up when structured learning turns into sound judgment in day-to-day banking work."
   - Bad (Empty bot congrats): "Congratulations on the launch! So well deserved, best of luck on your career journey!"
   - Bad (Forced interrogation on celebratory post): "Huge congrats on the launch! What was your tech stack and how did you scale the database under load?"
   - Bad (Wrong context / Named bot): "Nathan, 1M visitors in two days is wild, and getting stuck in the game for four hours says plenty about its pull. Huge launch."
   - Good (Celebratory + witty follow-up matching post): "Congrats on the launch! Hope you actually get to sleep tonight after staring at production logs all weekend."
   - Good (Celebratory + funny reality matching promotion): "Massive congrats on making partner! Well earned, though condolences on your new calendar."
   - Good (Celebratory + substantive peer observation matching post): "Congrats on the launch! 1M visitors in two days is wild traction, and locking in in-game ads with Salary Index so early is a genius play."
   - Good (Celebratory + milestone nod matching post): "Big congrats finishing that Stanbic cohort! Surviving that filter is serious work, definitely earned some downtime before floor hours kick in."
   - Good (Human peer observation without questions): "Sponsoring in-game billboards is such a smart play for Salary Index. 1M visitors in two days is wild traction."
   - Good (Declarative peer statement): "Cache invalidation under spike traffic is always where the fun begins."
9. OUTPUT FORMAT:
   - Output ONLY the raw comment text. Do NOT wrap in quotes.`;

  // Format existing comments to avoid repeating them
  let existingCommentsText = "";
  if (postContext.existingComments && postContext.existingComments.length > 0) {
    const sampleList = postContext.existingComments
      .slice(0, 4)
      .map((c) => `- ${c.author}: "${c.text.slice(0, 80)}"`)
      .join("\n");
    existingCommentsText = `
CLICHES ALREADY POSTED BY OTHERS (DO NOT REPEAT THESE PHRASES OR TONES):
${sampleList}
Ensure your comment takes a completely distinct, thoughtful, and non-cliché direction.`;
  }

  const authorLine = postContext.postAuthorName
    ? `Post Author: ${postContext.postAuthorName}${postContext.postAuthorHeadline ? ` (${postContext.postAuthorHeadline})` : ""}`
    : "";

  const userPrompt = `${authorLine ? `${authorLine}\n\n` : ""}POST BODY TO COMMENT ON:
"""
${postContext.postText.slice(0, 1200)}
"""
${existingCommentsText}
${stylePreferences.customInstructions ? `Custom Style: ${stylePreferences.customInstructions}\n` : ""}${stylePreferences.thingsToAvoid ? `Avoid: ${stylePreferences.thingsToAvoid}\n` : ""}${customPromptModifier ? `Focus: ${customPromptModifier}\n` : ""}
Desired angle: ${angleInstructions[selectedAngle]}

Write a natural, 1-2 sentence human comment strictly responding to what the author is sharing in the post body (max 28 words):
- If the post is celebratory or marks a milestone: FIRST celebrate them or the milestone directly, then either drop something funny/witty or something directly related to the post. Ensure the comment matches the post.
- Not all comments need to be questions; prefer punchy declarative statements, relatable banter, or peer observations over forced questions.
- Never prefix with the author's name, never sound generic or like empty bot fluff:`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel || "gpt-6-luna",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 1500,
      }),
    });

    const data = (await response.json()) as OpenAiChatCompletionResponse;

    if (!response.ok) {
      const errorMsg =
        data.error?.message || `OpenAI API returned HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    const choice = data.choices?.[0];
    let commentText = choice?.message?.content?.trim() || "";

    if (!commentText) {
      const reason = choice?.finish_reason;
      return {
        success: false,
        error: `Model returned empty response${reason ? ` (${reason})` : ""}. Please retry.`,
      };
    }

    // Strip quotation marks wrapping the whole comment
    if (
      (commentText.startsWith('"') && commentText.endsWith('"')) ||
      (commentText.startsWith("'") && commentText.endsWith("'"))
    ) {
      commentText = commentText.slice(1, -1).trim();
    }

    // Strip accidental author name prefixing (e.g. "Nathan, " or "Afolabi, ") without stripping valid openers like "Congrats, " or "Honestly, "
    const authorFirstName = postContext.postAuthorName?.split(/\s+/)[0]?.trim();
    if (authorFirstName && authorFirstName.length > 1) {
      const escapedName = authorFirstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const namePrefixRegex = new RegExp(`^${escapedName}\\s*,\\s*`, "i");
      commentText = commentText.replace(namePrefixRegex, "").trim();
    }
    // Also strip generic greetings like "Hey Nathan," or "Hi [Name],"
    commentText = commentText
      .replace(/^(Hey|Hi|Hello)\s+[A-Z][a-zA-Z0-9_.'-]+\s*,\s*/i, "")
      .trim();

    if (commentText.length > 0) {
      commentText = commentText.charAt(0).toUpperCase() + commentText.slice(1);
    }

    // Strip em dashes and en dashes
    commentText = commentText.replace(/[\u2014\u2013]/g, "-").trim();

    return {
      success: true,
      commentText,
      angleUsed: selectedAngle,
      characterCount: commentText.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: `Failed to generate comment: ${message}` };
  }
}
