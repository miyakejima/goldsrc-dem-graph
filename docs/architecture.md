# Architecture

The project has four main layers:

## 1. Frontend

- `src/main.js` boots the app UI
- `src/upstream/` contains the extracted graph renderer and related graph modules
- `src/export/` contains CSV export logic

## 2. Local Dev Server

- `server/dev-server.js` runs Express and Vite in middleware mode
- it accepts uploaded `.dem` files
- it ensures the parser binary exists
- it invokes the parser and returns graph payload JSON to the frontend

## 3. Rust Parser

- `parser-rs/` is a standalone Cargo crate
- it parses GoldSrc `.dem` input and writes graph-oriented JSON
- the local server builds it on demand if the release binary is missing

## 4. Tooling

- `tools/blackbox/` contains optional parity and calibration scripts
- `tools/restart-dev.ps1` is a Windows convenience helper for restarting the local server
- `re_data/` is the generated workspace used by tooling and should stay untracked

## Local Runtime Flow

1. The user starts the local app with `npm run dev`.
2. The Express dev server starts Vite in middleware mode.
3. The browser uploads a `.dem` file through `/api/parse-dem`.
4. The server builds the parser if needed, runs it, and returns the parsed JSON payload.
5. The frontend renders the graph locally and enables export actions.

## Publishing Guidance

- Keep the repository source-only.
- Do not commit build outputs or generated parity data.
- Keep secrets and harvested upstream data out of source control.
