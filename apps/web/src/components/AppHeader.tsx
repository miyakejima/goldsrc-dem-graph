import React from "react";
import { ThemeToggle } from "./ThemeToggle";

interface AppHeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  activeDemoName: string;
  activeMapName: string;
  demoCount: number;
  onOpenLibrary: () => void;
  onTriggerUpload: () => void;
}

export function AppHeader({
  theme,
  onToggleTheme,
  activeDemoName,
  activeMapName,
  demoCount,
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
    <header className="app-header">
      <div className="header-left">
        <div className="brand-title">
          <span className="brand-accent">KZ</span> GRAPH
        </div>
        <span className="brand-badge">CLIENT-SIDE</span>
      </div>

      <div className="header-center">
        <button
          type="button"
          className="active-demo-pill"
          onClick={onOpenLibrary}
          title="Click to view all saved demos"
        >
          <span className="demo-pill-map">{activeMapName || "No map"}</span>
          <span className="demo-pill-name">{activeDemoName || "Select demo"}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="demo-pill-chevron"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <div className="header-right">
        <button
          type="button"
          className="header-btn upload-btn"
          onClick={onTriggerUpload}
          title="Upload .dem file (or Ctrl+O)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <span>Upload</span>
        </button>

        <button
          type="button"
          className="header-btn library-btn"
          onClick={onOpenLibrary}
          title="Open Demo Library"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Library</span>
          <span className="library-count-badge">{demoCount}</span>
        </button>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        <button
          type="button"
          className="header-icon-btn"
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
