import React from "react";
import { ThemeToggle } from "./ThemeToggle";

interface AppHeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  activeDemoName: string;
  activeMapName: string;
  demoCount: number;
  framesCount?: number;
  durationSeconds?: number;
  techniquesCount?: number;
  onOpenLibrary: () => void;
  onTriggerUpload: () => void;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

export function AppHeader({
  theme,
  onToggleTheme,
  activeDemoName,
  activeMapName,
  demoCount,
  framesCount,
  durationSeconds,
  techniquesCount,
  onOpenLibrary,
  onTriggerUpload
}: AppHeaderProps) {
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <header className="tech-header" role="banner">
      {/* Brand Terminal Console */}
      <div className="header-cell header-cell-brand">
        <div className="brand-group">
          <span className="brand-terminal-symbol">//</span>
          <span className="brand-name">KZ TELEMETRY</span>
          <span className="brand-status-tag">
            <span className="status-led-pulse" />
            CLIENT RASTERIZER
          </span>
        </div>
      </div>

      {/* Center Precision Telemetry Readout */}
      <div className="header-cell header-cell-center">
        <button
          type="button"
          className="tech-readout-pill"
          onClick={onOpenLibrary}
          title="Click to open demo library [L]"
        >
          <div className="readout-primary">
            <span className="readout-label">MAP</span>
            <span className="readout-map">{activeMapName || "STANDBY"}</span>
            <span className="readout-sep">/</span>
            <span className="readout-filename" title={activeDemoName}>
              {activeDemoName || "No demo loaded"}
            </span>
          </div>

          <div className="readout-telemetry-stats">
            {techniquesCount !== undefined && techniquesCount > 0 && (
              <span className="readout-chip chip-techniques">
                {techniquesCount} JUMPS
              </span>
            )}
            {durationSeconds !== undefined && durationSeconds > 0 && (
              <span className="readout-chip chip-time">
                {formatDuration(durationSeconds)}
              </span>
            )}
            {framesCount !== undefined && framesCount > 0 && (
              <span className="readout-chip chip-frames">
                {framesCount.toLocaleString()}F
              </span>
            )}
          </div>

          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="readout-chevron"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Right Controls Bar */}
      <div className="header-cell header-cell-actions">
        <button
          type="button"
          className="tech-btn tech-btn-action"
          onClick={onTriggerUpload}
          title="Upload local .dem file [O]"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <span className="btn-text">OPEN DEMO</span>
          <kbd className="tech-kbd">O</kbd>
        </button>

        <button
          type="button"
          className="tech-btn tech-btn-library"
          onClick={onOpenLibrary}
          title="Open Demo Library Vault [L]"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          <span className="btn-text">LIBRARY</span>
          <span className="tech-count-badge">{demoCount}</span>
          <kbd className="tech-kbd">L</kbd>
        </button>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        <button
          type="button"
          className="tech-icon-btn"
          onClick={toggleFullscreen}
          title="Toggle Fullscreen [F]"
          aria-label="Toggle Fullscreen"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" x2="14" y1="3" y2="10" />
            <line x1="3" x2="10" y1="21" y2="14" />
          </svg>
        </button>
      </div>
    </header>
  );
}
