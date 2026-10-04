import {
  ExtensionSettings,
  UserProfile,
  StylePreferences,
  JobTargetSettings,
  BaseFactSheet,
  UsageStats,
  PlanTier
} from '../types/extension-types';
import { getCurrentBillingMonth } from './plan-service';

export const DEFAULT_USER_PROFILE: UserProfile = {
  fullName: '',
  currentRole: '',
  skills: [],
  experienceHighlights: [],
  summary: ''
};

export const DEFAULT_BASE_FACT_SHEET: BaseFactSheet = {
  identity: {
    fullName: '',
    headline: '',
    currentRole: '',
    currentCompany: '',
    yearsOfExperience: 0,
    location: '',
    targetRoles: []
  },
  techStack: {
    languages: [],
    frameworks: [],
    toolsAndInfra: [],
    specializations: []
  },
  careerMilestones: [],
  conversationHooks: [],
  compactBio: ''
};

export const DEFAULT_STYLE_PREFERENCES: StylePreferences = {
  tone: 'conversational',
  customInstructions: 'Focus on mutual interests, shared domain expertise, or recent achievements. Keep it natural and concise.',
  thingsToAvoid: 'Do not use cheesy flattery, fake enthusiasm, or generic phrases like "I would love to pick your brain".',
  sampleNote: 'Hi [Name], loved your recent work on [Topic]. Working on similar challenges in [My Role], would enjoy staying in touch!'
};

export const DEFAULT_JOB_TARGET_SETTINGS: JobTargetSettings = {
  enabled: false,
  targetCompany: '',
  targetRole: '',
  applicationStatus: 'applied',
  conversationHook: 'culture_question',
  customTalkingPoint: ''
};

export const DEFAULT_USAGE_STATS: UsageStats = {
  messagesUsedThisMonth: 0,
  currentBillingMonth: getCurrentBillingMonth(),
  proSubscribed: false
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  useCustomApiKey: false,
  planTier: 'free_trial',
  userProfile: DEFAULT_USER_PROFILE,
  baseFactSheet: DEFAULT_BASE_FACT_SHEET,
  stylePreferences: DEFAULT_STYLE_PREFERENCES,
  jobTargetSettings: DEFAULT_JOB_TARGET_SETTINGS,
  autoInjectButton: true,
  autoFillNote: true,
  autoFillComment: true,
  usageStats: DEFAULT_USAGE_STATS
};

const STORAGE_KEYS = {
  SETTINGS: 'linkedin_connect_settings'
} as const;

function normalizePlanTier(rawTier?: PlanTier | string): PlanTier {
  if (rawTier === 'pro_subscription') return 'pro_subscription';
  if (rawTier === 'byok') return 'byok';
  return 'free_trial';
}

function normalizeUsageStats(stored?: Partial<UsageStats>, tier?: PlanTier): UsageStats {
  const currentMonth = getCurrentBillingMonth();
  const isPro = tier === 'pro_subscription' || Boolean(stored?.proSubscribed);
  return {
    messagesUsedThisMonth: stored?.currentBillingMonth === currentMonth ? (stored?.messagesUsedThisMonth ?? 0) : 0,
    currentBillingMonth: stored?.currentBillingMonth || currentMonth,
    proSubscribed: isPro,
    proSubscribedAt: stored?.proSubscribedAt
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise<ExtensionSettings>((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
        const stored = result[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined;
        if (stored) {
          const effectiveTier = normalizePlanTier(stored.planTier);
          resolve({
            ...DEFAULT_SETTINGS,
            ...stored,
            planTier: effectiveTier,
            usageStats: normalizeUsageStats(stored.usageStats, effectiveTier),
            userProfile: {
              ...DEFAULT_USER_PROFILE,
              ...(stored.userProfile || {})
            },
            baseFactSheet: stored.baseFactSheet
              ? {
                  ...DEFAULT_BASE_FACT_SHEET,
                  ...stored.baseFactSheet,
                  identity: {
                    ...DEFAULT_BASE_FACT_SHEET.identity,
                    ...(stored.baseFactSheet.identity || {})
                  },
                  techStack: {
                    ...DEFAULT_BASE_FACT_SHEET.techStack,
                    ...(stored.baseFactSheet.techStack || {})
                  }
                }
              : DEFAULT_BASE_FACT_SHEET,
            stylePreferences: {
              ...DEFAULT_STYLE_PREFERENCES,
              ...(stored.stylePreferences || {})
            },
            jobTargetSettings: {
              ...DEFAULT_JOB_TARGET_SETTINGS,
              ...(stored.jobTargetSettings || {})
            }
          });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      });
    });
  }

  // Fallback for browser testing/development
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ExtensionSettings>;
      const effectiveTier = normalizePlanTier(parsed.planTier);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        planTier: effectiveTier,
        usageStats: normalizeUsageStats(parsed.usageStats, effectiveTier),
        userProfile: {
          ...DEFAULT_USER_PROFILE,
          ...(parsed.userProfile || {})
        },
        baseFactSheet: parsed.baseFactSheet
          ? {
              ...DEFAULT_BASE_FACT_SHEET,
              ...parsed.baseFactSheet,
              identity: {
                ...DEFAULT_BASE_FACT_SHEET.identity,
                ...(parsed.baseFactSheet.identity || {})
              },
              techStack: {
                ...DEFAULT_BASE_FACT_SHEET.techStack,
                ...(parsed.baseFactSheet.techStack || {})
              }
            }
          : DEFAULT_BASE_FACT_SHEET,
        linkedInSelfProfile: parsed.linkedInSelfProfile,
        stylePreferences: {
          ...DEFAULT_STYLE_PREFERENCES,
          ...(parsed.stylePreferences || {})
        },
        jobTargetSettings: {
          ...DEFAULT_JOB_TARGET_SETTINGS,
          ...(parsed.jobTargetSettings || {})
        }
      };
    }
  } catch (error: unknown) {
    console.warn('Failed to read settings from localStorage fallback:', error);
  }

  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: ExtensionSettings): Promise<boolean> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise<boolean>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save settings to chrome.storage.local:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // Fallback for browser testing/development
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error: unknown) {
    console.error('Failed to save settings to localStorage fallback:', error);
    return false;
  }
}
