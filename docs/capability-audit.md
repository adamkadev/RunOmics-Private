# Garmin capability audit

The capability audit is a manual, read-only diagnostic. It calls the same
`GarminClient` endpoints for each configured athlete, writes no RunOmics data,
and uploads only an allowlisted capability summary to the workflow run.

## Run both profiles

1. Push the branch containing `.github/workflows/capability-audit.yml`.
2. Open **Actions → Audit Garmin Capabilities → Run workflow**.
3. Choose `all` to run the exact same probe plan against the `adam` and
   `lamiaa` GitHub Environments. A single UTC `asOf` date is shared by both
   jobs.
4. Download these artifacts from the completed run:
   - `garmin-capability-adam-<run id>`
   - `garmin-capability-lamiaa-<run id>`
   - `garmin-capability-comparison-<run id>`

The combined artifact contains `adam.json`, `lamiaa.json`, `comparison.json`,
and a review-friendly `comparison.md`. Artifacts expire after 30 days and are
never committed or pushed to an athlete data repository.

Selecting one profile runs only that environment and produces its individual
report. It intentionally does not produce a comparison artifact.

## Interpret classifications

- `observed`: at least one valid sample was found.
- `not_observed`: the request succeeded and its valid response contained no
  sample in the fixed observation window. This does **not** mean unsupported.
- `unsupported`: an authenticated stable feature endpoint returned a genuine
  404 or 410.
- `unknown`: the probe could not establish support.

`probeStatus: temporary_error` records a 429, 5xx, timeout, connection or DNS
failure. It never changes existing observed support. An authentication failure
stops that profile job without writing a report.

The number in `samples` is a count only. Reports never contain metric values,
account/profile identifiers, Garmin UUIDs, device or activity IDs, serial
numbers, coordinates, request URLs, secrets, or raw payloads.

## Optional local baseline

The probe reads `GARMIN_SECRET` from the environment only. Never pass it on the
command line.

Load the secret without putting it in shell history, then run the probe:

```bash
read -r -s GARMIN_SECRET
export GARMIN_SECRET
python scripts/diagnostics/probe_garmin_capabilities.py \
  --as-of 2026-08-28 \
  --output /tmp/garmin-capabilities.json
```

A previous sanitized report can preserve established support if the new run
hits only transient failures:

```bash
python scripts/diagnostics/probe_garmin_capabilities.py \
  --as-of 2026-08-28 \
  --previous-report /tmp/previous-capabilities.json \
  --output /tmp/garmin-capabilities.json
```

Only reports produced by this diagnostic schema are accepted as baselines. Run
`unset GARMIN_SECRET` when the local audit is complete.
