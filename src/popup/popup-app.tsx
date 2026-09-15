import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Settings,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  User,
  ArrowRight,
} from "lucide-react";
import { ExtensionSettings } from "../types/extension-types";
import { getSettings, DEFAULT_SETTINGS } from "../services/storage-service";

export const PopupApp: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [activeTabUrl, setActiveTabUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Load stored settings
    getSettings().then((loaded) => {
      setSettings(loaded);
      setIsLoading(false);
    });

    // Detect active tab
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          setActiveTabUrl(tabs[0].url);
        }
      });
    }
  }, []);

  const openOptionsPage = () => {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.openOptionsPage
    ) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open("/options.html", "_blank");
    }
  };

  const isLinkedInProfile = activeTabUrl.includes("linkedin.com/in/");
  const hasAiAccess = !settings.useCustomApiKey || Boolean(settings.openaiApiKey.trim());
  const hasProfile = Boolean(
    settings.userProfile.fullName ||
    settings.userProfile.currentRole ||
    settings.baseFactSheet?.identity.fullName
  );
  const isReady = hasAiAccess && hasProfile;

  if (isLoading) {
    return (
      <div className="w-90 p-6 text-center text-xs font-medium text-slate-500 bg-white">
        Loading assistant...
      </div>
    );
  }

  return (
    <div className="w-90 bg-white text-slate-800 antialiased">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              LinkedIn Note Assistant
            </h1>
            <p className="text-[11px] text-slate-500">
              OpenAI Personalized Notes
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openOptionsPage}
          aria-label="Open Extension Settings"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Readiness checklist card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Setup Status</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                isReady
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {isReady ? "Ready to use" : "Action required"}
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex items-center gap-2">
              {hasAiAccess ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              )}
              <span
                className={
                  hasAiAccess ? "text-slate-700" : "text-amber-800 font-medium"
                }
              >
                AI Engine:{" "}
                {settings.useCustomApiKey
                  ? settings.openaiApiKey.trim()
                    ? "Custom API Key"
                    : "Missing Custom Key"
                  : "Cloud Plan Ready"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {hasProfile ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              )}
              <span
                className={
                  hasProfile ? "text-slate-700" : "text-amber-800 font-medium"
                }
              >
                Resume Profile:{" "}
                {hasProfile
                  ? `${
                      settings.userProfile.fullName ||
                      settings.baseFactSheet?.identity.fullName ||
                      "Loaded"
                    }`
                  : "Not uploaded"}
              </span>
            </div>
          </div>
        </div>

        {/* User Profile summary if loaded */}
        {hasProfile && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <User className="h-3.5 w-3.5 text-blue-600" />
              <span className="font-semibold text-slate-800 truncate">
                {settings.userProfile.fullName || "Your Profile"}
              </span>
            </div>
            {settings.userProfile.currentRole && (
              <p className="text-[11px] text-slate-600 truncate mb-1">
                {settings.userProfile.currentRole}
              </p>
            )}
            {settings.userProfile.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {settings.userProfile.skills.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                  >
                    {s}
                  </span>
                ))}
                {settings.userProfile.skills.length > 4 && (
                  <span className="text-[10px] text-slate-400">
                    +{settings.userProfile.skills.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Context-aware action */}
        {isLinkedInProfile ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-900">
            <p className="font-semibold mb-1">LinkedIn Profile Detected!</p>
            <p className="text-[11px] text-blue-700 mb-2.5">
              Click the "Draft Note" button on the profile header or floating
              badge to generate a note.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700 mb-1">How it works:</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-slate-500">
              <li>Navigate to any LinkedIn member profile</li>
              <li>Click the injected "Draft Note" button</li>
              <li>Review the personalized note and insert it</li>
            </ol>
          </div>
        )}

        {/* Action button */}
        {!isReady ? (
          <button
            type="button"
            onClick={openOptionsPage}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <span>Complete Setup in Settings</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openOptionsPage}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <span>LinkedIn</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
