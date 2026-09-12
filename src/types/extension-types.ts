export interface UserProfile {
  fullName: string;
  currentRole: string;
  skills: string[];
  experienceHighlights: string[];
  summary: string;
}

export type TonePreference = 'conversational' | 'professional' | 'direct' | 'enthusiastic';

export interface StylePreferences {
  tone: TonePreference;
  customInstructions: string;
  thingsToAvoid: string;
  sampleNote: string;
}

export type JobOutreachGoal =
  | 'applied_followup'
  | 'seeking_referral'
  | 'informational_chat'
  | 'hiring_manager';

export interface JobTargetSettings {
  enabled: boolean;
  targetCompany: string;
  targetRole: string;
  applicationStatus: 'applied' | 'planning_to_apply';
  outreachGoal: JobOutreachGoal;
}

export interface ExtensionSettings {
  openaiApiKey: string;
  openaiModel: string;
  userProfile: UserProfile;
  stylePreferences: StylePreferences;
  jobTargetSettings: JobTargetSettings;
  autoInjectButton: boolean;
}

export interface TargetProfileData {
  fullName: string;
  headline: string;
  companyOrRole: string;
  location: string;
  aboutExcerpt: string;
  recentActivity: string;
  profileUrl: string;
}

export interface GenerateDraftRequest {
  targetProfile: TargetProfileData;
  customPromptModifier?: string;
  jobTargetOverride?: Partial<JobTargetSettings>;
}

export interface GenerateDraftResponse {
  success: boolean;
  draftText?: string;
  error?: string;
  characterCount?: number;
}

export interface ParseResumeResponse {
  success: boolean;
  profile?: UserProfile;
  error?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  modelUsed?: string;
  error?: string;
}

export type ExtensionMessageType =
  | { type: 'GENERATE_DRAFT'; payload: GenerateDraftRequest }
  | { type: 'PARSE_RESUME_TEXT'; payload: { rawText: string } }
  | { type: 'TEST_OPENAI_KEY'; payload: { apiKey: string; model: string } }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: ExtensionSettings }
  | { type: 'OPEN_OPTIONS_PAGE' };

export interface ExtensionMessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
