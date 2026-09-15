import React from "react";
import {
  Target,
  Building2,
  Briefcase,
  CheckCircle2,
  Compass,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import {
  JobTargetSettings,
  ConversationHookType,
} from "../types/extension-types";

interface JobTargetConfigProps {
  settings: JobTargetSettings;
  onChange: (updated: JobTargetSettings) => void;
}

interface ConversationHookOption {
  id: ConversationHookType;
  title: string;
  badge: string;
  description: string;
  exampleHook: string;
}

const CONVERSATION_HOOKS: ConversationHookOption[] = [
  {
    id: "culture_question",
    title: "Culture and Engineering Pace",
    badge: "High Response Rate",
    description:
      "Ask a low-pressure, sincere question about how the team collaborates and ships.",
    exampleHook:
      '"How has your experience been with team velocity and developer autonomy at Stripe?"',
  },
  {
    id: "tech_discussion",
    title: "Tech Stack and Architecture",
    badge: "Peer-to-Peer",
    description:
      "Engage on a technical nuance or architectural challenge relevant to their stack.",
    exampleHook:
      '"Curious how your team approaches state architecture with React 19 challenges."',
  },
  {
    id: "project_appreciation",
    title: "Product Launch Appreciation",
    badge: "Thoughtful",
    description:
      "Compliment something public the company or engineer built and ask about the key takeaway.",
    exampleHook:
      '"Loved the recent UI redesign launch! What was the most interesting hurdle the team solved?"',
  },
  {
    id: "applied_conversation",
    title: "Applied and Meeting Future Peers",
    badge: "Candidate Warm Intro",
    description:
      "Politely mention your submitted application and ask what they value most about their role.",
    exampleHook:
      '"Submitted my application for Frontend Engineer! Would love to hear what you enjoy most on the team."',
  },
  {
    id: "direct_inquiry",
    title: "Team Challenge Inquiry",
    badge: "For Leads / Managers",
    description:
      "Focused peer outreach asking what key domain problem their group is tackling this quarter.",
    exampleHook:
      '"Following your team\'s work in infrastructure. What is the biggest focus area for the quarter?"',
  },
];

export const JobTargetConfig: React.FC<JobTargetConfigProps> = ({
  settings,
  onChange,
}) => {
  const handleToggle = (enabled: boolean) => {
    onChange({
      ...settings,
      enabled,
    });
  };

  const handleFieldChange = (
    field: keyof JobTargetSettings,
    value: unknown,
  ) => {
    onChange({
      ...settings,
      [field]: value,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Target className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Target Company and Employment Outreach Mode
            </h2>
            <p className="text-xs text-slate-500">
              Customize connection notes for companies you plan to work at or
              have applied to, turning outreach into conversations.
            </p>
          </div>
        </div>

        {/* Enable / Disable Switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
            aria-label="Toggle Target Company Mode"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
        </label>
      </div>

      {settings.enabled ? (
        <div className="space-y-5">
          {/* Target Company & Role Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Company Name */}
            <div>
              <label
                htmlFor="target-company-name"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Target Company Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="target-company-name"
                  type="text"
                  value={settings.targetCompany}
                  onChange={(e) =>
                    handleFieldChange("targetCompany", e.target.value)
                  }
                  placeholder="e.g. Stripe, Airbnb, Google, Linear"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <Building2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                The organization where people you connect with work.
              </p>
            </div>

            {/* Target Role Applied */}
            <div>
              <label
                htmlFor="target-role-applied"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Role Targeted or Applied For
              </label>
              <div className="relative">
                <input
                  id="target-role-applied"
                  type="text"
                  value={settings.targetRole}
                  onChange={(e) =>
                    handleFieldChange("targetRole", e.target.value)
                  }
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <Briefcase className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Position you are targeting or have applied for.
              </p>
            </div>
          </div>

          {/* Application Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Application Status
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  handleFieldChange("applicationStatus", "applied")
                }
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  settings.applicationStatus === "applied"
                    ? "border-blue-600 bg-blue-50/60 text-blue-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>Already Applied</span>
                {settings.applicationStatus === "applied" && (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleFieldChange("applicationStatus", "planning_to_apply")
                }
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  settings.applicationStatus === "planning_to_apply"
                    ? "border-blue-600 bg-blue-50/60 text-blue-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>Planning to Apply</span>
                {settings.applicationStatus === "planning_to_apply" && (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleFieldChange("applicationStatus", "dream_company")
                }
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  settings.applicationStatus === "dream_company"
                    ? "border-blue-600 bg-blue-50/60 text-blue-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>Dream Company Network</span>
                {settings.applicationStatus === "dream_company" && (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
              </button>
            </div>
          </div>

          {/* Conversation Starter Hook Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Conversation Starter Strategy
              </label>
              <span className="text-[11px] text-slate-500">
                Select how you want to spark a genuine two-way conversation
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {CONVERSATION_HOOKS.map((hook) => {
                const isSelected = settings.conversationHook === hook.id;
                return (
                  <button
                    key={hook.id}
                    type="button"
                    onClick={() =>
                      handleFieldChange("conversationHook", hook.id)
                    }
                    className={`text-left rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            isSelected ? "text-blue-900" : "text-slate-800"
                          }`}
                        >
                          {hook.title}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {hook.badge}
                        </span>
                      </div>
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-blue-600 bg-blue-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug mb-1.5">
                      {hook.description}
                    </p>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 font-mono italic border border-slate-100">
                      {hook.exampleHook}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Talking Point / Topic */}
          <div>
            <label
              htmlFor="custom-talking-point"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Specific Technology or Project Focus (Optional)
            </label>
            <div className="relative">
              <input
                id="custom-talking-point"
                type="text"
                value={settings.customTalkingPoint || ""}
                onChange={(e) =>
                  handleFieldChange("customTalkingPoint", e.target.value)
                }
                placeholder="e.g. Next.js 15 migration, distributed caching, design system scaling"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <MessageSquare className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Adds precise technical common ground to show you understand their
              domain.
            </p>
          </div>

          {/* Conversational Strategy Tip */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <span className="font-bold">The Conversation First Rule:</span>{" "}
              Employees are overwhelmed by transactional referral requests.
              Connecting around a genuine technical or culture question starts
              an easy dialogue, creates natural rapport, and dramatically boosts
              your referral and interview odds.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-200">
          <Compass className="h-4 w-4 text-slate-400 shrink-0" />
          <span>
            Enable this feature when connecting with people at companies you
            want to work at. The assistant will tailor notes with open
            conversational questions under 200 characters.
          </span>
        </div>
      )}
    </div>
  );
};
