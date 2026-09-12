import React, { useState } from 'react';
import { User, Plus, X, Briefcase, Award } from 'lucide-react';
import { UserProfile } from '../types/extension-types';

interface ProfileEditorProps {
  profile: UserProfile;
  onChange: (updated: UserProfile) => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onChange }) => {
  const [newSkill, setNewSkill] = useState<string>('');
  const [newHighlight, setNewHighlight] = useState<string>('');

  const handleFieldChange = (field: keyof UserProfile, value: unknown) => {
    onChange({
      ...profile,
      [field]: value
    });
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !profile.skills.includes(trimmed)) {
      onChange({
        ...profile,
        skills: [...profile.skills, trimmed]
      });
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    onChange({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove)
    });
  };

  const handleAddHighlight = () => {
    const trimmed = newHighlight.trim();
    if (trimmed) {
      onChange({
        ...profile,
        experienceHighlights: [...profile.experienceHighlights, trimmed]
      });
      setNewHighlight('');
    }
  };

  const handleRemoveHighlight = (index: number) => {
    onChange({
      ...profile,
      experienceHighlights: profile.experienceHighlights.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <User className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Your Extracted Profile</h2>
          <p className="text-xs text-slate-500">
            This information provides context to OpenAI when drafting your personalized notes.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Name & Role */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="user-full-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              id="user-full-name"
              type="text"
              value={profile.fullName}
              onChange={(e) => handleFieldChange('fullName', e.target.value)}
              placeholder="e.g. Alex Johnson"
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="user-current-role" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Current Role / Title
            </label>
            <div className="relative">
              <input
                id="user-current-role"
                type="text"
                value={profile.currentRole}
                onChange={(e) => handleFieldChange('currentRole', e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <Briefcase className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Professional Summary */}
        <div>
          <label htmlFor="user-summary" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Short Professional Summary
          </label>
          <textarea
            id="user-summary"
            rows={2}
            value={profile.summary}
            onChange={(e) => handleFieldChange('summary', e.target.value)}
            placeholder="Brief 1-2 sentence overview of your background and domain expertise..."
            className="w-full resize-none rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {/* Skills Pills */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Key Skills
          </label>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  aria-label={`Remove skill ${skill}`}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSkill();
                }
              }}
              placeholder="Add a skill (press Enter)..."
              className="flex-1 rounded-lg border border-slate-300 py-1.5 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={handleAddSkill}
              disabled={!newSkill.trim()}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>

        {/* Notable Highlights */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Notable Experience Highlights (2-4 bullets)
          </label>
          <div className="space-y-2 mb-2">
            {profile.experienceHighlights.map((highlight, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-xs text-slate-700"
              >
                <Award className="h-3.5 w-3.5 shrink-0 text-blue-600 mt-0.5" />
                <span className="flex-1">{highlight}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveHighlight(index)}
                  aria-label={`Remove highlight ${index + 1}`}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newHighlight}
              onChange={(e) => setNewHighlight(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddHighlight();
                }
              }}
              placeholder="Add an achievement highlight (e.g. Scaled platform to 1M users)..."
              className="flex-1 rounded-lg border border-slate-300 py-1.5 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={handleAddHighlight}
              disabled={!newHighlight.trim()}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
