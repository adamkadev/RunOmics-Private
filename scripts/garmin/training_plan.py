"""Sync the athlete's current Garmin Coach training plan phase.

Garmin Coach (an FBT_ADAPTIVE plan) splits a plan into named phases - BUILD,
PEAK, TAPER, TARGET_EVENT_DAY - each with a start/end date. That phase is a
plan intent RunOmics has no way to derive: unlike training status, it isn't a
reading of what happened, it's what the plan calls for.

Two requests, chained by id:

  trainingplan-service/trainingplan/plans              -> every plan, summary only
  trainingplan-service/trainingplan/fbt-adaptive/{id}   -> one plan's phases

The list has no phases; the detail endpoint only works for FBT_ADAPTIVE plans
(manually-created/third-party plans 404 on it), so a plan is skipped rather
than fetched when it isn't one.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from .client import GarminAPIError, GarminClient
from .retry import retry_transient

_DATA_DIR = Path(__file__).parent.parent.parent / "public" / "data"
_PATH = _DATA_DIR / "training_plan.json"


def current_plan_summary(plans: list[dict[str, Any]], today: date) -> dict[str, Any] | None:
    """The FBT_ADAPTIVE plan whose date range covers `today`.

    Several plans can exist (a finished one, a paused one); the one running
    right now is the one whose start/end bracket today. Ties (should Garmin
    ever return overlapping plans) go to the most recently created, since
    `plans` is already newest-first.
    """
    for plan in plans:
        if plan.get("trainingPlanCategory") != "FBT_ADAPTIVE":
            continue
        start = plan.get("startDate")
        end = plan.get("endDate")
        if not start or not end:
            continue
        if start[:10] <= today.isoformat() <= end[:10]:
            return plan
    return None


def normalize_plan(summary: dict[str, Any], detail: dict[str, Any]) -> dict[str, Any] | None:
    """Flatten a plan's id/name/dates plus its phases, or None if it has none."""
    # planPhases and adaptivePlanPhases have been identical in practice; phases
    # is the generic name and covers both an adaptive plan and one grafted onto
    # a fixed schedule (adaptivePlanPhases is Garmin Coach-specific).
    phases = detail.get("planPhases") or detail.get("adaptivePlanPhases")
    if not phases:
        return None

    return {
        "planId": summary.get("trainingPlanId"),
        "name": summary.get("name"),
        "startDate": (summary.get("startDate") or "")[:10],
        "endDate": (summary.get("endDate") or "")[:10],
        "phases": [
            {
                "phase": phase.get("trainingPhase"),
                "startDate": phase.get("startDate"),
                "endDate": phase.get("endDate"),
            }
            for phase in phases
            if phase.get("trainingPhase") and phase.get("startDate") and phase.get("endDate")
        ],
    }


def sync_training_plan(client: GarminClient, today: date | None = None) -> bool:
    """Write the current plan's phases to training_plan.json. Returns True when one was written."""
    today = today or date.today()
    print("Syncing training plan…")

    try:
        plans = retry_transient(lambda: client.get_training_plans()).get("trainingPlanList") or []
    except GarminAPIError as exc:
        print(f"  Warning: training plans fetch failed: {exc}")
        return False

    summary = current_plan_summary(plans, today)
    if summary is None:
        print("  No active Garmin Coach plan.")
        if _PATH.exists():
            _PATH.unlink()
        return False

    plan_id = summary["trainingPlanId"]
    try:
        detail = retry_transient(lambda: client.get_training_plan_detail(plan_id))
    except GarminAPIError as exc:
        print(f"  Warning: training plan {plan_id} detail failed: {exc}")
        return False

    normalized = normalize_plan(summary, detail)
    if normalized is None:
        print(f"  Plan {plan_id} has no phases.")
        return False

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _PATH.write_text(json.dumps(normalized, indent=2) + "\n")
    print(f"  {normalized['name']}: {len(normalized['phases'])} phase(s) written.")
    return True
