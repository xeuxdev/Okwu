import React, { useState } from "react";
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  ShieldCheck,
  Check,
  Sparkles,
} from "lucide-react";
import { testOpenAiApiKey } from "../services/openai-service";
import { PlanTier } from "../types/extension-types";

interface ApiKeyConfigProps {
  apiKey: string;
  model: string;
  useCustomApiKey: boolean;
  planTier: PlanTier;
  messagesUsedThisMonth?: number;
  proSubscribed?: boolean;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
  onUseCustomApiKeyChange: (useCustom: boolean) => void;
  onPlanTierChange: (tier: PlanTier) => void;
}

const AVAILABLE_MODELS = [
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini (Fast, accurate, cost effective - Recommended)",
  },
  { id: "gpt-4o", label: "GPT-4o (High intelligence and reasoning)" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini (Next-gen fast)" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Legacy)" },
];

export const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({
  apiKey,
  model,
  useCustomApiKey,
  planTier,
  messagesUsedThisMonth = 0,
  proSubscribed = false,
  onApiKeyChange,
  onModelChange,
  onUseCustomApiKeyChange,
  onPlanTierChange,
}) => {
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const effectiveTier: PlanTier =
    planTier === "pro_subscription" || proSubscribed
      ? "pro_subscription"
      : planTier === "byok" || useCustomApiKey
        ? "byok"
        : "free_trial";

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: "Please enter your OpenAI API key first.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testOpenAiApiKey(apiKey, model);
    setIsTesting(false);

    if (res.success) {
      setTestResult({
        success: true,
        message: `Connection verified! Successfully connected with model: ${res.modelUsed || model}`,
      });
    } else {
      setTestResult({
        success: false,
        message: res.error || "Failed to authenticate with OpenAI.",
      });
    }
  };

  const handleSelectTier = (tier: PlanTier) => {
    onPlanTierChange(tier);
    if (tier === "byok") {
      onUseCustomApiKeyChange(true);
    } else {
      onUseCustomApiKeyChange(false);
    }
  };

  const freeTrialRemaining = Math.max(0, 3 - messagesUsedThisMonth);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Zap className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Step 1: Choose Your Plan
          </h2>
          <p className="text-xs text-slate-500">
            Cloud AI is already bundled into the extension. Select Free Trial, Pro, or bring your own key (BYOK).
          </p>
        </div>
      </div>

      {/* 3-Tier Plan Grid */}
      <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tier 1: Free Trial */}
        <button
          type="button"
          onClick={() => handleSelectTier("free_trial")}
          className={`text-left rounded-xl border p-4 transition-all relative ${
            effectiveTier === "free_trial"
              ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900">
              Free Trial
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Free
            </span>
          </div>
          <div className="text-lg font-bold text-slate-900 mb-1">
            3 notes <span className="text-xs font-normal text-slate-500">/ month</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Bundled Cloud AI works immediately. No API key or technical configuration needed.
          </p>
          {effectiveTier === "free_trial" && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
              <Check className="h-3.5 w-3.5 text-blue-600" />
              <span>Current Active Plan</span>
            </div>
          )}
        </button>

        {/* Tier 2: Pro Unlimited */}
        <button
          type="button"
          onClick={() => handleSelectTier("pro_subscription")}
          className={`text-left rounded-xl border p-4 transition-all relative ${
            effectiveTier === "pro_subscription"
              ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900">
              Pro Plan
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              Unlimited
            </span>
          </div>
          <div className="text-lg font-bold text-slate-900 mb-1">
            $5 <span className="text-xs font-normal text-slate-500">/ month</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Unlimited personalized notes, priority response speed, and pre-bundled Cloud AI.
          </p>
          {effectiveTier === "pro_subscription" ? (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
              <Check className="h-3.5 w-3.5 text-blue-600" />
              <span>Pro Plan Active</span>
            </div>
          ) : (
            <div className="mt-3 text-[11px] font-medium text-blue-600">
              Click to select $5/mo plan
            </div>
          )}
        </button>

        {/* Tier 3: BYOK */}
        <button
          type="button"
          onClick={() => handleSelectTier("byok")}
          className={`text-left rounded-xl border p-4 transition-all relative ${
            effectiveTier === "byok"
              ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900">
              BYOK (Own Key)
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              Flexible
            </span>
          </div>
          <div className="text-lg font-bold text-slate-900 mb-1">
            Custom <span className="text-xs font-normal text-slate-500">key</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Bring your personal OpenAI API key. Unlimited messages, billed directly by OpenAI.
          </p>
          {effectiveTier === "byok" && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
              <Check className="h-3.5 w-3.5 text-blue-600" />
              <span>BYOK Key Selected</span>
            </div>
          )}
        </button>
      </div>

      {/* Plan Specific Status and Configuration */}
      {effectiveTier === "free_trial" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700">
              <p className="font-semibold text-slate-900">
                Bundled Cloud AI is Active (Free Trial)
              </p>
              <p className="text-slate-500 mt-0.5">
                Monthly Usage: <span className="font-bold text-slate-800">{freeTrialRemaining} of 3 messages</span> remaining this month.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSelectTier("pro_subscription")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors self-start sm:self-auto"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Upgrade to Pro ($5/mo)</span>
          </button>
        </div>
      )}

      {effectiveTier === "pro_subscription" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950">
              <p className="font-bold">Pro Plan Active ($5 / month)</p>
              <p className="text-blue-800 mt-0.5">
                Unlimited notes with pre-bundled Cloud AI. No API key needed.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
            Active
          </span>
        </div>
      )}

      {effectiveTier === "byok" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Key className="h-4 w-4 text-blue-600" />
            <span>Configure Your OpenAI API Key</span>
          </div>

          <div>
            <label
              htmlFor="openai-api-key"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              OpenAI API Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="openai-api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  onApiKeyChange(e.target.value);
                  setTestResult(null);
                }}
                placeholder="sk-proj-..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3.5 pr-10 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? "Hide API key" : "Show API key"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Get your key from{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                platform.openai.com/api-keys
              </a>
            </p>
          </div>

          <div>
            <label
              htmlFor="openai-model-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              OpenAI Model
            </label>
            <select
              id="openai-model-select"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !apiKey.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 transition-colors"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span>Testing connection...</span>
                </>
              ) : (
                <>
                  <Key className="h-3.5 w-3.5 text-slate-500" />
                  <span>Test OpenAI Connection</span>
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2.5 rounded-lg p-3 text-xs border ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
