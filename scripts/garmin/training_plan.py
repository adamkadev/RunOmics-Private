"""The fbt-adaptive detail endpoint 404s on manually-created and third-party plans, so only FBT_ADAPTIVE plans are fetched."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from data_directory import get_data_dir
from repository.atomic_write import write_text_atomic
from .client import GarminAPIError, GarminClient
from .retry import retry_transient

_PATH = get_data_dir() / "training_plan.json"


def current_plan_summary(plans: list[dict[str, Any]], today: date) -> dict[str, Any] | None:
    """Overlapping plans go to the most recently created, since Garmin returns `plans` newest-first."""
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
    # adaptivePlanPhases is Garmin Coach-specific; planPhases also covers a plan grafted onto a fixed schedule.
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

    write_text_atomic(_PATH, json.dumps(normalized, indent=2) + "\n")
    print(f"  {normalized['name']}: {len(normalized['phases'])} phase(s) written.")
    return True
