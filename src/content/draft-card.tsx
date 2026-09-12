import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  X,
  Settings,
  Copy,
  Check,
  Target
} from 'lucide-react';
import {
  TargetProfileData,
  GenerateDraftResponse,
  ExtensionMessageResponse,
  ExtensionSettings,
  JobTargetSettings
} from '../types/extension-types';
import { insertNoteIntoLinkedIn } from './note-injector';

interface DraftCardProps {
  targetProfile: TargetProfileData;
  onClose: () => void;
}

export const DraftCard: React.FC<DraftCardProps> = ({ targetProfile, onClose }) => {
  const [draftText, setDraftText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [insertSuccessMessage, setInsertSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [jobTarget, setJobTarget] = useState<JobTargetSettings>({
    enabled: false,
    targetCompany: '',
    targetRole: '',
    applicationStatus: 'applied',
    outreachGoal: 'applied_followup'
  });
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);

  // Check configuration on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response: ExtensionMessageResponse<ExtensionSettings>) => {
      if (response && response.data) {
        const settings = response.data;
        if (!settings.openaiApiKey) {
          setIsConfigured(false);
          setErrorMessage('OpenAI API key not configured. Please open Settings to set your key.');
          return;
        }

        // Initialize job target from settings or inferred from profile
        const initialJobTarget: JobTargetSettings = {
          ...settings.jobTargetSettings,
          targetCompany: settings.jobTargetSettings.targetCompany || targetProfile.companyOrRole || ''
        };
        setJobTarget(initialJobTarget);

        // Auto-generate on first open
        handleGenerateDraft(undefined, initialJobTarget);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGenerateDraft = (modifier?: string, targetOverride?: JobTargetSettings) => {
    setIsLoading(true);
    setErrorMessage(null);
    setInsertSuccessMessage(null);

    const activeTarget = targetOverride || jobTarget;

    chrome.runtime.sendMessage(
      {
        type: 'GENERATE_DRAFT',
        payload: {
          targetProfile,
          customPromptModifier: modifier,
          jobTargetOverride: activeTarget.enabled ? activeTarget : undefined
        }
      },
      (response: ExtensionMessageResponse<GenerateDraftResponse>) => {
        setIsLoading(false);
        if (response && response.success && response.data?.draftText) {
          setDraftText(response.data.draftText);
        } else {
          setErrorMessage(response?.error || 'Failed to generate connection note. Please check your settings.');
        }
      }
    );
  };

  const handleToggleJobTarget = (enabled: boolean) => {
    const updated = {
      ...jobTarget,
      enabled,
      targetCompany: jobTarget.targetCompany || targetProfile.companyOrRole || ''
    };
    setJobTarget(updated);
    handleGenerateDraft(undefined, updated);
  };

  const handleInsert = async () => {
    if (!draftText.trim()) return;
    const result = await insertNoteIntoLinkedIn(draftText);
    if (result.success) {
      setInsertSuccessMessage(result.message);
      setTimeout(() => {
        onClose();
      }, 2400);
    } else {
      setErrorMessage(result.message);
    }
  };

  const handleCopy = () => {
    if (!draftText) return;
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openOptions = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  };

  const charCount = draftText.length;
  const isOverLimit = charCount > 200;
  const isApproachingLimit = charCount >= 180 && !isOverLimit;

  return (
    <div
      role="dialog"
      aria-labelledby="assistant-modal-title"
      aria-modal="true"
      className="fixed top-6 right-6 z-[999999] w-[480px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-800 antialiased"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="assistant-modal-title" className="text-base font-bold text-slate-900 leading-tight">
              LinkedIn Note Assistant
            </h2>
            <p className="text-xs text-slate-500 truncate max-w-[280px] mt-0.5">
              For {targetProfile.fullName || 'Recipient'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openOptions}
            aria-label="Open Settings"
            className="flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Assistant"
            className="flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Target Preview Details */}
      <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 border border-slate-200">
        <div className="font-semibold text-slate-900 truncate">
          {targetProfile.headline || targetProfile.companyOrRole || 'Profile details extracted'}
        </div>
        {targetProfile.location && (
          <div className="text-xs text-slate-500 mt-0.5">{targetProfile.location}</div>
        )}
      </div>

      {/* Target Company / Job Outreach Mode Toggle Card */}
      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="font-bold text-blue-950">Target Company / Job Application Mode</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={jobTarget.enabled}
              onChange={(e) => handleToggleJobTarget(e.target.checked)}
              className="sr-only peer"
              aria-label="Toggle Job Application Outreach Mode"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {jobTarget.enabled && (
          <div className="mt-2.5 pt-2.5 border-t border-blue-200/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-blue-900 font-semibold text-[11px]">
                Target: {jobTarget.targetCompany || 'Target Company'} {jobTarget.targetRole ? `(${jobTarget.targetRole})` : ''}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingTarget(!isEditingTarget)}
                className="text-[11px] text-blue-700 hover:underline font-semibold"
              >
                {isEditingTarget ? 'Done' : 'Edit Target Info'}
              </button>
            </div>

            {isEditingTarget && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <input
                  type="text"
                  value={jobTarget.targetCompany}
                  onChange={(e) => setJobTarget({ ...jobTarget, targetCompany: e.target.value })}
                  placeholder="Target Company (e.g. Stripe)"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <input
                  type="text"
                  value={jobTarget.targetRole}
                  onChange={(e) => setJobTarget({ ...jobTarget, targetRole: e.target.value })}
                  placeholder="Role (e.g. Frontend Engineer)"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error state if not configured */}
      {!isConfigured ? (
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 border border-amber-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Setup Required</p>
              <p className="mt-1 text-xs">Please add your OpenAI API key and resume summary in settings to draft notes.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openOptions}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Open Extension Settings
          </button>
        </div>
      ) : (
        <>
          {/* Textarea Editor */}
          <div className="relative mb-3">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={isLoading ? 'Drafting a personalized note with OpenAI...' : 'Draft note appears here...'}
              disabled={isLoading}
              rows={4}
              aria-label="Personalized connection note draft"
              className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-400"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/90">
                <div className="flex items-center gap-2.5 text-sm font-bold text-blue-600">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Generating personalized draft...
                </div>
              </div>
            )}
          </div>

          {/* Character counter & Status */}
          <div className="flex items-center justify-between text-sm mb-4">
            <div className="flex items-center gap-2">
              <span
                className={`font-bold ${
                  isOverLimit
                    ? 'text-red-600'
                    : isApproachingLimit
                    ? 'text-amber-600'
                    : 'text-slate-700'
                }`}
              >
                {charCount} / 200
              </span>
              {isOverLimit && (
                <span className="text-xs text-red-600 font-semibold">
                  (Exceeds 200 limit)
                </span>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!draftText}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-600" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Modifier Chips */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">
              {jobTarget.enabled ? 'Job Target Presets:' : 'Quick adjustments:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {jobTarget.enabled ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        `Emphasize that I recently applied for ${jobTarget.targetRole || 'the role'} at ${jobTarget.targetCompany || 'the company'}. Connect politely to follow up and express strong enthusiasm, under 180 chars.`
                      )
                    }
                    disabled={isLoading}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    I Applied
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        `Express keen interest in joining ${jobTarget.targetCompany || 'the team'} as ${jobTarget.targetRole || 'an engineer'}. Ask politely for advice or a brief pointer on team culture, under 180 chars.`
                      )
                    }
                    disabled={isLoading}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    Ask for Advice
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        `Direct polite outreach regarding ${jobTarget.targetRole || 'engineering openings'} at ${jobTarget.targetCompany || 'the company'}, highlighting relevant background, under 180 chars.`
                      )
                    }
                    disabled={isLoading}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    Hiring Lead
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateDraft('Make it noticeably shorter and strictly under 140 characters.')}
                    disabled={isLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Shorter
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleGenerateDraft('Make it noticeably shorter and strictly under 140 characters.')}
                    disabled={isLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                  >
                    Shorter
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateDraft('Use a friendly, casual peer tone under 180 characters.')}
                    disabled={isLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                  >
                    More Casual
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateDraft('Emphasize professional alignment and shared engineering domain under 180 characters.')}
                    disabled={isLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                  >
                    Professional
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateDraft('Regenerate fresh version under 180 characters.')}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Success notice */}
          {insertSuccessMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span className="leading-snug">{insertSuccessMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleInsert}
              disabled={isLoading || !draftText.trim() || isOverLimit}
              className="flex-1 flex items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              Insert into LinkedIn Note
            </button>
          </div>
          <p className="mt-2.5 text-center text-xs text-slate-500">
            Note will be filled into LinkedIn. You review and click Send manually.
          </p>
        </>
      )}
    </div>
  );
};
