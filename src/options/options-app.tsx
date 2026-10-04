import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  MessageSquare,
} from "lucide-react";
import {
  ExtensionSettings,
  UserProfile,
  StylePreferences,
  JobTargetSettings,
  BaseFactSheet,
  LinkedInSelfProfile
} from "../types/extension-types";
import {
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from "../services/storage-service";
import { ApiKeyConfig } from "./api-key-config";
import { ResumeUploader } from "./resume-uploader";
import { ProfileEditor } from "./profile-editor";
import { StylePreferencesComponent } from "./style-preferences";
import { JobTargetConfig } from "./job-target-config";

export const OptionsApp: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    getSettings().then((loaded) => {
      setSettings(loaded);
      setIsLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveBanner(null);

    const success = await saveSettings(settings);
    setIsSaving(false);

    if (success) {
      setSaveBanner({
        type: "success",
        text: "Settings saved successfully! Your assistant is ready to draft notes.",
      });
      setTimeout(() => setSaveBanner(null), 4000);
    } else {
      setSaveBanner({
        type: "error",
        text: "Failed to save settings to extension storage.",
      });
    }
  };

  const handleApiKeyChange = (openaiApiKey: string) => {
    setSettings((prev) => ({ ...prev, openaiApiKey }));
  };

  const handleModelChange = (openaiModel: string) => {
    setSettings((prev) => ({ ...prev, openaiModel }));
  };

  const handleProfileAndFactSheetParsed = (
    userProfile: UserProfile,
    baseFactSheet?: BaseFactSheet
  ) => {
    setSettings((prev) => ({
      ...prev,
      userProfile,
      baseFactSheet: baseFactSheet || prev.baseFactSheet
    }));
  };

  const handleLinkedInSynced = (linkedInSelfProfile: LinkedInSelfProfile) => {
    setSettings((prev) => ({
      ...prev,
      linkedInSelfProfile,
      userProfile: {
        ...prev.userProfile,
        fullName: linkedInSelfProfile.fullName || prev.userProfile.fullName,
        currentRole: linkedInSelfProfile.currentRole || prev.userProfile.currentRole
      }
    }));
  };

  const handleProfileChange = (userProfile: UserProfile) => {
    setSettings((prev) => ({ ...prev, userProfile }));
  };

  const handleStyleChange = (stylePreferences: StylePreferences) => {
    setSettings((prev) => ({ ...prev, stylePreferences }));
  };

  const handleJobTargetChange = (jobTargetSettings: JobTargetSettings) => {
    setSettings((prev) => ({ ...prev, jobTargetSettings }));
  };

  const isConfigured = Boolean(
    (!settings.useCustomApiKey || settings.openaiApiKey.trim()) &&
    (settings.userProfile.fullName ||
      settings.userProfile.currentRole ||
      settings.baseFactSheet?.identity.fullName)
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-xs font-semibold text-slate-500">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                LinkedIn Connection Note Assistant
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Personalized connection requests powered by your resume and
                OpenAI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                isConfigured
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isConfigured ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {isConfigured ? "Ready to Draft" : "Setup Incomplete"}
            </span>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </header>

        {/* Save Banner */}
        {saveBanner && (
          <div
            className={`mb-6 flex items-center justify-between rounded-xl p-4 text-xs font-medium border shadow-sm ${
              saveBanner.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {saveBanner.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{saveBanner.text}</span>
            </div>
          </div>
        )}

        {/* Main Content Sections */}
        <main className="space-y-6">
          {/* Instant Autofill Preference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Auto-draft Connection Notes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automatically drafts and populates connection notes upon opening the modal.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                <input
                  type="checkbox"
                  checked={settings.autoFillNote}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      autoFillNote: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                  aria-label="Toggle Instant Autofill for Notes"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Auto-draft Unconventional Comments
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automatically loads authentic, non-bot comments when opening comment boxes on feed and posts.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                <input
                  type="checkbox"
                  checked={settings.autoFillComment}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      autoFillComment: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                  aria-label="Toggle Instant Autofill for Comments"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>
          </div>

          {/* 1. AI Plan & Engine Configuration */}
          <ApiKeyConfig
            apiKey={settings.openaiApiKey}
            model={settings.openaiModel}
            useCustomApiKey={settings.useCustomApiKey}
            planTier={settings.planTier}
            messagesUsedThisMonth={settings.usageStats?.messagesUsedThisMonth ?? 0}
            proSubscribed={Boolean(settings.usageStats?.proSubscribed || settings.planTier === "pro_subscription")}
            onApiKeyChange={handleApiKeyChange}
            onModelChange={handleModelChange}
            onUseCustomApiKeyChange={(useCustomApiKey) =>
              setSettings((prev) => ({ ...prev, useCustomApiKey }))
            }
            onPlanTierChange={(planTier) =>
              setSettings((prev) => ({ ...prev, planTier }))
            }
          />

          {/* 2. Resume & LinkedIn Base Fact Grounding */}
          <ResumeUploader
            apiKey={settings.openaiApiKey}
            model={settings.openaiModel}
            useCustomApiKey={settings.useCustomApiKey}
            baseFactSheet={settings.baseFactSheet}
            linkedInSelfProfile={settings.linkedInSelfProfile}
            onProfileParsed={handleProfileAndFactSheetParsed}
            onLinkedInProfileSynced={handleLinkedInSynced}
          />

          {/* Optional Advanced Customization Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Advanced Customization (Optional)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customize tone, target companies, banned phrases, and candidate profile details.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                <span>{showAdvanced ? "Hide" : "Customize"}</span>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {showAdvanced && (
              <div className="mt-6 space-y-6 pt-6 border-t border-slate-100">
                {/* 3. Structured Profile */}
                <ProfileEditor
                  profile={settings.userProfile}
                  onChange={handleProfileChange}
                />

                {/* 4. Style & Tone Preferences */}
                <StylePreferencesComponent
                  preferences={settings.stylePreferences}
                  onChange={handleStyleChange}
                />

                {/* 5. Target Company & Job Application Mode */}
                <JobTargetConfig
                  settings={settings.jobTargetSettings}
                  onChange={handleJobTargetChange}
                />
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
            >
              <span>Go to LinkedIn</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save All Settings"}</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
