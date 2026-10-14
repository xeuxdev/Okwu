import {
  UserProfile,
  StylePreferences,
  BaseFactSheet,
  PostContext,
  CommentAnglePreference,
  GenerateCommentResponse,
} from "../types/extension-types";
import { resolveEffectiveApiKeyAndModel } from "./openai-service";
import {
  buildCommentSystemPrompt,
  parseCommentResponseJson,
  sanitizePunctuation,
} from "./prompt-engine";

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
  userProfile: UserProfile,
  stylePreferences: StylePreferences,
  postContext: PostContext,
  customPromptModifier?: string,
  baseFactSheet?: BaseFactSheet,
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

  const preferredMove = angleGuidance[selectedAngle]
    ? `Requested move: ${angleGuidance[selectedAngle]} Make it the recommended option, unless it would land badly on this post (e.g. banter on a layoff post), in which case recommend what fits and say why.\n`
    : "Pick whichever move genuinely fits this post best.\n";

  const userPrompt = `${authorLine ? `${authorLine}\n\n` : ""}POST:
"""
${postContext.postText.slice(0, 3000)}
"""
${resharedText}${attachmentsText}${existingCommentsText}
${stylePreferences.customInstructions ? `User's style preference: ${stylePreferences.customInstructions}\n` : ""}${stylePreferences.thingsToAvoid ? `Avoid: ${stylePreferences.thingsToAvoid}\n` : ""}${customPromptModifier ? `User request: ${customPromptModifier}\n` : ""}${preferredMove}
Read the whole post and fill in "understanding" first, then write 3 options grounded in it. Respond in valid JSON matching the schema.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel || "gpt-6-luna",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 2500,
      }),
    });

    const data = (await response.json()) as OpenAiChatCompletionResponse;

    if (!response.ok) {
      const errorMsg =
        data.error?.message || `OpenAI API returned HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    const choice = data.choices?.[0];
    const rawContent = choice?.message?.content?.trim() || "";

    if (!rawContent) {
      const reason = choice?.finish_reason;
      return {
        success: false,
        error: `Model returned empty response${reason ? ` (${reason})` : ""}. Please retry.`,
      };
    }

    const parsed = parseCommentResponseJson(rawContent);

    if (parsed.skip) {
      return {
        success: false,
        error: `Skipped: ${parsed.skipReason || "Post does not warrant an authentic comment."}`,
      };
    }

    let commentText = parsed.commentText.trim();

    // Strip accidental author name prefixing
    const authorFirstName = postContext.postAuthorName?.split(/\s+/)[0]?.trim();
    if (authorFirstName && authorFirstName.length > 1) {
      const escapedName = authorFirstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const namePrefixRegex = new RegExp(`^${escapedName}\\s*,\\s*`, "i");
      commentText = commentText.replace(namePrefixRegex, "").trim();
    }

    // Strip generic greetings
    commentText = commentText
      .replace(/^(Hey|Hi|Hello)\s+[A-Z][a-zA-Z0-9_.'-]+\s*,\s*/i, "")
      .trim();

    // Sanitize punctuation and quotes
    commentText = sanitizePunctuation(commentText);

    if (commentText.length > 0) {
      commentText = commentText.charAt(0).toUpperCase() + commentText.slice(1);
    }

    if (!commentText) {
      return {
        success: false,
        error: "Unable to generate a suitable comment option. Please retry.",
      };
    }

    return {
      success: true,
      commentText,
      angleUsed: selectedAngle,
      characterCount: commentText.length,
      postType: parsed.postType,
      confidence: parsed.confidence,
      options: parsed.options,
      recommendedReason: parsed.recommendedReason,
      risk: parsed.risk,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: `Failed to generate comment: ${message}` };
  }
}
