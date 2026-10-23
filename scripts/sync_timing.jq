def secs: fromdateiso8601;
def clock: if . == null then "-" else (. / 60 | floor | tostring) + ":" + (. % 60 | tostring | if length < 2 then "0" + . else . end) end;

($run[0].created_at | secs) as $t0
| ([$jobs[0].jobs[] | select(.name == $job)][0]) as $me
| ($me.steps | map(select(.completed_at != null and .conclusion != "skipped"))) as $done
| ([$done[] | select(.name == "Commit updated data")][0].completed_at | if . then secs - $t0 else null end) as $pushed
| "### \($job), \($mode) sync",
  "",
  "| From the tap to | m:ss |",
  "|---|---:|",
  "| the sync job running | \(($me.started_at | secs) - $t0 | clock) |",
  "| the data pushed | \($pushed | clock) |",
  "| **the run visible** (app serving it) | \(if $live then $live - $t0 else null end | clock) |",
  "| **the Sync button done** (first ai-insights pass) | \(if $verdict then $verdict - $t0 else null end | clock) |",
  "",
  "| Stage | Starts at | Took |",
  "|---|---:|---:|",
  ($jobs[0].jobs[] | select(.name != $job and .completed_at != null)
    | "| job: \(.name) | \((.started_at | secs) - $t0 | clock) | \((.completed_at | secs) - (.started_at | secs) | clock) |"),
  "| queued: \($job) | \(($me.created_at | secs) - $t0 | clock) | \(($me.started_at | secs) - ($me.created_at | secs) | clock) |",
  ($done[] | "| \(.name) | \((.started_at | secs) - $t0 | clock) | \((.completed_at | secs) - (.started_at | secs) | clock) |"),
  (if $hook and $live then "| Vercel build or data ping, to live | \($hook - $t0 | clock) | \($live - $hook | clock) |" else empty end)
