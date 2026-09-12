import React, { useState } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { testOpenAiApiKey } from '../services/openai-service';

interface ApiKeyConfigProps {
  apiKey: string;
  model: string;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
}

const AVAILABLE_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cost Effective - Recommended)' },
  { id: 'gpt-4o', label: 'GPT-4o (High Intelligence & Reasoning)' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (Next-gen Fast)' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legacy)' }
];

export const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({
  apiKey,
  model,
  onApiKeyChange,
  onModelChange
}) => {
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key first.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testOpenAiApiKey(apiKey, model);
    setIsTesting(false);

    if (res.success) {
      setTestResult({
        success: true,
        message: `Connection successful! Verified with model: ${res.modelUsed || model}`
      });
    } else {
      setTestResult({
        success: false,
        message: res.error || 'Failed to authenticate with OpenAI.'
      });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Key className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">OpenAI API Configuration</h2>
          <p className="text-xs text-slate-500">
            Stored only in your browser local storage. Never sent to any third-party servers.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* API Key Input */}
        <div>
          <label htmlFor="openai-api-key" className="block text-xs font-semibold text-slate-700 mb-1.5">
            OpenAI API Key <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="openai-api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                onApiKeyChange(e.target.value);
                setTestResult(null);
              }}
              placeholder="sk-proj-..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-3.5 pr-10 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Find your API key at{' '}
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
          <label htmlFor="openai-model-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
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
        <div className="pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !apiKey.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 transition-colors"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>Testing connection...</span>
              </>
            ) : (
              <span>Test OpenAI Connection</span>
            )}
          </button>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`flex items-start gap-2.5 rounded-lg p-3 text-xs border ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
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
    </div>
  );
};
