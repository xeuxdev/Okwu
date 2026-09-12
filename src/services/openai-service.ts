import {
  UserProfile,
  StylePreferences,
  JobTargetSettings,
  TargetProfileData,
  GenerateDraftResponse,
  ParseResumeResponse,
  TestConnectionResponse
} from '../types/extension-types';

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

interface ParsedResumeJson {
  fullName?: string;
  currentRole?: string;
  skills?: string[];
  experienceHighlights?: string[];
  summary?: string;
}

export async function testOpenAiApiKey(
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<TestConnectionResponse> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, error: 'API key is required.' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Say "OK"' }
        ],
        max_tokens: 5,
        temperature: 0
      })
    });

    const data = (await response.json()) as OpenAiChatCompletionResponse;

    if (!response.ok) {
      const errorMsg = data.error?.message || `OpenAI API returned HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, modelUsed: model || 'gpt-4o-mini' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: `Failed to connect to OpenAI: ${message}` };
  }
}

export async function parseResumeWithOpenAi(
  rawResumeText: string,
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<ParseResumeResponse> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, error: 'OpenAI API key is missing. Please set it in options.' };
  }

  const systemPrompt = `You are an expert HR assistant. Your job is to extract structured professional profile data from raw resume text.
Always respond with valid JSON matching this exact schema:
{
  "fullName": "Candidate full name",
  "currentRole": "Current or most recent job title",
  "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6"],
  "experienceHighlights": [
    "Short highlight 1 (max 20 words)",
    "Short highlight 2 (max 20 words)",
    "Short highlight 3 (max 20 words)"
  ],
  "summary": "1 to 2 sentence professional summary of background and key domain."
}
Do not use em dashes in any of the extracted text. Keep highlights punchy and concise.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Here is the raw resume text to parse:\n\n${rawResumeText.slice(0, 12000)}`
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    const data = (await response.json()) as OpenAiChatCompletionResponse;

    if (!response.ok) {
      const errorMsg = data.error?.message || `OpenAI API returned HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'OpenAI returned an empty response.' };
    }

    const parsedJson = JSON.parse(content) as ParsedResumeJson;

    const profile: UserProfile = {
      fullName: (parsedJson.fullName || '').trim(),
      currentRole: (parsedJson.currentRole || '').trim(),
      skills: Array.isArray(parsedJson.skills)
        ? parsedJson.skills.map((s) => String(s).trim()).filter(Boolean)
        : [],
      experienceHighlights: Array.isArray(parsedJson.experienceHighlights)
        ? parsedJson.experienceHighlights.map((h) => String(h).replace(/[\u2014\u2013]/g, '-').trim()).filter(Boolean)
        : [],
      summary: (parsedJson.summary || '').replace(/[\u2014\u2013]/g, '-').trim()
    };

    return { success: true, profile };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown parsing error';
    return { success: false, error: `Failed to parse resume with OpenAI: ${message}` };
  }
}

export async function generateConnectionNote(
  apiKey: string,
  model: string = 'gpt-4o-mini',
  userProfile: UserProfile,
  stylePreferences: StylePreferences,
  targetProfile: TargetProfileData,
  customPromptModifier?: string,
  jobTargetSettings?: JobTargetSettings
): Promise<GenerateDraftResponse> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      success: false,
      error: 'OpenAI API key is missing. Please open Extension Settings to add your key.'
    };
  }

  const toneGuidelines: Record<string, string> = {
    conversational: 'Warm, natural, peer-to-peer, friendly and polite without being stiff.',
    professional: 'Polite, respectful, business-appropriate, and crisp.',
    direct: 'Very concise, directly stating common ground or value, no filler words.',
    enthusiastic: 'High energy, genuinely appreciative of their work or shared passion.'
  };

  const selectedTone = toneGuidelines[stylePreferences.tone] || toneGuidelines.conversational;

  const isJobTargeting = Boolean(
    jobTargetSettings?.enabled && jobTargetSettings.targetCompany
  );

  let jobTargetPromptContext = '';
  if (isJobTargeting && jobTargetSettings) {
    const statusText =
      jobTargetSettings.applicationStatus === 'applied'
        ? 'recently submitted an application for'
        : 'planning to apply soon for';

    const goalDescriptions: Record<string, string> = {
      applied_followup: `Mention you applied for ${jobTargetSettings.targetRole || 'a role'} at ${jobTargetSettings.targetCompany}, connect politely with a team member, and express genuine excitement.`,
      seeking_referral: `Mention your interest in ${jobTargetSettings.targetRole || 'engineering'} at ${jobTargetSettings.targetCompany} and ask if they would be open to sharing advice or a referral.`,
      informational_chat: `Express admiration for ${jobTargetSettings.targetCompany}'s team and ask for a quick pointer on their engineering culture.`,
      hiring_manager: `Reaching out directly regarding ${jobTargetSettings.targetRole || 'the role'} at ${jobTargetSettings.targetCompany} with relevant credentials.`
    };

    const goalInstruction =
      goalDescriptions[jobTargetSettings.outreachGoal] || goalDescriptions.applied_followup;

    jobTargetPromptContext = `
JOB APPLICANT / COMPANY OUTREACH MODE:
Target Company: ${jobTargetSettings.targetCompany}
Target Role: ${jobTargetSettings.targetRole || userProfile.currentRole}
Application Status: ${statusText}
Outreach Strategy: ${goalInstruction}
Key Instruction: Make the message increase employment / response chances. Be courteous, highly professional, and show relevant capability without being entitled or pushy.`;
  }

  const systemPrompt = `You write personalized LinkedIn connection request notes.
CRITICAL HARD CONSTRAINTS:
1. The note MUST be strictly under 200 characters total (absolute maximum). Aim for 140-185 characters. Never exceed 200 characters.
2. Tone: ${selectedTone}
3. Address the person by their first name if discernible.
4. Reference a specific detail from their headline, current company, role, or background to demonstrate genuine relevance.
5. Draw a natural connection to the sender's background or mutual company interest.
6. Absolutely DO NOT use generic clichés like:
   - "I would love to pick your brain"
   - "Hope you are doing well"
   - "I came across your profile and was impressed"
   - "Let us synergize"
7. Never use em dashes. Use commas or short periods instead.
8. Output ONLY the raw message text. No quotes, no markdown headers, no introductory text like "Here is your note:".`;

  const senderContext = `SENDER INFO:
Name: ${userProfile.fullName || 'Professional'}
Role: ${userProfile.currentRole || 'Specialist'}
Skills: ${userProfile.skills.slice(0, 6).join(', ')}
Key Highlight: ${userProfile.experienceHighlights[0] || userProfile.summary || ''}`;

  const targetContext = `TARGET PERSON:
Name: ${targetProfile.fullName || 'there'}
Headline: ${targetProfile.headline || 'Professional'}
Company / Role: ${targetProfile.companyOrRole || 'Industry Leader'}
Location: ${targetProfile.location || ''}
About Excerpt: ${targetProfile.aboutExcerpt ? targetProfile.aboutExcerpt.slice(0, 300) : 'N/A'}
Recent Activity Snippet: ${targetProfile.recentActivity ? targetProfile.recentActivity.slice(0, 200) : 'N/A'}`;

  const userInstructions = `ADDITIONAL PREFERENCES:
Custom instructions: ${stylePreferences.customInstructions || 'None'}
Things to avoid: ${stylePreferences.thingsToAvoid || 'Generic templates'}
Sample note the sender likes: ${stylePreferences.sampleNote || 'None'}
${jobTargetPromptContext}
${customPromptModifier ? `User tweak request: ${customPromptModifier}` : ''}`;

  const promptContent = `${senderContext}\n\n${targetContext}\n\n${userInstructions}\n\nWrite a personalized connection request note under 200 characters:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptContent }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const data = (await response.json()) as OpenAiChatCompletionResponse;

    if (!response.ok) {
      const errorMsg = data.error?.message || `OpenAI API returned HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    let draftText = data.choices[0]?.message?.content?.trim() || '';

    // Remove quotes if the LLM wrapped the text in quotes
    if (
      (draftText.startsWith('"') && draftText.endsWith('"')) ||
      (draftText.startsWith("'") && draftText.endsWith("'"))
    ) {
      draftText = draftText.slice(1, -1).trim();
    }

    // Clean up any em dashes (Rule 9)
    draftText = draftText.replace(/[\u2014\u2013]/g, '-');

    // If draft exceeds 200 characters, truncate cleanly to nearest sentence or word boundary under 200 characters
    if (draftText.length > 200) {
      const truncated = draftText.slice(0, 196);
      const lastPeriod = truncated.lastIndexOf('.');
      if (lastPeriod > 120) {
        draftText = truncated.slice(0, lastPeriod + 1);
      } else {
        const lastSpace = truncated.lastIndexOf(' ');
        draftText = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
      }
    }

    return {
      success: true,
      draftText,
      characterCount: draftText.length
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: `OpenAI connection failed: ${message}` };
  }
}
