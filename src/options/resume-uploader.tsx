import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Link as LinkIcon,
  RefreshCw,
  Briefcase,
  Layers,
  Award,
} from "lucide-react";
import {
  extractTextFromFile,
  TextExtractionResult,
} from "../services/resume-parser";
import { parseResumeToBaseFactSheet } from "../services/openai-service";
import { syncLinkedInProfileFromBrowser } from "../services/linkedin-sync-service";
import {
  UserProfile,
  BaseFactSheet,
  LinkedInSelfProfile,
} from "../types/extension-types";

interface ResumeUploaderProps {
  apiKey: string;
  model: string;
  useCustomApiKey: boolean;
  baseFactSheet?: BaseFactSheet;
  linkedInSelfProfile?: LinkedInSelfProfile;
  onProfileParsed: (profile: UserProfile, factSheet?: BaseFactSheet) => void;
  onLinkedInProfileSynced: (profile: LinkedInSelfProfile) => void;
}

export const ResumeUploader: React.FC<ResumeUploaderProps> = ({
  apiKey,
  model,
  useCustomApiKey,
  baseFactSheet,
  linkedInSelfProfile,
  onProfileParsed,
  onLinkedInProfileSynced,
}) => {
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isSyncingLinkedIn, setIsSyncingLinkedIn] = useState<boolean>(false);
  const [manualLinkedInUrl, setManualLinkedInUrl] = useState<string>(
    linkedInSelfProfile?.vanityUrl || "",
  );
  const [extractedResult, setExtractedResult] =
    useState<TextExtractionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSyncLinkedIn = async () => {
    setIsSyncingLinkedIn(true);
    setStatusMessage(null);

    const res = await syncLinkedInProfileFromBrowser();
    setIsSyncingLinkedIn(false);

    if (res.success && res.profile) {
      onLinkedInProfileSynced(res.profile);
      setManualLinkedInUrl(res.profile.vanityUrl || manualLinkedInUrl);
      setStatusMessage({
        type: "success",
        text: `Synced profile for ${res.profile.fullName || "you"} (${res.profile.headline || "LinkedIn profile"})!`,
      });
    } else {
      // If active tab sync could not find DOM, but user entered a manual URL
      if (manualLinkedInUrl.trim()) {
        const handle =
          manualLinkedInUrl.split("/in/")[1]?.replace(/\/$/, "") ||
          "LinkedIn User";
        const manualProfile: LinkedInSelfProfile = {
          fullName: handle.replace(/[-_]/g, " "),
          headline: "",
          currentCompany: "",
          currentRole: "",
          location: "",
          vanityUrl: manualLinkedInUrl.trim(),
          summary: "",
        };
        onLinkedInProfileSynced(manualProfile);
        setStatusMessage({
          type: "success",
          text: `LinkedIn profile URL saved: ${manualLinkedInUrl.trim()}`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text:
            res.error ||
            "Could not find open LinkedIn tab. Open LinkedIn in another tab or enter your profile URL below.",
        });
      }
    }
  };

  const handleFile = async (file: File) => {
    setStatusMessage(null);
    setIsExtracting(true);

    try {
      const result = await extractTextFromFile(file);
      setExtractedResult(result);
      setIsExtracting(false);

      // Trigger high-density Base Fact Sheet parsing
      await parseWithAi(result.text);
    } catch (err: unknown) {
      setIsExtracting(false);
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      setStatusMessage({ type: "error", text: msg });
    }
  };

  const parseWithAi = async (rawText: string) => {
    if (useCustomApiKey && !apiKey.trim()) {
      setStatusMessage({
        type: "error",
        text: "Custom API key is enabled but empty. Please enter your OpenAI API key above or switch to Cloud plan.",
      });
      return;
    }

    setIsParsing(true);
    setStatusMessage(null);

    const activeLinkedInProfile =
      linkedInSelfProfile ||
      (manualLinkedInUrl
        ? {
            fullName: "",
            headline: "",
            currentCompany: "",
            currentRole: "",
            location: "",
            vanityUrl: manualLinkedInUrl.trim(),
            summary: "",
          }
        : undefined);

    const res = await parseResumeToBaseFactSheet(
      rawText,
      apiKey,
      model,
      activeLinkedInProfile,
    );

    setIsParsing(false);

    if (res.success && res.profile) {
      onProfileParsed(res.profile, res.baseFactSheet);
      const milestoneCount = res.baseFactSheet?.careerMilestones.length || 0;
      setStatusMessage({
        type: "success",
        text: `Exhaustive Base Fact Sheet created! Captured ${milestoneCount} career milestones with full metrics and tech stacks. Ground truth is ready.`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Failed to parse resume into Base Fact Sheet.",
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const hasFactSheet = Boolean(
    baseFactSheet &&
    (baseFactSheet.careerMilestones.length > 0 || baseFactSheet.compactBio),
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Resume & LinkedIn Base Fact Grounding
            </h2>
            <p className="text-xs text-slate-500">
              Parses your resume fully without omitting past roles or metrics,
              creating a lean Base Fact Sheet.
            </p>
          </div>
        </div>

        {hasFactSheet && (
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Base Fact Sheet Active
          </span>
        )}
      </div>

      <div className="space-y-5">
        {/* 1. LinkedIn Identity Sync Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-blue-600" />
              <label
                htmlFor="linkedin-profile-url"
                className="text-xs font-bold text-slate-800"
              >
                Your LinkedIn Profile
              </label>
            </div>
            <button
              type="button"
              onClick={handleSyncLinkedIn}
              disabled={isSyncingLinkedIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 transition-colors"
            >
              {isSyncingLinkedIn ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Sync from Open LinkedIn Tab</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="linkedin-profile-url"
              type="text"
              value={manualLinkedInUrl}
              onChange={(e) => setManualLinkedInUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/your-username"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {linkedInSelfProfile?.headline && (
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2 shrink-0 truncate max-w-50">
                {linkedInSelfProfile.headline}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Automatically maps your verified LinkedIn headline and identity to
            avoid manual form entry.
          </p>
        </div>

        {/* 2. Upload Box */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-7 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all"
          role="button"
          tabIndex={0}
          aria-label="Upload resume file"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 text-blue-600 mb-2.5">
            <FileText className="h-5 w-5" />
          </div>

          <p className="text-xs font-semibold text-slate-800">
            Upload your resume (PDF or DOCX)
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Parses complete work history, quantifiable achievements, and
            categorized tech stack
          </p>
        </div>

        {/* Extraction / Parsing State */}
        {(isExtracting || isParsing) && (
          <div className="flex items-center justify-center gap-2.5 rounded-xl bg-blue-50 p-3.5 text-xs font-medium text-blue-800 border border-blue-100">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>
              {isExtracting
                ? "Extracting raw text from document..."
                : "Structuring comprehensive Base Fact Sheet (recording milestones & metrics)..."}
            </span>
          </div>
        )}

        {/* Status banner */}
        {statusMessage && (
          <div
            className={`flex items-start gap-2.5 rounded-xl p-3.5 text-xs border ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            )}
            <span className="flex-1 leading-snug">{statusMessage.text}</span>
          </div>
        )}

        {/* Base Fact Sheet Grounding Snapshot (if available) */}
        {baseFactSheet && baseFactSheet.careerMilestones.length > 0 && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-950">
                  Extracted Ground Truth Fact Sheet
                </span>
              </div>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                ~95% Token Savings per Note
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-semibold">Career Milestones</span>
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {baseFactSheet.careerMilestones.length} Roles Indexed
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  {baseFactSheet.careerMilestones
                    .map((m) => m.company)
                    .join(", ")}
                </p>
              </div>

              <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Layers className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-semibold">Tech & Frameworks</span>
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {
                    [
                      ...baseFactSheet.techStack.languages,
                      ...baseFactSheet.techStack.frameworks,
                      ...baseFactSheet.techStack.toolsAndInfra,
                    ].length
                  }{" "}
                  Technologies
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  {baseFactSheet.techStack.languages
                    .concat(baseFactSheet.techStack.frameworks)
                    .slice(0, 5)
                    .join(", ")}
                </p>
              </div>

              <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Award className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-semibold">Conversational Hooks</span>
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {baseFactSheet.conversationHooks.length} Talking Points
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  Pre-indexed for peer relevance
                </p>
              </div>
            </div>

            {baseFactSheet.compactBio && (
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900">
                  Compact Ground Truth Bio:{" "}
                </span>
                {baseFactSheet.compactBio}
              </div>
            )}
          </div>
        )}

        {/* Re-parse trigger if text was extracted */}
        {extractedResult && !isParsing && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[11px] text-slate-500">
              Loaded:{" "}
              <strong className="text-slate-700">
                {extractedResult.fileName}
              </strong>{" "}
              ({extractedResult.wordCount} words)
            </span>
            <button
              type="button"
              onClick={() => parseWithAi(extractedResult.text)}
              disabled={isParsing || (useCustomApiKey && !apiKey.trim())}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Re-parse Base Fact Sheet
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
