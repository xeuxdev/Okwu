import { ExtensionSettings, PlanTier, UsageStats } from '../types/extension-types';

export const FREE_TRIAL_MONTHLY_LIMIT = 3;

export function getCurrentBillingMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export interface PlanStatus {
  tier: PlanTier;
  isPro: boolean;
  isByok: boolean;
  isFreeTrial: boolean;
  messagesUsedThisMonth: number;
  monthlyLimit: number;
  messagesRemaining: number;
  canGenerate: boolean;
  planLabel: string;
}

export function getPlanStatus(settings: ExtensionSettings): PlanStatus {
  const currentMonth = getCurrentBillingMonth();
  const isPro = settings.planTier === 'pro_subscription' || Boolean(settings.usageStats?.proSubscribed);
  const isByok = settings.planTier === 'byok' || settings.useCustomApiKey;
  const usageRecordedMonth = settings.usageStats?.currentBillingMonth;
  const rawUsed = settings.usageStats?.messagesUsedThisMonth ?? 0;
  const messagesUsedThisMonth = usageRecordedMonth === currentMonth ? rawUsed : 0;

  if (isPro) {
    return {
      tier: 'pro_subscription',
      isPro: true,
      isByok: false,
      isFreeTrial: false,
      messagesUsedThisMonth,
      monthlyLimit: Infinity,
      messagesRemaining: Infinity,
      canGenerate: true,
      planLabel: 'Pro Unlimited ($5/mo)'
    };
  }

  if (isByok) {
    return {
      tier: 'byok',
      isPro: false,
      isByok: true,
      isFreeTrial: false,
      messagesUsedThisMonth,
      monthlyLimit: Infinity,
      messagesRemaining: Infinity,
      canGenerate: true,
      planLabel: 'BYOK (Custom Key)'
    };
  }

  const remaining = Math.max(0, FREE_TRIAL_MONTHLY_LIMIT - messagesUsedThisMonth);

  return {
    tier: 'free_trial',
    isPro: false,
    isByok: false,
    isFreeTrial: true,
    messagesUsedThisMonth,
    monthlyLimit: FREE_TRIAL_MONTHLY_LIMIT,
    messagesRemaining: remaining,
    canGenerate: remaining > 0,
    planLabel: `Free Trial (${remaining}/${FREE_TRIAL_MONTHLY_LIMIT} left this month)`
  };
}

export function recordMessageUsage(settings: ExtensionSettings): ExtensionSettings {
  const status = getPlanStatus(settings);
  const currentMonth = getCurrentBillingMonth();

  // BYOK and Pro do not consume Free Trial monthly quota
  if (!status.isFreeTrial) {
    return settings;
  }

  const newUsedCount = status.messagesUsedThisMonth + 1;
  const updatedUsage: UsageStats = {
    messagesUsedThisMonth: newUsedCount,
    currentBillingMonth: currentMonth,
    proSubscribed: Boolean(settings.usageStats?.proSubscribed),
    proSubscribedAt: settings.usageStats?.proSubscribedAt
  };

  return {
    ...settings,
    usageStats: updatedUsage
  };
}

export function activateProSubscription(settings: ExtensionSettings): ExtensionSettings {
  const currentMonth = getCurrentBillingMonth();
  return {
    ...settings,
    planTier: 'pro_subscription',
    useCustomApiKey: false,
    usageStats: {
      messagesUsedThisMonth: settings.usageStats?.messagesUsedThisMonth ?? 0,
      currentBillingMonth: settings.usageStats?.currentBillingMonth ?? currentMonth,
      proSubscribed: true,
      proSubscribedAt: new Date().toISOString()
    }
  };
}

export function switchToByok(settings: ExtensionSettings): ExtensionSettings {
  return {
    ...settings,
    planTier: 'byok',
    useCustomApiKey: true
  };
}

export function switchToFreeTrial(settings: ExtensionSettings): ExtensionSettings {
  const currentMonth = getCurrentBillingMonth();
  return {
    ...settings,
    planTier: 'free_trial',
    useCustomApiKey: false,
    usageStats: {
      messagesUsedThisMonth: settings.usageStats?.messagesUsedThisMonth ?? 0,
      currentBillingMonth: settings.usageStats?.currentBillingMonth ?? currentMonth,
      proSubscribed: false,
      proSubscribedAt: undefined
    }
  };
}
