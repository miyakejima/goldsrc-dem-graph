# Contributing

## Scope

Keep this repository focused on the standalone local graph tester. Avoid reintroducing local caches, harvested payloads, build outputs, or machine-specific state.

## Before Opening A Change

1. Keep the change set narrow and intentional.
2. Update docs when setup, exports, or workflow behavior changes.
3. Do not commit generated data from `re_data/`.

## Frontend And Server Changes

When changing `src/` or `server/`:

1. Run `npm install` if dependencies are missing.
2. Run `npm run build`.
3. Smoke-test the local app with `npm run dev`.

## Parser Changes

When changing `parser-rs/`:

1. Run `cargo check` inside `parser-rs`.
2. If parser output changes, update any related docs and black-box expectations.

## Tooling Changes

When changing `tools/`:

1. Keep scripts source-only and path-portable.
2. Do not bake secrets or harvested local data into the repo.
3. Route generated outputs into `re_data/`.

## Publishing Hygiene

Before publishing:

1. Confirm `git status` only shows intended source files.
2. Confirm `node_modules`, `dist`, `parser-rs/target`, and `re_data` outputs are ignored.
3. Confirm docs use relative links only.
