"""Sync Garmin's own training status and load balance.

Two metrics-service endpoints, both keyed by device:

  trainingstatus/daily/{date}      one record per day, backfillable
  trainingloadbalance/latest/{date} a rolling 4-week snapshot, today only

The daily status carries what RunOmics currently re-derives by hand: an acute /
chronic load ratio computed on Firstbeat load rather than on kilometres, and
the watch's own status phrase. The load balance carries what RunOmics cannot
derive at all - Garmin's personalised target range per intensity bucket.

Only the status is backfilled. The balance is a 4-week aggregate whose targets
move slowly, so a daily snapshot of the current values is enough and halves the
request count.
"""

from __future__ import annotations

import json
import re
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from .client import GarminAPIError, GarminClient
from .retry import retry_transient

_DATA_DIR = Path(__file__).parent.parent.parent / "public" / "data"
_STATUS_PATH = _DATA_DIR / "training_status.json"
_BALANCE_PATH = _DATA_DIR / "training_load_balance.json"

_RATE_LIMIT_PAUSE = 1.0
# Days already stored that we re-fetch anyway: Garmin revises the most recent
# ones as later activities land.
_REFRESH_WINDOW_DAYS = 7


def _primary_device(by_device: Any) -> dict[str, Any] | None:
    """The entry for the primary training device.

    Garmin keys these payloads by device id. Falling back to the first entry
    would silently mix two watches' series together.
    TODO: on a watch change, key the stored days by device id so the switch is
    visible instead of appearing as a discontinuity in one series.
    """
    if not isinstance(by_device, dict):
        return None

    entries = [entry for entry in by_device.values() if isinstance(entry, dict)]
    for entry in entries:
        if entry.get("primaryTrainingDevice"):
            return entry
    return entries[0] if entries else None


def _status_label(phrase: Any) -> str | None:
    """`RECOVERY_2` -> `recovery`.

    The numeric `trainingStatus` code is undocumented, but the feedback phrase
    is stable and self-describing: a status name plus a variant number.
    """
    if not isinstance(phrase, str) or not phrase:
        return None
    return re.sub(r"_\d+$", "", phrase).lower()


def normalize_training_status(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Flatten one day's status, or None when the watch recorded nothing."""
    entry = _primary_device(payload.get("latestTrainingStatusData"))
    if entry is None:
        return None

    acute = entry.get("acuteTrainingLoadDTO") or {}
    day = {
        "status": _status_label(entry.get("trainingStatusFeedbackPhrase")),
        "statusCode": entry.get("trainingStatus"),
        "feedback": entry.get("trainingStatusFeedbackPhrase"),
        "fitnessTrend": entry.get("fitnessTrend"),
        "acuteLoad": acute.get("dailyTrainingLoadAcute"),
        "chronicLoad": acute.get("dailyTrainingLoadChronic"),
        "acwr": acute.get("dailyAcuteChronicWorkloadRatio"),
        "acwrStatus": acute.get("acwrStatus"),
        "chronicLoadMin": acute.get("minTrainingLoadChronic"),
        "chronicLoadMax": acute.get("maxTrainingLoadChronic"),
        "deviceId": entry.get("deviceId"),
    }

    # A day with no load and no status is a day the watch was not worn; storing
    # it would pad the series with holes that look like real zeroes.
    if day["status"] is None and day["acuteLoad"] is None:
        return None

    return {key: value for key, value in day.items() if value is not None}


def normalize_load_balance(payload: dict[str, Any]) -> dict[str, Any] | None:
    entry = _primary_device(payload.get("metricsTrainingLoadBalanceDTOMap"))
    if entry is None:
        return None

    balance = {
        "date": entry.get("calendarDate"),
        "feedback": entry.get("trainingBalanceFeedbackPhrase"),
        "aerobicLow": entry.get("monthlyLoadAerobicLow"),
        "aerobicLowMin": entry.get("monthlyLoadAerobicLowTargetMin"),
        "aerobicLowMax": entry.get("monthlyLoadAerobicLowTargetMax"),
        "aerobicHigh": entry.get("monthlyLoadAerobicHigh"),
        "aerobicHighMin": entry.get("monthlyLoadAerobicHighTargetMin"),
        "aerobicHighMax": entry.get("monthlyLoadAerobicHighTargetMax"),
        "anaerobic": entry.get("monthlyLoadAnaerobic"),
        "anaerobicMin": entry.get("monthlyLoadAnaerobicTargetMin"),
        "anaerobicMax": entry.get("monthlyLoadAnaerobicTargetMax"),
        "deviceId": entry.get("deviceId"),
    }

    if balance["aerobicLow"] is None and balance["aerobicHigh"] is None:
        return None

    return {key: value for key, value in balance.items() if value is not None}


def _load_days() -> dict[str, Any]:
    if not _STATUS_PATH.exists():
        return {}
    try:
        return json.loads(_STATUS_PATH.read_text()).get("days") or {}
    except Exception:
        return {}


def dates_to_fetch(start: date, today: date, stored: dict[str, Any]) -> list[date]:
    """Every day from `start` that we have not stored, plus a trailing refresh window."""
    refresh_from = today - timedelta(days=_REFRESH_WINDOW_DAYS)
    days: list[date] = []
    current = start
    while current <= today:
        if current.isoformat() not in stored or current >= refresh_from:
            days.append(current)
        current += timedelta(days=1)
    return days


def sync_training_status(client: GarminClient, start: date, today: date | None = None) -> int:
    """Backfill missing days into training_status.json. Returns the day count written.

    The first run walks the whole history one request per day; every run after
    that only covers new days and the refresh window.
    """
    today = today or date.today()
    stored = _load_days()
    pending = dates_to_fetch(start, today, stored)

    if not pending:
        print("Training status up to date.")
        return len(stored)

    print(f"Syncing training status for {len(pending)} day(s)…")
    fetched = 0
    for day in pending:
        iso = day.isoformat()
        try:
            payload = retry_transient(lambda: client.get_training_status(iso))
        except GarminAPIError as exc:
            print(f"  Warning: training status {iso} failed: {exc}")
            continue

        normalized = normalize_training_status(payload)
        if normalized is not None:
            stored[iso] = normalized
            fetched += 1
        time.sleep(_RATE_LIMIT_PAUSE)

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _STATUS_PATH.write_text(
        json.dumps({"days": dict(sorted(stored.items()))}, indent=2) + "\n"
    )
    print(f"  {fetched} day(s) recorded, {len(stored)} total.")
    return len(stored)


def sync_load_balance(client: GarminClient, today: date | None = None) -> bool:
    """Snapshot today's intensity balance. Returns True when it was written."""
    iso = (today or date.today()).isoformat()
    print("Syncing training load balance…")
    try:
        payload = retry_transient(lambda: client.get_training_load_balance(iso))
    except GarminAPIError as exc:
        print(f"  Warning: training load balance fetch failed: {exc}")
        return False

    balance = normalize_load_balance(payload)
    if balance is None:
        print("  No load balance recorded for today.")
        return False

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _BALANCE_PATH.write_text(json.dumps(balance, indent=2, sort_keys=True) + "\n")
    print(f"  {balance.get('feedback', 'written')}")
    return True
