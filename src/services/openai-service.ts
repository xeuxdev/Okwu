import {
  UserProfile,
  StylePreferences,
  JobTargetSettings,
  TargetProfileData,
  GenerateDraftResponse,
  ParseResumeResponse,
  TestConnectionResponse,
  BaseFactSheet,
  CareerMilestone,
  TechStackCategory,
  LinkedInSelfProfile,
} from "../types/extension-types";
import {
  buildConnectionNoteSystemPrompt,
  parseConnectionNoteResponseJson,
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

interface ParsedBaseFactSheetJson {
  identity?: {
    fullName?: string;
    headline?: string;
    currentRole?: string;
    currentCompany?: string;
    yearsOfExperience?: number;
    location?: string;
    targetRoles?: string[];
  };
  techStack?: {
    languages?: string[];
    frameworks?: string[];
    toolsAndInfra?: string[];
    specializations?: string[];
  };
  careerMilestones?: Array<{
    company?: string;
    role?: string;
    timeframe?: string;
    keyImpact?: string;
    domain?: string;
    technologies?: string[];
  }>;
  conversationHooks?: string[];
  compactBio?: string;
}

export function resolveEffectiveApiKeyAndModel(
  customApiKey: string,
  customModel: string,
  useCustomApiKey: boolean,
): { apiKey: string; model: string; source: "custom" | "cloud" } {
  if (useCustomApiKey && customApiKey.trim()) {
    return {
      apiKey: customApiKey.trim(),
      model: customModel.trim() || "gpt-6-luna",
      source: "custom",
    };
  }

  // Check default cloud key embedded at build time
  const cloudKey =
    typeof __DEFAULT_OPENAI_KEY__ !== "undefined"
      ? __DEFAULT_OPENAI_KEY__.trim()
      : "";
  const cloudModel =
    typeof __DEFAULT_OPENAI_MODEL__ !== "undefined" &&
    __DEFAULT_OPENAI_MODEL__.trim()
      ? __DEFAULT_OPENAI_MODEL__.trim()
      : "gpt-6-luna";

  if (cloudKey) {
    return {
      apiKey: cloudKey,
      model: cloudModel,
      source: "cloud",
    };
  }

  if (customApiKey.trim()) {
    return {
      apiKey: customApiKey.trim(),
      model: customModel.trim() || "gpt-6-luna",
      source: "custom",
    };
  }

  return {
    apiKey: "",
    model: cloudModel || "gpt-6-luna",
    source: "cloud",
  };
}

export async function testOpenAiApiKey(
  apiKey: string,
  model: string = "gpt-6-luna",
): Promise<TestConnectionResponse> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, error: "API key is required." };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-6-luna",
        messages: [{ role: "user", content: 'Say "OK"' }],
        max_completion_tokens: 1000,
      }),
    });

    const data = (await response.json()) as OpenAiChatCompletionResponse;

    if (!response.ok) {
      const errorMsg =
        data.error?.message || `OpenAI API returned HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, modelUsed: model || "gpt-6-luna" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: `Failed to connect to OpenAI: ${message}` };
  }
}

/**
 * Parses the complete resume text and optional LinkedIn profile into an exhaustive, high-density BaseFactSheet.
 * Does not skip past roles, metrics, or technologies.
 */
export async function parseResumeToBaseFactSheet(
  rawResumeText: string,
  apiKey: string = "",
  model: string = "gpt-6-luna",
  linkedInProfile?: LinkedInSelfProfile,
): Promise<ParseResumeResponse> {
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
      error: "AI key or Cloud plan is not available. Please check settings.",
    };
  }

  const systemPrompt = `You are a master career analyst. Your task is to extract a comprehensive, high-density structured Base Fact Sheet from the candidate's complete resume and optional LinkedIn data.
CRITICAL INSTRUCTIONS:
1. DO NOT SKIP ANY ROLES, COMPANIES, OR PROMINENT ACHIEVEMENTS. Capture all career milestones chronologically.
2. In "careerMilestones", extract every company the candidate worked at. For each milestone:
   - "company": company name
   - "role": job title
   - "timeframe": e.g. "2021 - 2023"
   - "keyImpact": 1-2 punchy sentences with quantifiable metrics if present (e.g. "Scaled checkout API handling $50M/mo; reduced p99 latency by 35%")
   - "domain": industry/domain (e.g. "Fintech", "Cloud Infrastructure", "E-commerce", "AI/ML", "Healthtech")
   - "technologies": array of specific tech used in that role
3. In "techStack", categorize ALL technologies mentioned in the resume:
   - "languages": array of programming languages
   - "frameworks": array of frameworks and libraries
   - "toolsAndInfra": array of tools, cloud, databases, CI/CD
   - "specializations": array of architectural or domain specialties
4. "conversationHooks": 4 to 6 unique talking points that can spark peer-to-peer discussions (e.g. "Led migration to Next.js 15", "Built real-time collaboration engine", "Open source contributor").
5. "compactBio": A dense 70 to 100-word ground truth summary of their core expertise and scope.
6. Absolutely NO em dashes. Use hyphens or commas instead.

Respond with valid JSON matching this schema:
{
  "identity": {
    "fullName": "Full Name",
    "headline": "Professional Headline",
    "currentRole": "Current Title",
    "currentCompany": "Current Company",
    "yearsOfExperience": 5,
    "location": "City, Country",
    "targetRoles": ["Target Role 1", "Target Role 2"]
  },
  "techStack": {
    "languages": ["..."],
    "frameworks": ["..."],
    "toolsAndInfra": ["..."],
    "specializations": ["..."]
  },
  "careerMilestones": [
    {
      "company": "Company Name",
      "role": "Role Title",
      "timeframe": "Years",
      "keyImpact": "Key impact with metrics",
      "domain": "Domain",
      "technologies": ["Tech1", "Tech2"]
    }
  ],
  "conversationHooks": ["Hook 1", "Hook 2", "Hook 3", "Hook 4"],
  "compactBio": "High density ground truth summary."
}`;

  const linkedInContext = linkedInProfile
    ? `\n\nLINKEDIN PROFILE OVERRIDES:
Full Name: ${linkedInProfile.fullName}
Headline: ${linkedInProfile.headline}
Current Role: ${linkedInProfile.currentRole}
Location: ${linkedInProfile.location}
Vanity URL: ${linkedInProfile.vanityUrl}`
    : "";

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
          {
            role: "user",
            content: `Here is the candidate's complete resume text:\n\n${rawResumeText.slice(0, 16000)}${linkedInContext}`,
          },
        ],
        max_completion_tokens: 16000,
      }),
    });

    const data = (await response.json()) as OpenAiChatCompletionResponse;

    if (!response.ok) {
      const errorMsg =
        data.error?.message || `OpenAI API returned HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    const choice = data.choices[0];
    const content = choice?.message?.content;
    if (!content) {
      if (choice?.finish_reason === "length") {
        return {
          success: false,
          error:
            "OpenAI token limit was exhausted during internal reasoning (finish_reason: length). Please try re-parsing again.",
        };
      }
      return { success: false, error: "OpenAI returned an empty response." };
    }

    const parsedJson = JSON.parse(content) as ParsedBaseFactSheetJson;

    const identity = {
      fullName: (
        linkedInProfile?.fullName ||
        parsedJson.identity?.fullName ||
        ""
      ).trim(),
      headline: (
        linkedInProfile?.headline ||
        parsedJson.identity?.headline ||
        ""
      ).trim(),
      currentRole: (
        linkedInProfile?.currentRole ||
        parsedJson.identity?.currentRole ||
        ""
      ).trim(),
      currentCompany: (
        linkedInProfile?.currentCompany ||
        parsedJson.identity?.currentCompany ||
        ""
      ).trim(),
      yearsOfExperience: Number(parsedJson.identity?.yearsOfExperience) || 0,
      location: (
        linkedInProfile?.location ||
        parsedJson.identity?.location ||
        ""
      ).trim(),
      targetRoles: Array.isArray(parsedJson.identity?.targetRoles)
        ? parsedJson.identity.targetRoles
            .map((r) => String(r).trim())
            .filter(Boolean)
        : [],
    };

    const techStack: TechStackCategory = {
      languages: Array.isArray(parsedJson.techStack?.languages)
        ? parsedJson.techStack.languages
            .map((s) => String(s).trim())
            .filter(Boolean)
        : [],
      frameworks: Array.isArray(parsedJson.techStack?.frameworks)
        ? parsedJson.techStack.frameworks
            .map((s) => String(s).trim())
            .filter(Boolean)
        : [],
      toolsAndInfra: Array.isArray(parsedJson.techStack?.toolsAndInfra)
        ? parsedJson.techStack.toolsAndInfra
            .map((s) => String(s).trim())
            .filter(Boolean)
        : [],
      specializations: Array.isArray(parsedJson.techStack?.specializations)
        ? parsedJson.techStack.specializations
            .map((s) => String(s).trim())
            .filter(Boolean)
        : [],
    };

    const careerMilestones: CareerMilestone[] = Array.isArray(
      parsedJson.careerMilestones,
    )
      ? parsedJson.careerMilestones.map((m) => ({
          company: String(m.company || "").trim(),
          role: String(m.role || "").trim(),
          timeframe: String(m.timeframe || "").trim(),
          keyImpact: String(m.keyImpact || "")
            .replace(/[\u2014\u2013]/g, "-")
            .trim(),
          domain: String(m.domain || "").trim(),
          technologies: Array.isArray(m.technologies)
            ? m.technologies.map((t) => String(t).trim()).filter(Boolean)
            : [],
        }))
      : [];

    const conversationHooks = Array.isArray(parsedJson.conversationHooks)
      ? parsedJson.conversationHooks
          .map((h) =>
            String(h)
              .replace(/[\u2014\u2013]/g, "-")
              .trim(),
          )
          .filter(Boolean)
      : [];

    const compactBio = (parsedJson.compactBio || "")
      .replace(/[\u2014\u2013]/g, "-")
      .trim();

    const baseFactSheet: BaseFactSheet = {
      identity,
      techStack,
      careerMilestones,
      conversationHooks,
      compactBio,
      linkedInSyncedAt: linkedInProfile ? new Date().toISOString() : undefined,
      resumeParsedAt: new Date().toISOString(),
    };

    // Also derive backwards-compatible UserProfile
    const allSkills = [
      ...techStack.languages,
      ...techStack.frameworks,
      ...techStack.toolsAndInfra,
      ...techStack.specializations,
    ];

    const profile: UserProfile = {
      fullName: identity.fullName,
      currentRole: identity.currentRole,
      skills: allSkills.slice(0, 15),
      experienceHighlights: careerMilestones
        .map((m) => `${m.role} at ${m.company}: ${m.keyImpact}`)
        .slice(0, 5),
      summary: compactBio || identity.headline,
    };

    return { success: true, profile, baseFactSheet };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown parsing error";
    return {
      success: false,
      error: `Failed to parse resume into Base Fact Sheet: ${message}`,
    };
  }
}

/**
 * Dynamically selects the single most relevant milestone and tech overlap for the target person.
 * Produces an ultra-lean context snippet (~70 to 110 tokens) for note generation.
 */
export function selectRelevantFactsForTarget(
  baseFactSheet: BaseFactSheet,
  targetProfile: TargetProfileData,
  jobTarget?: JobTargetSettings,
): {
  promptSnippet: string;
  matchedHighlight: string;
} {
  const expTokens = (targetProfile.experiences || [])
    .map((e) => `${e.company} ${e.title} ${e.description || ""}`)
    .join(" ");

  const eduTokens = (targetProfile.education || [])
    .map((ed) => `${ed.school} ${ed.degree || ""} ${ed.fieldOfStudy || ""}`)
    .join(" ");

  const featTokens = (targetProfile.featuredItems || [])
    .map((f) => `${f.title} ${f.category || ""} ${f.description || ""}`)
    .join(" ");

  const targetTokens = [
    targetProfile.companyOrRole,
    targetProfile.headline,
    targetProfile.aboutExcerpt,
    targetProfile.recentPost,
    targetProfile.recentActivity,
    featTokens,
    expTokens,
    eduTokens,
    jobTarget?.targetCompany,
    jobTarget?.targetRole,
    jobTarget?.customTalkingPoint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Find most relevant milestone
  let bestMilestone = baseFactSheet.careerMilestones[0];
  let highestScore = -1;

  for (const milestone of baseFactSheet.careerMilestones) {
    let score = 0;
    const companyLower = milestone.company.toLowerCase();
    const domainLower = milestone.domain.toLowerCase();
    const roleLower = milestone.role.toLowerCase();

    // Check if target company or domain matches
    if (targetTokens.includes(companyLower)) score += 10;
    if (targetTokens.includes(domainLower)) score += 6;
    if (targetTokens.includes(roleLower)) score += 4;

    // Check technology overlaps
    for (const tech of milestone.technologies) {
      if (targetTokens.includes(tech.toLowerCase())) {
        score += 3;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMilestone = milestone;
    }
  }

  // Find overlapping skills from tech stack
  const allTech = [
    ...baseFactSheet.techStack.languages,
    ...baseFactSheet.techStack.frameworks,
    ...baseFactSheet.techStack.toolsAndInfra,
    ...baseFactSheet.techStack.specializations,
  ];

  const matchedTech = allTech
    .filter((tech) => targetTokens.includes(tech.toLowerCase()))
    .slice(0, 4);

  const fallbackTech =
    matchedTech.length > 0 ? matchedTech : allTech.slice(0, 4);

  // Pick best conversation hook
  const matchedHook =
    baseFactSheet.conversationHooks.find((h) =>
      targetTokens
        .split(/\s+/)
        .some((token) => token.length > 3 && h.toLowerCase().includes(token)),
    ) ||
    baseFactSheet.conversationHooks[0] ||
    "";

  const matchedHighlight = bestMilestone
    ? `${bestMilestone.role} at ${bestMilestone.company}: ${bestMilestone.keyImpact}`
    : baseFactSheet.identity.currentRole;

  const promptSnippet = `RELEVANT SENDER GROUND TRUTH:
Name: ${baseFactSheet.identity.fullName || "Candidate"}
Current: ${baseFactSheet.identity.currentRole || "Specialist"}${baseFactSheet.identity.currentCompany ? ` at ${baseFactSheet.identity.currentCompany}` : ""}
Relevant Past Impact: ${matchedHighlight}
Shared Tech / Domain: ${fallbackTech.join(", ")}${bestMilestone?.domain ? ` (${bestMilestone.domain})` : ""}
${matchedHook ? `Key Talking Point: ${matchedHook}` : ""}`;

  return {
    promptSnippet,
    matchedHighlight,
  };
}

export async function generateConnectionNote(
  apiKey: string = "",
  model: string = "gpt-6-luna",
  userProfile: UserProfile,
  stylePreferences: StylePreferences,
  targetProfile: TargetProfileData,
  customPromptModifier?: string,
  jobTargetSettings?: JobTargetSettings,
  baseFactSheet?: BaseFactSheet,
): Promise<GenerateDraftResponse> {
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

  const toneGuidelines: Record<string, string> = {
    conversational:
      "Warm, natural, peer-to-peer, friendly and polite without being stiff.",
    professional: "Polite, respectful, business-appropriate, and crisp.",
    direct:
      "Very concise, directly stating common ground or value, no filler words.",
    enthusiastic:
      "High energy, genuinely appreciative of their work or shared passion.",
  };

  const selectedTone =
    toneGuidelines[stylePreferences.tone] || toneGuidelines.conversational;

  const isJobTargeting = Boolean(
    jobTargetSettings?.enabled && jobTargetSettings.targetCompany,
  );

  let jobTargetPromptContext = "";
  if (isJobTargeting && jobTargetSettings) {
    const statusLabels: Record<string, string> = {
      applied:
        "Applied for role (following up politely to meet future teammates)",
      planning_to_apply:
        "Planning to apply soon (seeking insider insights on culture/tech)",
      dream_company:
        "Dream target company (aiming to build a relationship first)",
    };

    const statusText =
      statusLabels[jobTargetSettings.applicationStatus] || statusLabels.applied;

    const hookDescriptions: Record<string, string> = {
      culture_question: `Ask a low-pressure, genuine question about team engineering culture, shipping pace, or developer experience at ${jobTargetSettings.targetCompany}.`,
      tech_discussion: `Ask an engaging technical question about how their team tackles challenges${jobTargetSettings.customTalkingPoint ? ` with ${jobTargetSettings.customTalkingPoint}` : " in their stack"}.`,
      project_appreciation: `Compliment an impressive product launch or initiative at ${jobTargetSettings.targetCompany} and ask an open-ended question about what they learned building it.`,
      applied_conversation: `Mention you submitted an application for ${jobTargetSettings.targetRole || "the role"} at ${jobTargetSettings.targetCompany}, connect peer-to-peer, and ask what they like most about the team.`,
      direct_inquiry: `Direct, polite message expressing mutual domain focus for ${jobTargetSettings.targetRole || "the role"} at ${jobTargetSettings.targetCompany}, asking a quick question on what skills their team values most.`,
    };

    const hookInstruction =
      hookDescriptions[jobTargetSettings.conversationHook] ||
      hookDescriptions.culture_question;

    jobTargetPromptContext = `
TARGET COMPANY NETWORKING MODE:
Target Company: ${jobTargetSettings.targetCompany}
Target Role: ${jobTargetSettings.targetRole || userProfile.currentRole}
Application Status: ${statusText}
Conversation Starter Strategy: ${hookInstruction}
${jobTargetSettings.customTalkingPoint ? `Custom Topic/Context: ${jobTargetSettings.customTalkingPoint}` : ""}

PRIMARY OBJECTIVE:
Your goal is to connect with employees at this target company in a way that turns into a real two-way conversation and improves employment chances.
CRITICAL CONVERSATIONAL RULES:
- Never sound transactional or needy. Do not ask for a referral, interview, or resume review directly.
- Sound like an insightful, curious peer or dedicated specialist.
- Always include or end with an engaging open loop or thoughtful question that makes the person happy to reply.
- Must fit within 200 characters total.`;
  }

  const systemPrompt = buildConnectionNoteSystemPrompt(
    userProfile,
    baseFactSheet,
  );

  let senderContext = "";
  let matchedHighlight = "";

  if (
    baseFactSheet &&
    (baseFactSheet.careerMilestones.length > 0 || baseFactSheet.compactBio)
  ) {
    const matched = selectRelevantFactsForTarget(
      baseFactSheet,
      targetProfile,
      jobTargetSettings,
    );
    senderContext = matched.promptSnippet;
    matchedHighlight = matched.matchedHighlight;
  } else {
    senderContext = `SENDER INFO:
Name: ${userProfile.fullName || "Candidate"}
Role: ${userProfile.currentRole || "Specialist"}
Skills: ${(userProfile.skills || []).slice(0, 8).join(", ")}
Key Highlight: ${(userProfile.experienceHighlights || [])[0] || userProfile.summary || ""}`;
  }

  const expLines = (targetProfile.experiences || [])
    .slice(0, 3)
    .map(
      (e) =>
        `- ${e.title} at ${e.company}${e.timeframe ? ` (${e.timeframe})` : ""}${e.description ? `: ${e.description.slice(0, 100)}` : ""}`,
    )
    .join("\n");

  const eduLines = (targetProfile.education || [])
    .slice(0, 2)
    .map(
      (ed) =>
        `- ${ed.school}${ed.degree ? `, ${ed.degree}` : ""}${ed.fieldOfStudy ? ` in ${ed.fieldOfStudy}` : ""}`,
    )
    .join("\n");

  const featLines = (targetProfile.featuredItems || [])
    .slice(0, 3)
    .map(
      (f) =>
        `- ${f.title}${f.category ? ` (${f.category})` : ""}${f.description ? `: ${f.description.slice(0, 120)}` : ""}`,
    )
    .join("\n");

  const recentContent =
    targetProfile.recentPost || targetProfile.recentActivity;

  const targetContext = `TARGET PERSON:
Name: ${targetProfile.fullName || "there"}
Headline: ${targetProfile.headline || "Professional"}
Current Role / Org: ${targetProfile.companyOrRole || "Industry Leader"}
Location: ${targetProfile.location || "N/A"}
${targetProfile.aboutExcerpt ? `About Summary: ${targetProfile.aboutExcerpt.slice(0, 300)}` : ""}
${featLines ? `Featured Projects / Portfolio:\n${featLines}` : ""}
${expLines ? `Work History / Experiences:\n${expLines}` : ""}
${eduLines ? `Education Background:\n${eduLines}` : ""}
${recentContent ? `Recent Post / Shared Insight: "${recentContent.slice(0, 250)}"` : ""}`;

  const userInstructions = `ADDITIONAL PREFERENCES:
Custom instructions: ${stylePreferences.customInstructions || "Sharp, grounded engineer typing quickly"}
Things to avoid: ${stylePreferences.thingsToAvoid || "Generic templates, corporate flattery"}
Sample note: ${stylePreferences.sampleNote || "None"}
Tone: ${selectedTone}
${jobTargetPromptContext}
${customPromptModifier ? `User tweak request: ${customPromptModifier}` : ""}`;

  const promptContent = `${senderContext}\n\n${targetContext}\n\n${userInstructions}\n\nGenerate 3 connection note options strictly under 200 characters each (aim 120-180 chars). Pick recommended note. Respond in valid JSON.`;

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
          { role: "user", content: promptContent },
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

    const choice = data.choices[0];
    const rawContent = choice?.message?.content?.trim() || "";

    if (!rawContent && choice?.finish_reason === "length") {
      return {
        success: false,
        error:
          "OpenAI token limit was reached during reasoning before generating the note.",
      };
    }

    const parsed = parseConnectionNoteResponseJson(rawContent);
    let draftText = parsed.draftText.trim();

    // Strip quotation marks
    if (
      (draftText.startsWith('"') && draftText.endsWith('"')) ||
      (draftText.startsWith("'") && draftText.endsWith("'"))
    ) {
      draftText = draftText.slice(1, -1).trim();
    }

    // Clean up punctuation and em dashes
    draftText = sanitizePunctuation(draftText);

    // Enforce 200 character ceiling
    if (draftText.length > 200) {
      const truncated = draftText.slice(0, 196);
      const lastPeriod = truncated.lastIndexOf(".");
      if (lastPeriod > 120) {
        draftText = truncated.slice(0, lastPeriod + 1);
      } else {
        const lastSpace = truncated.lastIndexOf(" ");
        draftText =
          (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
      }
    }

    return {
      success: true,
      draftText,
      characterCount: draftText.length,
      matchedHighlight: matchedHighlight || undefined,
      options: parsed.options,
      recommendedReason: parsed.recommendedReason,
      risk: parsed.risk,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: `OpenAI connection failed: ${message}` };
  }
}
