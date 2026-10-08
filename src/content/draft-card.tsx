import React, { useState, useEffect } from "react";
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
  Target,
  MessageSquare,
} from "lucide-react";
import {
  TargetProfileData,
  GenerateDraftResponse,
  ExtensionMessageResponse,
  ExtensionSettings,
  JobTargetSettings,
  ConversationHookType,
} from "../types/extension-types";
import { getPlanStatus } from "../services/plan-service";
import { insertNoteIntoLinkedIn } from "./note-injector";
import { OkwuLogo } from "../components/okwu-logo";

interface DraftCardProps {
  targetProfile: TargetProfileData;
  onClose: () => void;
}

export const DraftCard: React.FC<DraftCardProps> = ({
  targetProfile,
  onClose,
}) => {
  const [draftText, setDraftText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [insertSuccessMessage, setInsertSuccessMessage] = useState<
    string | null
  >(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [planBadge, setPlanBadge] = useState<string>("Cloud AI");
  const [matchedHighlight, setMatchedHighlight] = useState<string | null>(null);
  const [jobTarget, setJobTarget] = useState<JobTargetSettings>({
    enabled: false,
    targetCompany: "",
    targetRole: "",
    applicationStatus: "applied",
    conversationHook: "culture_question",
    customTalkingPoint: "",
  });
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [monthlyLimitReached, setMonthlyLimitReached] =
    useState<boolean>(false);

  // Check configuration on mount
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "GET_SETTINGS" },
      (response: ExtensionMessageResponse<ExtensionSettings>) => {
        if (response && response.data) {
          const settings = response.data;
          if (settings.useCustomApiKey && !settings.openaiApiKey) {
            setIsConfigured(false);
            setErrorMessage(
              "OpenAI API key not configured. Please open Settings to set your key or switch to Cloud plan.",
            );
            return;
          }

          const status = getPlanStatus(settings);
          setPlanBadge(status.planLabel);

          // Initialize job target from settings or inferred from profile
          const initialJobTarget: JobTargetSettings = {
            ...settings.jobTargetSettings,
            targetCompany:
              settings.jobTargetSettings.targetCompany ||
              targetProfile.companyOrRole ||
              "",
          };
          setJobTarget(initialJobTarget);

          // Auto-generate on first open
          handleGenerateDraft(undefined, initialJobTarget);
        }
      },
    );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleGenerateDraft = (
    modifier?: string,
    targetOverride?: JobTargetSettings,
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    setInsertSuccessMessage(null);
    setMatchedHighlight(null);

    const activeTarget = targetOverride || jobTarget;

    chrome.runtime.sendMessage(
      {
        type: "GENERATE_DRAFT",
        payload: {
          targetProfile,
          customPromptModifier: modifier,
          jobTargetOverride: activeTarget.enabled ? activeTarget : undefined,
        },
      },
      (response: ExtensionMessageResponse<GenerateDraftResponse>) => {
        setIsLoading(false);
        if (response && response.success && response.data?.draftText) {
          setDraftText(response.data.draftText);
          setMonthlyLimitReached(false);
          if (response.data.planUsed) {
            setPlanBadge(response.data.planUsed);
          }
          if (response.data.matchedHighlight) {
            setMatchedHighlight(response.data.matchedHighlight);
          }
        } else {
          setErrorMessage(
            response?.error ||
              "Failed to generate connection note. Please check your settings.",
          );
          if (response?.data?.monthlyLimitReached) {
            setMonthlyLimitReached(true);
          }
        }
      },
    );
  };

  const handleUpgradeToPro = () => {
    setIsLoading(true);
    chrome.runtime.sendMessage(
      {
        type: "SET_PLAN_TIER",
        payload: { tier: "pro_subscription", activatePro: true },
      },
      () => {
        setMonthlyLimitReached(false);
        setErrorMessage(null);
        setPlanBadge("Pro Unlimited ($5/mo)");
        handleGenerateDraft();
      },
    );
  };

  const handleToggleJobTarget = (enabled: boolean) => {
    const updated: JobTargetSettings = {
      ...jobTarget,
      enabled,
      targetCompany:
        jobTarget.targetCompany || targetProfile.companyOrRole || "",
    };
    setJobTarget(updated);
    handleGenerateDraft(undefined, updated);
  };

  const handleConversationHookChange = (
    conversationHook: ConversationHookType,
  ) => {
    const updated: JobTargetSettings = {
      ...jobTarget,
      conversationHook,
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
    chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" });
  };

  const charCount = draftText.length;
  const isOverLimit = charCount > 200;
  const isApproachingLimit = charCount >= 180 && !isOverLimit;

  return (
    <div
      role="dialog"
      aria-labelledby="assistant-modal-title"
      aria-modal="true"
      className="fixed top-6 right-6 z-999999 w-120 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-800 antialiased"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <OkwuLogo size={36} />
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="assistant-modal-title"
                className="text-base font-bold text-slate-900 leading-tight"
              >
                Okwu
              </h2>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                {planBadge}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate max-w-70 mt-0.5">
              For {targetProfile.fullName || "Recipient"}
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
      <div className="mb-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200 space-y-1.5">
        <div className="font-semibold text-slate-900 text-sm truncate">
          {targetProfile.headline ||
            targetProfile.companyOrRole ||
            "Profile details extracted"}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {targetProfile.location && (
            <span className="rounded bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-600">
              {targetProfile.location}
            </span>
          )}
          {targetProfile.experiences && targetProfile.experiences.length > 0 && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
              {targetProfile.experiences[0].title}
            </span>
          )}
          {targetProfile.education && targetProfile.education.length > 0 && (
            <span className="rounded bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-700">
              {targetProfile.education[0].school}
            </span>
          )}
          {targetProfile.recentPost && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Recent post detected
            </span>
          )}
          {targetProfile.featuredItems && targetProfile.featuredItems.length > 0 && (
            <span className="rounded bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-800 truncate max-w-44">
              Featured: {targetProfile.featuredItems[0].title}
            </span>
          )}
        </div>
      </div>

      {/* Matched Ground Truth Fact */}
      {matchedHighlight && (
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900 flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-bold text-emerald-950">Matched Ground Fact: </span>
            <span>{matchedHighlight}</span>
          </div>
        </div>
      )}

      {/* Target Company / Employment Outreach Mode Toggle Card */}
      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="font-bold text-blue-950">
              Target Company Outreach Mode
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={jobTarget.enabled}
              onChange={(e) => handleToggleJobTarget(e.target.checked)}
              className="sr-only peer"
              aria-label="Toggle Job Application Outreach Mode"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {jobTarget.enabled && (
          <div className="mt-2.5 pt-2.5 border-t border-blue-200/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-blue-900 font-semibold text-[11px]">
                Target: {jobTarget.targetCompany || "Target Company"}{" "}
                {jobTarget.targetRole ? `(${jobTarget.targetRole})` : ""}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingTarget(!isEditingTarget)}
                className="text-[11px] text-blue-700 hover:underline font-semibold"
              >
                {isEditingTarget ? "Done" : "Edit Target Info"}
              </button>
            </div>

            {isEditingTarget && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={jobTarget.targetCompany}
                    onChange={(e) =>
                      setJobTarget({
                        ...jobTarget,
                        targetCompany: e.target.value,
                      })
                    }
                    placeholder="Target Company (e.g. Stripe)"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={jobTarget.targetRole}
                    onChange={(e) =>
                      setJobTarget({ ...jobTarget, targetRole: e.target.value })
                    }
                    placeholder="Target Role (e.g. Frontend)"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <input
                  type="text"
                  value={jobTarget.customTalkingPoint || ""}
                  onChange={(e) =>
                    setJobTarget({
                      ...jobTarget,
                      customTalkingPoint: e.target.value,
                    })
                  }
                  placeholder="Custom topic (e.g. React 19, distributed cache)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
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
              <p className="font-bold text-amber-900">Configuration Required</p>
              <p className="mt-1 text-xs">
                Please open Settings to choose your AI plan or enter an OpenAI
                API key.
              </p>
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
              placeholder={
                isLoading
                  ? "Drafting a conversation-starting note with AI..."
                  : "Draft note appears here..."
              }
              disabled={isLoading}
              rows={4}
              aria-label="Personalized connection note draft"
              className="w-full resize-none rounded-xl border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-400"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/90">
                <div className="flex items-center gap-2.5 text-sm font-bold text-blue-600">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Generating conversation starter...
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
                    ? "text-red-600"
                    : isApproachingLimit
                      ? "text-amber-600"
                      : "text-slate-700"
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

          {/* Conversation Starter Presets */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
              <p className="text-xs font-semibold text-slate-700">
                {jobTarget.enabled
                  ? "Conversation Starters for " +
                    (jobTarget.targetCompany || "Target") +
                    ":"
                  : "Quick conversational angles:"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {jobTarget.enabled ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleConversationHookChange("culture_question");
                      handleGenerateDraft(
                        `Focus on team engineering culture and pace at ${jobTarget.targetCompany || "the company"}. Ask a friendly question about developer autonomy or velocity under 180 chars.`,
                      );
                    }}
                    disabled={isLoading}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    Culture Question
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleConversationHookChange("tech_discussion");
                      handleGenerateDraft(
                        `Ask a smart, concise question about how their team tackles engineering or architecture challenges at ${jobTarget.targetCompany || "the company"}, under 180 chars.`,
                      );
                    }}
                    disabled={isLoading}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    Tech Discussion
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleConversationHookChange("applied_conversation");
                      handleGenerateDraft(
                        `Politely state I applied for ${jobTarget.targetRole || "the role"} at ${jobTarget.targetCompany || "the company"}, connect peer-to-peer, and ask what they like most about the team, under 180 chars.`,
                      );
                    }}
                    disabled={isLoading}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    Applied (Peer Intro)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleConversationHookChange("project_appreciation");
                      handleGenerateDraft(
                        `Compliment a recent launch or product at ${jobTarget.targetCompany || "the company"} and ask an open-ended question about what they learned building it, under 180 chars.`,
                      );
                    }}
                    disabled={isLoading}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    Appreciation
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        "Make it noticeably shorter and strictly under 140 characters.",
                      )
                    }
                    disabled={isLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Shorter
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        "Generate fresh conversation starter note under 180 characters.",
                      )
                    }
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        "Use a friendly, casual peer tone with an open-ended conversational question under 180 characters.",
                      )
                    }
                    disabled={isLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                  >
                    Conversational
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        "Focus on mutual engineering background and ask an insightful question on their domain under 180 characters.",
                      )
                    }
                    disabled={isLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                  >
                    Domain Question
                  </button>
                  {targetProfile.recentPost && (
                    <button
                      type="button"
                      onClick={() =>
                        handleGenerateDraft(
                          "Directly reference and praise their recent post or shared insight with an engaging question under 180 characters.",
                        )
                      }
                      disabled={isLoading}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                    >
                      Recent Post
                    </button>
                  )}
                  {targetProfile.featuredItems && targetProfile.featuredItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleGenerateDraft(
                          `Reference their featured project "${targetProfile.featuredItems![0].title}" and ask an insightful technical question under 180 characters.`,
                        )
                      }
                      disabled={isLoading}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                    >
                      Featured Project
                    </button>
                  )}
                  {targetProfile.experiences && targetProfile.experiences.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleGenerateDraft(
                          `Reference their specific background as ${targetProfile.experiences![0].title} at ${targetProfile.experiences![0].company} under 180 characters.`,
                        )
                      }
                      disabled={isLoading}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                    >
                      Experience Angle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        "Make it punchy, concise and strictly under 140 characters.",
                      )
                    }
                    disabled={isLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors"
                  >
                    Shorter
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateDraft(
                        "Regenerate fresh version under 180 characters.",
                      )
                    }
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
            <div className="mb-4 flex flex-col gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
              {monthlyLimitReached && (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleUpgradeToPro}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Upgrade to Pro ($5/mo)
                  </button>
                  <button
                    type="button"
                    onClick={openOptions}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Configure BYOK in Settings
                  </button>
                </div>
              )}
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
            Note will be filled into LinkedIn. You review and click Send
            manually.
          </p>
        </>
      )}
    </div>
  );
};
