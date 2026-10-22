interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  service_tier?: string;
  error?: { message: string };
}

/** Fallback model when neither the user nor the build config names one */
export const DEFAULT_MODEL = "gpt-6-luna";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

/**
 * GPT-3.5 and GPT-4.x models reject reasoning_effort; newer and o-series models accept it.
 */
export function supportsReasoningEffort(model: string): boolean {
  return !/^(gpt-3\.5|gpt-4)/i.test(model.trim());
}

export interface StreamChatOptions {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxCompletionTokens: number;
  serviceTier?: "fast" | "default" | "auto";
  /** Hidden reasoning dominates latency for short drafts; only sent to models that accept it */
  reasoningEffort?: ReasoningEffort;
  /** Called with the full text received so far, after every chunk */
  onText?: (fullText: string) => void;
}

export interface StreamChatResult {
  text: string;
  finishReason?: string;
  serviceTier?: string;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as StreamChunk;
    if (data.error?.message) return data.error.message;
  } catch {
    // Keep the HTTP status message
  }
  return `OpenAI API returned HTTP ${response.status}`;
}

/**
 * Calls Chat Completions with stream: true and reads the server-sent events,
 * so callers can show the draft while it is still being written.
 */
export async function streamChatCompletion(
  options: StreamChatOptions,
): Promise<StreamChatResult> {
  const send = (withReasoningEffort: boolean) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        max_completion_tokens: options.maxCompletionTokens,
        stream: true,
        ...(options.serviceTier ? { service_tier: options.serviceTier } : {}),
        ...(withReasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
      }),
    });

  const sendReasoningEffort = Boolean(
    options.reasoningEffort && supportsReasoningEffort(options.model),
  );
  let response = await send(sendReasoningEffort);

  if (!response.ok && sendReasoningEffort && response.status === 400) {
    const errorMsg = await readErrorMessage(response);
    // Unknown models may not accept reasoning_effort; retry once without it
    if (!/reasoning/i.test(errorMsg)) throw new Error(errorMsg);
    response = await send(false);
  }

  if (!response.ok || !response.body) {
    throw new Error(await readErrorMessage(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let text = "";
  let finishReason: string | undefined;
  let serviceTier: string | undefined;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(payload) as StreamChunk;
    } catch {
      return;
    }
    if (chunk.error?.message) throw new Error(chunk.error.message);
    if (chunk.service_tier) serviceTier = chunk.service_tier;

    const choice = chunk.choices?.[0];
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    const delta = choice?.delta?.content;
    if (delta) {
      text += delta;
      options.onText?.(text);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() || "";
    lines.forEach(handleLine);
  }
  if (pending) handleLine(pending);

  // Confirms whether Fast mode was actually applied ("default" means it was downgraded or unsupported)
  console.info(`[Okwu] ${options.model} served with service_tier=${serviceTier || "unknown"}`);

  return { text, finishReason, serviceTier };
}
