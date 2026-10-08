import React from "react";

interface OkwuLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const OkwuLogo: React.FC<OkwuLogoProps> = ({
  className = "",
  size = 28,
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Background rounded badge container */}
        <rect width="64" height="64" rx="14" fill="#0f172a" />
        
        {/* Top/Left speech loop arc (Cobalt Blue) */}
        <path
          d="M32 14C22.059 14 14 22.059 14 32C14 35.795 15.176 39.317 17.18 42.226L15.2 48.8L21.774 46.82C24.683 48.824 28.205 50 32 50C41.941 50 50 41.941 50 32C50 22.059 41.941 14 32 14Z"
          fill="#1d4ed8"
          fillOpacity="0.3"
        />

        {/* Interlocking dialogue bubble loop 1 - Primary Blue */}
        <path
          d="M32 17C23.716 17 17 23.716 17 32C17 35.158 17.978 38.089 19.65 40.514L18 46L23.486 44.35C25.911 46.022 28.842 47 32 47C40.284 47 47 40.284 47 32C47 23.716 40.284 17 32 17ZM32 23C36.971 23 41 27.029 41 32C41 36.971 36.971 41 32 41C29.624 41 27.465 40.082 25.845 38.567L22 39.722L23.155 35.877C21.64 34.257 20.722 32.098 20.722 29.722C20.722 26.01 23.732 23 27.444 23L32 23Z"
          fill="#2563eb"
        />

        {/* Counter-interlocking dialogue loop 2 - Electric Cyan */}
        <path
          d="M32 24C36.418 24 40 27.582 40 32C40 33.684 39.479 35.247 38.588 36.541L39.5 39.5L36.541 38.588C35.247 39.479 33.684 40 32 40C27.582 40 24 36.418 24 32C24 27.582 27.582 24 32 24Z"
          fill="#06b6d4"
        />
        
        {/* Core speech nexus dot */}
        <circle cx="32" cy="32" r="3.5" fill="#ffffff" />
      </svg>

      {showText && (
        <span className="font-extrabold tracking-tight text-slate-900 text-base leading-none">
          Okwu
        </span>
      )}
    </div>
  );
};
