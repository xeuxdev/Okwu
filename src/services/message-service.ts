import {
  UserProfile,
  StylePreferences,
  BaseFactSheet,
  JobTargetSettings,
  ConversationContext,
  MessageIntent,
  GenerateMessageResponse,
} from "../types/extension-types";
import {
  resolveEffectiveApiKeyAndModel,
  selectRelevantFactsForTarget,
} from "./openai-service";
import { buildDirectMessageSystemPrompt, DraftStreamParser } from "./prompt-engine";
import { DEFAULT_MODEL, streamChatCompletion } from "./openai-stream";

const INTENT_GUIDANCE: Record<MessageIntent, string> = {
  auto: "No intent chosen. Pick the most natural reason to message this person from what you know.",
  say_hi: "say_hi: a friendly hello / reconnect.",
  ask_question: "ask_question: the user wants to ask them something.",
  job_referral: "job_referral: the user is interested in a role at their company.",
  collaborate: "collaborate: the user wants to propose working together on something.",
  congrats: "congrats: congratulate them on something recent.",
  follow_up: "follow_up: follow up on an earlier exchange.",
};

function formatRecipientContext(conversation: ConversationContext): string {
  const profile = conversation.recipientProfile;
  const lines = [
    `Name: ${conversation.recipientName || "Unknown"}`,
    conversation.recipientHeadline ? `Headline: ${conversation.recipientHeadline}` : "",
    conversation.connectionDegree ? `Connection: ${conversation.connectionDegree} degree` : "",
    conversation.otherRecipients && conversation.otherRecipients.length > 0
      ? `Group thread, also includes: ${conversation.otherRecipients.join(", ")}`
      : "",
  ];

  if (profile) {
    if (profile.location) lines.push(`Location: ${profile.location}`);
    if (profile.aboutExcerpt) lines.push(`About: ${profile.aboutExcerpt.slice(0, 400)}`);
    const exp = (profile.experiences || [])
      .slice(0, 3)
      .map((e) => `- ${e.title} at ${e.company}${e.timeframe ? ` (${e.timeframe})` : ""}`)
      .join("\n");
    if (exp) lines.push(`Experience:\n${exp}`);
    const edu = (profile.education || [])
      .slice(0, 2)
      .map((ed) => `- ${ed.school}${ed.degree ? `, ${ed.degree}` : ""}`)
      .join("\n");
    if (edu) lines.push(`Education:\n${edu}`);
    const recent = profile.recentPost || profile.recentActivity;
    if (recent) lines.push(`Their recent post: "${recent.slice(0, 400)}"`);
  }

  return `RECIPIENT:\n${lines.filter(Boolean).join("\n")}`;
}

function formatThreadHistory(conversation: ConversationContext): string {
  if (conversation.history.length === 0) {
    return "THREAD: New conversation, no earlier messages.";
  }
  const firstName = conversation.recipientName.split(/\s+/)[0] || "Them";
  const lines = conversation.history
    .slice(-8)
    .map((m) => `${m.fromMe ? "User" : firstName}: ${m.text.slice(0, 400)}`)
    .join("\n");
  return `THREAD SO FAR (oldest first):\n${lines}`;
}

export async function generateDirectMessage(
  apiKey: string = "",
  model: string = DEFAULT_MODEL,
  userProfile: UserProfile,
  stylePreferences: StylePreferences,
  conversation: ConversationContext,
  intent: MessageIntent = "auto",
  brief?: string,
  baseFactSheet?: BaseFactSheet,
  jobTargetSettings?: JobTargetSettings,
  /** Receives the message text written so far while the model is still streaming */
  onDraft?: (draftSoFar: string) => void,
): Promise<GenerateMessageResponse> {
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

  const systemPrompt = buildDirectMessageSystemPrompt(userProfile, baseFactSheet);

  // Surface the most relevant slice of the user's background for this recipient
  let relevantSender = "";
  if (
    baseFactSheet &&
    baseFactSheet.careerMilestones.length > 0 &&
    conversation.recipientProfile
  ) {
    relevantSender = selectRelevantFactsForTarget(
      baseFactSheet,
      conversation.recipientProfile,
      jobTargetSettings,
    ).promptSnippet;
  }

  const jobContext =
    intent === "job_referral" && jobTargetSettings?.enabled && jobTargetSettings.targetCompany
      ? `JOB CONTEXT (from user's settings): interested in ${jobTargetSettings.targetRole || "a role"} at ${jobTargetSettings.targetCompany}, status: ${jobTargetSettings.applicationStatus.replace(/_/g, " ")}.${jobTargetSettings.customTalkingPoint ? ` Talking point: ${jobTargetSettings.customTalkingPoint}` : ""}`
      : "";

  const userPrompt = [
    formatRecipientContext(conversation),
    formatThreadHistory(conversation),
    relevantSender,
    jobContext,
    `INTENT: ${INTENT_GUIDANCE[intent] || INTENT_GUIDANCE.auto}`,
    brief
      ? `USER'S BRIEF (rough notes the user typed; this is what they want to say, rewrite it as a natural message and keep every concrete fact in it):\n"""\n${brief.slice(0, 1000)}\n"""`
      : "",
    stylePreferences.customInstructions
      ? `User's style preference: ${stylePreferences.customInstructions}`
      : "",
    stylePreferences.thingsToAvoid ? `Avoid: ${stylePreferences.thingsToAvoid}` : "",
    `Reply in the UNDERSTANDING / MOVE / MESSAGE format.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const parser = new DraftStreamParser("MESSAGE");
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
        const draftSoFar = parser.draft;
        if (draftSoFar && draftSoFar !== lastSentDraft) {
          lastSentDraft = draftSoFar;
          onDraft(draftSoFar);
        }
      },
    });

    parser.update(result.text);
    const messageText = parser.finalDraft;

    if (!messageText) {
      return {
        success: false,
        error: `Model returned an empty message${result.finishReason ? ` (${result.finishReason})` : ""}. Please retry.`,
      };
    }

    return { success: true, messageText };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: `Failed to generate message: ${message}` };
  }
}
