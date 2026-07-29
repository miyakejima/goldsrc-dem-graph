# Black-Box Tooling

The scripts in `tools/blackbox/` are optional utilities for comparing local parser output against upstream Unique KZ payloads.

## Purpose

They help with:

- batch upload automation
- payload collection
- local parse parity checks
- calibration reporting
- graph behavior comparison

## Inputs And Outputs

- Inputs are typically demo folders or previously captured mapping files
- Outputs should go into `re_data/`
- `re_data/` is intentionally treated as generated local workspace and should remain untracked

## Environment Variables

These scripts may require:

- `UNIQUE_AUTH_TOKEN`
- `UNIQUE_CSRF_TOKEN`

Only set them locally when needed. Do not commit secrets, logs, or harvested payloads.

## Typical Workflow

1. Upload demos in batch
2. Fetch upstream payload pairs
3. Parse local pairs with the Rust parser
4. Run parity and calibration reports

Keep this workflow opt-in. The core local graph tester does not depend on upstream access.
