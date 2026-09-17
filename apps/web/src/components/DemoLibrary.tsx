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
    <div className="library-overlay" onClick={onClose}>
      <aside
        className="library-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Demo Library"
      >
        {/* Drawer Header */}
        <div className="library-header">
          <div className="library-title-group">
            <h2 className="library-title">Demo Library</h2>
            <span className="library-count-tag">{demos.length} saved</span>
          </div>
          <button
            type="button"
            className="library-close-btn"
            onClick={onClose}
            aria-label="Close library"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Dropzone */}
        <div
          className={`library-dropzone ${isDraggingOver ? "dragging-over" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dropzone-icon"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="dropzone-text">Drop .dem files here to add to library</span>
        </div>

        {/* Controls: Search & Tabs */}
        <div className="library-controls">
          <div className="library-search-box">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="search-icon"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by map or file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="library-search-input"
            />
          </div>

          <div className="library-tabs">
            <button
              type="button"
              className={`library-tab ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              All ({demos.length})
            </button>
            <button
              type="button"
              className={`library-tab ${filterTab === "favorites" ? "active" : ""}`}
              onClick={() => setFilterTab("favorites")}
            >
              Favorites ({favoritesCount})
            </button>
          </div>
        </div>

        {/* Demo List */}
        <div className="library-list-container">
          {filteredDemos.length === 0 ? (
            <div className="library-empty-state">
              <span className="empty-title">No demos found</span>
              <span className="empty-desc">
                {searchQuery
                  ? "No demos match your search query."
                  : filterTab === "favorites"
                  ? "Star any demo to add it to your favorites."
                  : "Drop a .dem file anywhere to parse and save it."}
              </span>
            </div>
          ) : (
            <ul className="library-list">
              {filteredDemos.map((demo) => {
                const isActive = demo.id === activeDemoId;
                return (
                  <li
                    key={demo.id}
                    className={`library-item ${isActive ? "active-item" : ""}`}
                    onClick={() => onSelectDemo(demo)}
                  >
                    <button
                      type="button"
                      className={`favorite-star-btn ${demo.isFavorite ? "is-fav" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(demo.id);
                      }}
                      title={demo.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      aria-label="Toggle favorite"
                    >
                      <svg
                        width="15"
                        height="15"
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

                    <div className="item-details">
                      <div className="item-header-row">
                        <span className="item-filename" title={demo.filename}>
                          {demo.filename}
                        </span>
                        {isActive && <span className="active-badge">Active</span>}
                      </div>

                      <div className="item-meta-row">
                        <span className="item-map-badge">{demo.mapname || "unknown"}</span>
                        <span className="item-duration">{formatDuration(demo.duration)}</span>
                        <span className="item-frames">{demo.frames.toLocaleString()} frames</span>
                      </div>
                    </div>

                    {demos.length > 1 && (
                      <button
                        type="button"
                        className="item-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDemo(demo.id);
                        }}
                        title="Delete from local library"
                        aria-label="Delete demo"
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
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="library-footer">
          <span className="storage-note">
            Stored locally in browser (IndexedDB) • Zero upload
          </span>
        </div>
      </aside>
    </div>
  );
}
