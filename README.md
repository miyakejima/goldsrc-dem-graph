# GoldSrc Demo Graph

**Free, open-source, serverless GoldSrc `.dem` file analyzer and visualizer for Counter-Strike 1.6 KZ/Bhop demos.**

Parses GoldSrc demo frames directly in your browser with sub-15ms parsing speed, rendering a 1:1 authentic interactive graph (Engine FPS, Real FPS, MouseX, MouseX Speed, Jump Height, Strafe Sync, and Techniques) — **zero server dependencies, zero installations, 100% free forever on GitHub Pages.**

---

## Live Demo & GitHub Pages

You can run this application entirely in your browser without installing anything:

**Live URL**: `https://miyakejima.github.io/goldsrc-dem-graph/`

### Features:
- **Instant In-Browser Parser**: Drop any `.dem` file onto the window and parse 100,000+ frames in ~13ms using pure TypeScript WebAssembly/Buffer algorithms. No file data ever leaves your computer.
- **Pre-Bundled Sample Dataset**: Automatically loads full demo telemetry on visit for instant exploration.
- **Authentic 1:1 Visual Parity with Unique-KZ**:
  - **Engine FPS**: Frame timeline with 100 / 83 / 50 / 25 fps thresholds and technique markers.
  - **Real FPS**: Frametime-derived client FPS accurately rendered.
  - **MouseX**: Absolute yaw angles over time with 180° discontinuity handling and interactive jump popup breakdown.
  - **MouseX Speed**: Per-frame yaw angular velocity with strafe oscillation harmonics.
  - **Jump Height**: Parabolic demo measured height vs ballistic aerodynamic curve comparison.
  - **Authentic 5-Column HUD**: Frame, Server Time, Real/Engine FPS, MSec, Origin, Velocity, Weapon, Maxspeed, Movement keys, Flags, Buttons, and Console Commands.
- **Responsive Controls**:
  - **Playback**: Space to play / pause real-time playback.
  - **Frame Scrubbing**: Arrow keys or `A` / `D` to scrub frame-by-frame (`Shift` for x10, `Ctrl` for x100).
  - **Quick Navigation**: `Home` for start frame, `End` for stop frame.
  - **Open Demo**: `Ctrl+O` or click "Open demo" or simply drag and drop any `.dem` file.
  - **Copy Technique**: Click any jump bar to copy its full stats string to clipboard.

---

## GitHub Actions & Deployment

This repository includes an automated GitHub Pages deployment workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Enabling GitHub Pages in your Fork / Repo:
1. Navigate to your repository on GitHub.
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. Push to `main` (or run the workflow manually under **Actions** → **Deploy to GitHub Pages**).
5. Your site is live at `https://<username>.github.io/<repository>/`!

---

## Local Development

If you wish to develop or run the application locally:

```bash
# 1. Clone the repository
git clone https://github.com/miyakejima/goldsrc-dem-graph.git
cd goldsrc-dem-graph

# 2. Install dependencies
npm install

# 3. Start local development server (API + Web)
npm run dev
```

### Building & Previewing Locally:
```bash
# Build web app
npm run build --workspace=@kz-rebuild/web

# Preview production build locally
npm run preview --workspace=@kz-rebuild/web
```

---

## Architecture & Workspaces

```
goldsrc-dem-graph/
├── apps/
│   ├── web/                     # React 19 + Vite frontend (deployed to GitHub Pages)
│   │   ├── src/
│   │   │   ├── App.tsx          # 1:1 Graph viewer, canvas rendering & HUD
│   │   │   ├── clientParser.ts  # Pure client-side .dem parser & analytics engine
│   │   │   └── api.ts           # Hybrid data loader (In-memory / API / static fallback)
│   │   └── public/
│   │       └── sample-dataset.json # Pre-compiled demo dataset for instant zero-server load
│   └── api/                     # Optional Node.js backend server
├── packages/
│   ├── parser/                  # High-performance GoldSrc demo parser
│   ├── analytics/               # AMXX uq_jumpstats & kz_ljs_xm movement analytics
│   ├── shared-types/            # Strict TypeScript contracts across pipeline
│   └── physics/                 # GoldSrc pm_shared simulation & collision models
└── .github/
    └── workflows/
        └── deploy.yml           # Automated GitHub Pages CI/CD workflow
```

---

## License

ISC License.
