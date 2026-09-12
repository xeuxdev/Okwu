import React from 'react';
import { Sliders, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';
import { StylePreferences, TonePreference } from '../types/extension-types';

interface StylePreferencesProps {
  preferences: StylePreferences;
  onChange: (updated: StylePreferences) => void;
}

const TONE_OPTIONS: Array<{
  id: TonePreference;
  label: string;
  description: string;
}> = [
  {
    id: 'conversational',
    label: 'Conversational (Recommended)',
    description: 'Natural, friendly, peer-to-peer style that sounds like a real human.'
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Polite, business-appropriate, and structured.'
  },
  {
    id: 'direct',
    label: 'Direct & Concise',
    description: 'Get straight to the point with maximum brevity.'
  },
  {
    id: 'enthusiastic',
    label: 'Enthusiastic',
    description: 'Energetic, highlighting excitement for shared work or projects.'
  }
];

export const StylePreferencesComponent: React.FC<StylePreferencesProps> = ({
  preferences,
  onChange
}) => {
  const handleToneChange = (tone: TonePreference) => {
    onChange({
      ...preferences,
      tone
    });
  };

  const handleFieldChange = (field: keyof StylePreferences, value: string) => {
    onChange({
      ...preferences,
      [field]: value
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Sliders className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Style & Tone Preferences</h2>
          <p className="text-xs text-slate-500">
            Guide the AI to match your authentic voice and avoid awkward outreach templates.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Tone Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Primary Tone
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {TONE_OPTIONS.map((opt) => {
              const isSelected = preferences.tone === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleToneChange(opt.id)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold ${
                        isSelected ? 'text-blue-700' : 'text-slate-800'
                      }`}
                    >
                      {opt.label}
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
                  <p className="text-[11px] text-slate-500 leading-snug">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Instructions */}
        <div>
          <label
            htmlFor="style-custom-instructions"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Custom Style Instructions
          </label>
          <div className="relative">
            <textarea
              id="style-custom-instructions"
              rows={2}
              value={preferences.customInstructions}
              onChange={(e) => handleFieldChange('customInstructions', e.target.value)}
              placeholder="e.g. Focus on mutual interests or shared technical stacks. Keep sentences short."
              className="w-full resize-none rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <Sparkles className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Things to Avoid */}
        <div>
          <label
            htmlFor="style-things-to-avoid"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Things to Avoid
          </label>
          <div className="relative">
            <textarea
              id="style-things-to-avoid"
              rows={2}
              value={preferences.thingsToAvoid}
              onChange={(e) => handleFieldChange('thingsToAvoid', e.target.value)}
              placeholder="e.g. Do not use generic flattery like 'pick your brain' or sales pitches."
              className="w-full resize-none rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <ShieldAlert className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Sample Note */}
        <div>
          <label
            htmlFor="style-sample-note"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Sample Note You Like (Reference)
          </label>
          <div className="relative">
            <textarea
              id="style-sample-note"
              rows={2}
              value={preferences.sampleNote}
              onChange={(e) => handleFieldChange('sampleNote', e.target.value)}
              placeholder="Hi [Name], loved your insights on [Topic]. Would love to connect and follow your work!"
              className="w-full resize-none rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <MessageSquare className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
