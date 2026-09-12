import React from 'react';
import { Target, Building2, Briefcase, CheckCircle2, Compass } from 'lucide-react';
import { JobTargetSettings, JobOutreachGoal } from '../types/extension-types';

interface JobTargetConfigProps {
  settings: JobTargetSettings;
  onChange: (updated: JobTargetSettings) => void;
}

const OUTREACH_GOALS: Array<{
  id: JobOutreachGoal;
  title: string;
  description: string;
}> = [
  {
    id: 'applied_followup',
    title: 'Applied & Following Up',
    description: 'Politely let future teammates know you applied and express genuine enthusiasm for their domain.'
  },
  {
    id: 'seeking_referral',
    title: 'Seeking Advice or Referral',
    description: 'Connect with an insider before applying to ask for advice or explore a potential referral.'
  },
  {
    id: 'informational_chat',
    title: 'Culture & Tech Stack Inquiry',
    description: 'Ask for a quick pointer on what it is like working on their specific engineering challenges.'
  },
  {
    id: 'hiring_manager',
    title: 'Direct Hiring Outreach',
    description: 'Concise, high-value outreach tailored for hiring managers and department heads.'
  }
];

export const JobTargetConfig: React.FC<JobTargetConfigProps> = ({ settings, onChange }) => {
  const handleToggle = (enabled: boolean) => {
    onChange({
      ...settings,
      enabled
    });
  };

  const handleFieldChange = (field: keyof JobTargetSettings, value: unknown) => {
    onChange({
      ...settings,
      [field]: value
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
              Target Company & Job Application Mode
            </h2>
            <p className="text-xs text-slate-500">
              Customizes messages when connecting with employees at companies you plan to work at or have applied to.
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
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
        </label>
      </div>

      {settings.enabled ? (
        <div className="space-y-4">
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
                  onChange={(e) => handleFieldChange('targetCompany', e.target.value)}
                  placeholder="e.g. Stripe, Google, Airbnb, Vercel"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <Building2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                The company where the people you are messaging work.
              </p>
            </div>

            {/* Target Role Applied */}
            <div>
              <label
                htmlFor="target-role-applied"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Role Applied / Targeting
              </label>
              <div className="relative">
                <input
                  id="target-role-applied"
                  type="text"
                  value={settings.targetRole}
                  onChange={(e) => handleFieldChange('targetRole', e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <Briefcase className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Specific position you submitted or want to interview for.
              </p>
            </div>
          </div>

          {/* Application Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Application Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleFieldChange('applicationStatus', 'applied')}
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  settings.applicationStatus === 'applied'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Already Applied</span>
                {settings.applicationStatus === 'applied' && (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleFieldChange('applicationStatus', 'planning_to_apply')}
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  settings.applicationStatus === 'planning_to_apply'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Planning to Apply Soon</span>
                {settings.applicationStatus === 'planning_to_apply' && (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
              </button>
            </div>
          </div>

          {/* Outreach Strategy / Goal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Outreach Strategy Goal
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {OUTREACH_GOALS.map((goal) => {
                const isSelected = settings.outreachGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => handleFieldChange('outreachGoal', goal.id)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-semibold ${
                          isSelected ? 'text-blue-700' : 'text-slate-800'
                        }`}
                      >
                        {goal.title}
                      </span>
                      <div
                        className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{goal.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-200">
          <Compass className="h-4 w-4 text-slate-400 shrink-0" />
          <span>
            Enable this feature when you are actively targeting companies to tailor connection requests for higher response rates and referrals.
          </span>
        </div>
      )}
    </div>
  );
};
