import {
  UserProfile,
  StylePreferences,
  BaseFactSheet,
  PostContext,
  CommentAnglePreference,
  GenerateCommentResponse,
  PreviousCommentDraft,
} from "../types/extension-types";
import { resolveEffectiveApiKeyAndModel } from "./openai-service";
import { buildCommentSystemPrompt, DraftStreamParser } from "./prompt-engine";
import { DEFAULT_MODEL, streamChatCompletion } from "./openai-stream";

/**
 * Removes things the model sometimes adds despite instructions: "Name," prefixes and "Hi Name," greetings.
 */
function cleanCommentText(text: string, postAuthorName?: string): string {
  let commentText = text.trim();

  const authorFirstName = postAuthorName?.split(/\s+/)[0]?.trim();
  if (authorFirstName && authorFirstName.length > 1) {
    const escapedName = authorFirstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const namePrefixRegex = new RegExp(`^${escapedName}\\s*,\\s*`, "i");
    commentText = commentText.replace(namePrefixRegex, "").trim();
  }

  commentText = commentText
    .replace(/^(Hey|Hi|Hello)\s+[A-Z][a-zA-Z0-9_.'-]+\s*,\s*/i, "")
    .trim();

  // Capitalize "haha" but leave deliberate casing like "iOS" or "eBay" alone
  const firstWord = commentText.split(/\s/)[0] || "";
  if (firstWord && firstWord === firstWord.toLowerCase()) {
    commentText = commentText.charAt(0).toUpperCase() + commentText.slice(1);
  }
  return commentText;
}

export async function generatePostComment(
  apiKey: string = "",
  model: string = DEFAULT_MODEL,
  userProfile: UserProfile,
  stylePreferences: StylePreferences,
  postContext: PostContext,
  customPromptModifier?: string,
  baseFactSheet?: BaseFactSheet,
  commentAngle?: CommentAnglePreference,
  /** Drafts the user already rejected with 'New Angle' */
  previousDrafts?: PreviousCommentDraft[],
  /** Receives the comment text written so far while the model is still streaming */
  onDraft?: (draftSoFar: string) => void,
): Promise<GenerateCommentResponse> {
  const resolved = resolveEffectiveApiKeyAndModel(
    apiKey,
    model,
    Boolean(apiKey.trim()),
  );
  const cleanKey = resolved.apiKey || apiKey.trim();
  const effectiveModel = resolved.model || model || DEFAULT_MODEL;

  if (!cleanKey) {
    return {
      success: false,
      error:
        "AI service is not configured. Please open Extension Settings to select a plan or enter an API key.",
    };
  }

  const selectedAngle: CommentAnglePreference = commentAngle || "auto";

  const angleGuidance: Record<CommentAnglePreference, string> = {
    auto: "",
    congrats:
      "The user wants a congrats-style comment this time: short, warm, specific to what they achieved.",
    well_wishes:
      "The user wants a well-wishes comment this time: rooting for them on what's next, specific to the post.",
    clarifying_question:
      "The user wants a genuine clarifying question this time, about something the post left open.",
    banter:
      "The user wants light, friendly banter this time, playing along with the situation in the post.",
    peer_take:
      "The user wants a short casual peer reaction or related point this time.",
  };

  const systemPrompt = buildCommentSystemPrompt(userProfile, baseFactSheet);

  let existingCommentsText = "";
  if (postContext.existingComments && postContext.existingComments.length > 0) {
    const sampleList = postContext.existingComments
      .slice(0, 4)
      .map((c) => `- ${c.author}: "${c.text.slice(0, 120)}"`)
      .join("\n");
    existingCommentsText = `
Comments already on the post (don't echo their wording; a simple congrats is still fine if it fits):
${sampleList}
`;
  }

  const authorLine = postContext.postAuthorName
    ? `Post author: ${postContext.postAuthorName}${postContext.postAuthorHeadline ? ` (${postContext.postAuthorHeadline})` : ""}`
    : "";

  const resharedText = postContext.resharedPost
    ? `
The author is resharing this post${postContext.resharedPost.author ? ` by ${postContext.resharedPost.author}` : ""} (the author's own words are in POST above; reply to the author, not the original poster):
"""
${postContext.resharedPost.text.slice(0, 1500)}
"""
`
    : "";

  const attachmentsText = postContext.attachmentText
    ? `
Attached to the post (images, cards, links). Often holds the key detail, e.g. the new role or what was launched:
${postContext.attachmentText}
`
    : "";

  const previousText =
    previousDrafts && previousDrafts.length > 0
      ? `The user passed on these drafts and wants a different angle:
${previousDrafts.map((d) => `- ${d.move ? `[${d.move}] ` : ""}"${d.text}"`).join("\n")}
Write a clearly different comment: use a different move if another one also fits this post, and don't reuse their wording or main point.
`
      : "";

  const preferredMove = angleGuidance[selectedAngle]
    ? `Requested move: ${angleGuidance[selectedAngle]} Use it unless it would land badly on this post (e.g. banter on a layoff post), in which case use the move that fits.\n`
    : "Pick whichever move genuinely fits this post best.\n";

  const userPrompt = `${authorLine ? `${authorLine}\n\n` : ""}POST:
"""
${postContext.postText.slice(0, 3000)}
"""
${resharedText}${attachmentsText}${existingCommentsText}
${stylePreferences.customInstructions ? `User's style preference: ${stylePreferences.customInstructions}\n` : ""}${stylePreferences.thingsToAvoid ? `Avoid: ${stylePreferences.thingsToAvoid}\n` : ""}${customPromptModifier ? `User request: ${customPromptModifier}\n` : ""}${previousText}${preferredMove}
Read the whole post, then reply in the UNDERSTANDING / MOVE / COMMENT format.`;

  const parser = new DraftStreamParser("COMMENT");
  let lastSentDraft = "";

  try {
    const result = await streamChatCompletion({
      apiKey: cleanKey,
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxCompletionTokens: 1200,
      reasoningEffort: "low",
      serviceTier: "fast",
      onText: (fullText) => {
        if (!onDraft) return;
        parser.update(fullText);
        const draftSoFar = cleanCommentText(parser.draft, postContext.postAuthorName);
        if (draftSoFar && draftSoFar !== lastSentDraft) {
          lastSentDraft = draftSoFar;
          onDraft(draftSoFar);
        }
      },
    });

    parser.update(result.text);

    if (parser.skipReason && !parser.hasDraftStarted) {
      return { success: false, error: `Skipped: ${parser.skipReason}` };
    }

    const commentText = cleanCommentText(parser.finalDraft, postContext.postAuthorName);

    if (!commentText) {
      return {
        success: false,
        error: `Model returned an empty comment${result.finishReason ? ` (${result.finishReason})` : ""}. Please retry.`,
      };
    }

    return {
      success: true,
      commentText,
      angleUsed: parser.move || selectedAngle,
      characterCount: commentText.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: `Failed to generate comment: ${message}` };
  }
}
