import React, { useState, useMemo } from "react";
import type { SavedDemoRecord } from "../storage/db";

interface DemoLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  demos: SavedDemoRecord[];
  activeDemoId: string;
  onSelectDemo: (demo: SavedDemoRecord) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteDemo: (id: string) => void;
  onUploadFiles: (files: FileList | File[]) => void;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

function getTechniqueSummary(demo: SavedDemoRecord): string | null {
  const jumps = demo.dataset?.jumps;
  if (!jumps || jumps.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const j of jumps) {
    const key = (j.label || "lj").toUpperCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  const breakdown = Object.entries(counts)
    .map(([lbl, cnt]) => `${cnt} ${lbl}`)
    .join(", ");
  return `${jumps.length} JUMPS (${breakdown})`;
}

export function DemoLibrary({
  isOpen,
  onClose,
  demos,
  activeDemoId,
  onSelectDemo,
  onToggleFavorite,
  onDeleteDemo,
  onUploadFiles
}: DemoLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "favorites">("all");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const filteredDemos = useMemo(() => {
    return demos.filter((d) => {
      if (filterTab === "favorites" && !d.isFavorite) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.filename.toLowerCase().includes(q) ||
        d.mapname.toLowerCase().includes(q)
      );
    });
  }, [demos, filterTab, searchQuery]);

  const favoritesCount = useMemo(() => demos.filter((d) => d.isFavorite).length, [demos]);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer?.files?.length) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  return (
    <div className="vault-overlay" onClick={onClose}>
      <aside
        className="vault-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Demo Telemetry Vault"
      >
        {/* Vault Header */}
        <div className="vault-header">
          <div className="vault-title-block">
            <div className="vault-title-row">
              <span className="vault-terminal-tag">//</span>
              <h2 className="vault-title">DEMO ARCHIVE VAULT</h2>
            </div>
            <span className="vault-subtitle">
              {demos.length} {demos.length === 1 ? "RECORD" : "RECORDS"} CACHED LOCALLY
            </span>
          </div>
          <button
            type="button"
            className="vault-close-btn"
            onClick={onClose}
            aria-label="Close vault"
            title="Close [Esc or L]"
          >
            <kbd className="tech-kbd">ESC</kbd>
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Precision Blueprint Dropzone */}
        <div
          className={`vault-dropzone ${isDraggingOver ? "dragging-active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="dropzone-crosshair">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="dropzone-text-group">
            <span className="dropzone-primary-text">
              DROP .DEM FILES TO RASTERIZE
            </span>
            <span className="dropzone-secondary-text">
              GoldSrc HL1 / CS 1.6 / Unique-KZ Telemetry Parser
            </span>
          </div>
        </div>

        {/* Controls: Search & Industrial Tabs */}
        <div className="vault-controls">
          <div className="vault-search-box">
            <span className="search-prefix">&gt;</span>
            <input
              type="text"
              placeholder="SEARCH BY MAP OR FILE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="vault-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          <div className="vault-tabs">
            <button
              type="button"
              className={`vault-tab ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              ALL RECORDS ({demos.length})
            </button>
            <button
              type="button"
              className={`vault-tab ${filterTab === "favorites" ? "active" : ""}`}
              onClick={() => setFilterTab("favorites")}
            >
              STARRED ({favoritesCount})
            </button>
          </div>
        </div>

        {/* Demo List */}
        <div className="vault-list-container">
          {filteredDemos.length === 0 ? (
            <div className="vault-empty-state">
              <span className="empty-prefix">[NULL_RECORD]</span>
              <span className="empty-title">NO DEMOS MATCH CRITERIA</span>
              <span className="empty-desc">
                {searchQuery
                  ? "Query returned zero matching telemetry records."
                  : filterTab === "favorites"
                  ? "Star any record in the vault to mark as favorite."
                  : "Drop a .dem file to parse and cache telemetry."}
              </span>
            </div>
          ) : (
            <ul className="vault-list">
              {filteredDemos.map((demo) => {
                const isActive = demo.id === activeDemoId;
                const techSummary = getTechniqueSummary(demo);

                return (
                  <li
                    key={demo.id}
                    className={`vault-card ${isActive ? "card-active" : ""}`}
                    onClick={() => onSelectDemo(demo)}
                  >
                    <div className="card-top-row">
                      <div className="card-identity">
                        <span className="card-map-tag">
                          {demo.mapname || "UNKNOWN_MAP"}
                        </span>
                        {isActive && (
                          <span className="card-active-indicator">
                            <span className="active-dot" />
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className={`vault-star-btn ${demo.isFavorite ? "is-fav" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(demo.id);
                        }}
                        title={demo.isFavorite ? "Remove from starred" : "Mark as starred"}
                        aria-label="Toggle star"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill={demo.isFavorite ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    </div>

                    <div className="card-filename" title={demo.filename}>
                      {demo.filename}
                    </div>

                    <div className="card-telemetry-row">
                      <span className="card-metric">
                        <span className="metric-label">TIME:</span> {formatDuration(demo.duration)}
                      </span>
                      <span className="card-metric-sep">/</span>
                      <span className="card-metric">
                        <span className="metric-label">FRAMES:</span> {demo.frames.toLocaleString()}
                      </span>
                    </div>

                    {techSummary && (
                      <div className="card-techniques-row">
                        <span className="tech-summary-label">TECHNIQUES:</span>
                        <span className="tech-summary-text">{techSummary}</span>
                      </div>
                    )}

                    <div className="card-actions-row">
                      <span className="card-load-hint">
                        {isActive ? "Currently viewing" : "Click card to load"}
                      </span>

                      {demos.length > 1 && (
                        <button
                          type="button"
                          className="card-del-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDemo(demo.id);
                          }}
                          title="Delete record from local storage"
                          aria-label="Delete demo"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Vault Footer */}
        <div className="vault-footer">
          <span className="vault-security-note">
            INDEXEDDB LOCAL STORAGE • ZERO EXTERNAL TELEMETRY
          </span>
        </div>
      </aside>
    </div>
  );
}
