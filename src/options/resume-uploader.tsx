import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { extractTextFromFile, TextExtractionResult } from '../services/resume-parser';
import { parseResumeWithOpenAi } from '../services/openai-service';
import { UserProfile } from '../types/extension-types';

interface ResumeUploaderProps {
  apiKey: string;
  model: string;
  onProfileParsed: (profile: UserProfile) => void;
}

export const ResumeUploader: React.FC<ResumeUploaderProps> = ({
  apiKey,
  model,
  onProfileParsed
}) => {
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [extractedResult, setExtractedResult] = useState<TextExtractionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setStatusMessage(null);
    setIsExtracting(true);

    try {
      const result = await extractTextFromFile(file);
      setExtractedResult(result);
      setIsExtracting(false);

      // If user has API key, trigger OpenAI parsing automatically or prompt
      if (apiKey.trim()) {
        await parseWithAi(result.text);
      } else {
        setStatusMessage({
          type: 'success',
          text: `Extracted ${result.wordCount} words from ${result.fileName}. Enter your OpenAI API key above to parse into structured fields.`
        });
      }
    } catch (err: unknown) {
      setIsExtracting(false);
      const msg = err instanceof Error ? err.message : 'Failed to parse file';
      setStatusMessage({ type: 'error', text: msg });
    }
  };

  const parseWithAi = async (rawText: string) => {
    if (!apiKey.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter and test your OpenAI API key first.'
      });
      return;
    }

    setIsParsing(true);
    setStatusMessage(null);

    const res = await parseResumeWithOpenAi(rawText, apiKey, model);
    setIsParsing(false);

    if (res.success && res.profile) {
      onProfileParsed(res.profile);
      setStatusMessage({
        type: 'success',
        text: 'Resume successfully parsed by OpenAI! You can review and refine your profile below.'
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to parse resume with OpenAI.'
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Upload Resume (PDF or DOCX)</h2>
          <p className="text-xs text-slate-500">
            Processed 100% client-side in your browser. OpenAI extracts your key skills and highlights.
          </p>
        </div>
      </div>

      {/* Upload Box */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all"
        role="button"
        tabIndex={0}
        aria-label="Upload resume file"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
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

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 text-blue-600 mb-3">
          <FileText className="h-6 w-6" />
        </div>

        <p className="text-xs font-semibold text-slate-700">
          Click to choose a file or drag and drop here
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Supports PDF or DOCX up to 10MB
        </p>
      </div>

      {/* Extraction / Parsing State */}
      {(isExtracting || isParsing) && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-3 text-xs font-medium text-blue-700 border border-blue-100">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span>
            {isExtracting ? 'Extracting text client-side...' : 'OpenAI is analyzing and structuring your resume...'}
          </span>
        </div>
      )}

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`mt-4 flex items-start gap-2.5 rounded-lg p-3 text-xs border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          )}
          <span className="flex-1">{statusMessage.text}</span>
        </div>
      )}

      {/* Re-parse button if text is extracted but not yet parsed */}
      {extractedResult && !isParsing && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="text-[11px] text-slate-500">
            Loaded: <span className="font-medium text-slate-700">{extractedResult.fileName}</span> ({extractedResult.wordCount} words)
          </div>
          <button
            type="button"
            onClick={() => parseWithAi(extractedResult.text)}
            disabled={isParsing || !apiKey.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Re-parse with OpenAI
          </button>
        </div>
      )}
    </div>
  );
};
