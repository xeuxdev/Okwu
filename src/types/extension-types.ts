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

export type ConversationHookType =
  | 'culture_question'
  | 'tech_discussion'
  | 'project_appreciation'
  | 'applied_conversation'
  | 'direct_inquiry';

export interface JobTargetSettings {
  enabled: boolean;
  targetCompany: string;
  targetRole: string;
  applicationStatus: 'applied' | 'planning_to_apply' | 'dream_company';
  conversationHook: ConversationHookType;
  customTalkingPoint: string;
}

export type PlanTier = 'free_trial' | 'pro_subscription' | 'byok' | 'free_cloud';

export interface UsageStats {
  messagesUsedThisMonth: number;
  currentBillingMonth: string;
  proSubscribed: boolean;
  proSubscribedAt?: string;
}

export interface CareerMilestone {
  company: string;
  role: string;
  timeframe: string;
  keyImpact: string;
  domain: string;
  technologies: string[];
}

export interface TechStackCategory {
  languages: string[];
  frameworks: string[];
  toolsAndInfra: string[];
  specializations: string[];
}

export interface LinkedInSelfProfile {
  fullName: string;
  headline: string;
  currentCompany: string;
  currentRole: string;
  location: string;
  vanityUrl: string;
  summary: string;
}

export interface BaseFactSheet {
  identity: {
    fullName: string;
    headline: string;
    currentRole: string;
    currentCompany: string;
    yearsOfExperience: number;
    location: string;
    targetRoles: string[];
  };
  techStack: TechStackCategory;
  careerMilestones: CareerMilestone[];
  conversationHooks: string[];
  compactBio: string;
  linkedInSyncedAt?: string;
  resumeParsedAt?: string;
}

export interface ExtensionSettings {
  openaiApiKey: string;
  openaiModel: string;
  useCustomApiKey: boolean;
  planTier: PlanTier;
  userProfile: UserProfile;
  baseFactSheet?: BaseFactSheet;
  linkedInSelfProfile?: LinkedInSelfProfile;
  stylePreferences: StylePreferences;
  jobTargetSettings: JobTargetSettings;
  autoInjectButton: boolean;
  autoFillNote: boolean;
  autoFillComment: boolean;
  usageStats?: UsageStats;
}

export interface TargetExperience {
  title: string;
  company: string;
  timeframe?: string;
  description?: string;
}

export interface TargetEducation {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  timeframe?: string;
}

export interface TargetFeaturedItem {
  title: string;
  category?: string;
  description?: string;
  link?: string;
}

export interface TargetProfileData {
  fullName: string;
  headline: string;
  companyOrRole: string;
  location: string;
  aboutExcerpt: string;
  recentActivity: string;
  recentPost?: string;
  featuredItems?: TargetFeaturedItem[];
  experiences?: TargetExperience[];
  education?: TargetEducation[];
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
  planUsed?: string;
  matchedHighlight?: string;
  messagesRemaining?: number;
  monthlyLimitReached?: boolean;
}

export interface ExistingComment {
  author: string;
  headline?: string;
  text: string;
}

export interface PostContext {
  postAuthorName: string;
  postAuthorHeadline?: string;
  postAuthorProfileUrl?: string;
  postText: string;
  existingComments?: ExistingComment[];
  postUrn?: string;
}

export type CommentAnglePreference =
  | 'tactical_question'
  | 'counter_intuitive'
  | 'grounded_peer'
  | 'witty_perspective';

export interface GenerateCommentRequest {
  postContext: PostContext;
  customPromptModifier?: string;
  commentAngle?: CommentAnglePreference;
}

export interface GenerateCommentResponse {
  success: boolean;
  commentText?: string;
  angleUsed?: string;
  error?: string;
  characterCount?: number;
  planUsed?: string;
  messagesRemaining?: number;
  monthlyLimitReached?: boolean;
}

export interface ParseResumeResponse {
  success: boolean;
  profile?: UserProfile;
  baseFactSheet?: BaseFactSheet;
  error?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  modelUsed?: string;
  error?: string;
}

export type ExtensionMessageType =
  | { type: 'GENERATE_DRAFT'; payload: GenerateDraftRequest }
  | { type: 'GENERATE_COMMENT'; payload: GenerateCommentRequest }
  | { type: 'PARSE_RESUME_TO_FACT_SHEET'; payload: { rawText: string; linkedInProfile?: LinkedInSelfProfile } }
  | { type: 'SYNC_MY_LINKEDIN_PROFILE' }
  | { type: 'TEST_OPENAI_KEY'; payload: { apiKey: string; model: string } }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: ExtensionSettings }
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'SET_PLAN_TIER'; payload: { tier: PlanTier; activatePro?: boolean } };

export interface ExtensionMessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

