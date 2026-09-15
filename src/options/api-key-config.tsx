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
} from "lucide-react";
import { testOpenAiApiKey } from "../services/openai-service";
import { PlanTier } from "../types/extension-types";

interface ApiKeyConfigProps {
  apiKey: string;
  model: string;
  useCustomApiKey: boolean;
  planTier: PlanTier;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
  onUseCustomApiKeyChange: (useCustom: boolean) => void;
  onPlanTierChange: (tier: PlanTier) => void;
}

const AVAILABLE_MODELS = [
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini (Fast and Cost Effective - Recommended)",
  },
  { id: "gpt-4o", label: "GPT-4o (High Intelligence and Reasoning)" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini (Next-gen Fast)" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Legacy)" },
];

export const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({
  apiKey,
  model,
  useCustomApiKey,
  planTier,
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

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: "Please enter an API key first.",
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
        message: `Connection successful! Verified with model: ${res.modelUsed || model}`,
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Zap className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            AI Plan & Engine Access
          </h2>
          <p className="text-xs text-slate-500">
            Use included Cloud AI or bring your own custom OpenAI API key
            (BYOK).
          </p>
        </div>
      </div>

      {/* Pricing / Plan Selection Cards */}
      <div className="mb-6 space-y-3">
        <label className="block text-xs font-semibold text-slate-700">
          Select Service Plan
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Cloud Included Plan */}
          <button
            type="button"
            onClick={() => handleSelectTier("free_cloud")}
            className={`text-left rounded-xl border p-3.5 transition-all ${
              planTier === "free_cloud" && !useCustomApiKey
                ? "border-blue-600 bg-blue-50/60 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900">
                Cloud Starter
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Included
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Works instantly out of the box. No OpenAI API key or technical
              setup required.
            </p>
          </button>

          {/* Pro Subscription */}
          <button
            type="button"
            onClick={() => handleSelectTier("pro_subscription")}
            className={`text-left rounded-xl border p-3.5 transition-all ${
              planTier === "pro_subscription" && !useCustomApiKey
                ? "border-blue-600 bg-blue-50/60 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900">
                Pro Unlimited
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                $5 / mo
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Cheaper flat-rate pricing. Unlimited notes, priority model speed,
              and candidate analytics.
            </p>
          </button>

          {/* BYOK Plan */}
          <button
            type="button"
            onClick={() => handleSelectTier("byok")}
            className={`text-left rounded-xl border p-3.5 transition-all ${
              useCustomApiKey || planTier === "byok"
                ? "border-blue-600 bg-blue-50/60 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900">
                BYOK (Custom Key)
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                Optional
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Connect your own OpenAI API key. Pay OpenAI directly per request.
            </p>
          </button>
        </div>
      </div>

      {/* Cloud Mode Active Notice */}
      {!useCustomApiKey && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900">
            <p className="font-bold">Cloud AI Engine is Active</p>
            <p className="mt-0.5 text-emerald-800">
              You are using the built-in AI service. You do not need to provide
              or pay for an OpenAI API key.
            </p>
          </div>
        </div>
      )}

      {/* Optional BYOK Toggle */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-xs font-semibold text-slate-800">
              Use Custom OpenAI Key (BYOK)
            </span>
            <p className="text-[11px] text-slate-500">
              Enable this if you prefer using your personal OpenAI developer
              account.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={useCustomApiKey}
              onChange={(e) => {
                const checked = e.target.checked;
                onUseCustomApiKeyChange(checked);
                if (checked) {
                  onPlanTierChange("byok");
                } else {
                  onPlanTierChange("free_cloud");
                }
              }}
              className="sr-only peer"
              aria-label="Toggle Custom OpenAI Key"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {/* Custom API Key Details (only shown if BYOK is toggled on) */}
        {useCustomApiKey && (
          <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            {/* API Key Input */}
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
                Find your key at{" "}
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

            {/* Model Selector */}
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

            {/* Test Connection Button */}
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

            {/* Test Result Message */}
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
    </div>
  );
};
