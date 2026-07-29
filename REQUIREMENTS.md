# Requirements

This project is a local demo parsing and graph rendering toolchain with a JavaScript frontend/server and a Rust parser.

## Host Requirements

| Component | Requirement | Notes |
| --- | --- | --- |
| Operating system | Windows, macOS, or Linux | The project is cross-platform in principle; the convenience restart script is Windows-oriented |
| Browser | Modern Chromium, Firefox, or equivalent | Used to open the local app |
| Git | Recommended | Helpful for publishing and reviewing changes |

## JavaScript Toolchain

| Component | Minimum | Notes |
| --- | --- | --- |
| Node.js | 20+ | Required for Vite, Express, and tooling scripts |
| npm | Bundled with selected Node.js release | Used for dependency install and scripts |

## Rust Toolchain

| Component | Minimum | Notes |
| --- | --- | --- |
| Rust | Stable toolchain | Used to build the parser binary |
| Cargo | Matching selected Rust toolchain | Builds `parser-rs` |

## First-Time Setup

1. Install Node.js and verify `node --version`.
2. Install Rust and verify `cargo --version`.
3. Run `npm install` in the repository root.
4. Start the local app with `npm run dev`.
5. On first parse, allow the local parser build to complete.

## Generated Data And Outputs

- `dist/` is frontend build output
- `node_modules/` is local dependency install state
- `parser-rs/target/` is Rust build output
- `re_data/` is generated analysis workspace and should remain untracked
