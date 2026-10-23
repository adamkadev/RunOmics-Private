from __future__ import annotations

import re

# A planned workout has only its name to go on: no training effect exists until it is run. Checked in order, first
# match wins; the athlete's French naming is the source of truth, plus the coaching plan's English titles.
_SHORT_INTERVAL_TIME_RE = re.compile(r"\d+\s*['’′]\s*/\s*\d+\s*['’′]")
_SHORT_REP_DISTANCE_RE = re.compile(r"\b(?:100|150|200|300|400)\s*m\b")
_LADDER_RE = re.compile(r"\d+\s*m\s*/\s*\d+\s*m")

_KEYWORD_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"anaerob"), "Anaerobic"),
    (re.compile(r"sprint"), "Sprint"),
    (re.compile(r"\bvma\b"), "VO2Max"),
    (re.compile(r"\bvo2"), "VO2Max"),
    (re.compile(r"allure"), "Threshold"),
    (re.compile(r"seuil"), "Threshold"),
    (re.compile(r"threshold"), "Threshold"),
    (re.compile(r"tempo"), "Tempo"),
    (re.compile(r"progressi"), "Tempo"),
    (re.compile(r"\bbase\b"), "Base"),
    (re.compile(r"endurance|footing|recuperation|longue"), "Base"),
]


# Only Garmin Coach's adaptive workouts carry `trainingEffectLabel`, in the FIT `primary_benefit` taxonomy, so it beats
# guessing from the name. Deliberately not keyed off `workoutPhrase`, which mixes intensity with plan intent and has no
# bounded set.
_TRAINING_EFFECT_LABEL_TYPES: dict[str, str] = {
    "RECOVERY": "Base",
    "BASE": "Base",
    "AEROBIC_BASE": "Base",
    "TEMPO": "Tempo",
    "THRESHOLD": "Threshold",
    "LACTATE_THRESHOLD": "Threshold",
    "VO2MAX": "VO2Max",
    "ANAEROBIC": "Anaerobic",
    "ANAEROBIC_CAPACITY": "Anaerobic",
    # Garmin labels its short-rep neuromuscular sessions SPEED; there is no SPRINT label in practice.
    "SPEED": "Sprint",
    "SPRINT": "Sprint",
}


# Garmin Coach names its sessions after the type alone ("Base", "Seuil"), which says nothing the type badge doesn't,
# so such a name is replaced by the session's structure (garmin_workout.main_set_descriptor).
_COACH_TYPE_WORDS: dict[str, str] = {
    "base": "Base",
    "endurance": "Base",
    "footing": "Base",
    "recuperation": "Base",
    "recovery": "Base",
    "tempo": "Tempo",
    "seuil": "Threshold",
    "threshold": "Threshold",
    "vma": "VO2Max",
    "vo2 max": "VO2Max",
    "vo2max": "VO2Max",
    "anaerobique": "Anaerobic",
    "anaerobic": "Anaerobic",
    "sprint": "Sprint",
    "vitesse": "Sprint",
}


# Reverts a name wrongly reduced to a bare duration ("30'") to the type word when there is no richer descriptor.
_TYPE_TO_COACH_WORD: dict[str, str] = {
    "Base": "Base",
    "Tempo": "Tempo",
    "Threshold": "Seuil",
    "VO2Max": "VMA",
    "Anaerobic": "Anaérobique",
    "Sprint": "Sprint",
}


def coach_word_for_type(activity_type: str) -> str | None:
    return _TYPE_TO_COACH_WORD.get(activity_type)


def coach_type_word(name: str) -> str | None:
    """"Seuil" or "Seuil - 3x8'@4:20"; None otherwise, so an athlete's own rename is never treated as disposable."""
    normalized = _normalize(name)
    if normalized in _COACH_TYPE_WORDS:
        return _COACH_TYPE_WORDS[normalized]

    head = normalized.split(" - ", 1)[0].strip()
    return _COACH_TYPE_WORDS.get(head)


# The same map as COACHING_TO_ACTIVITY_TYPE (src/domain/coaching/types.ts).
_COACHING_TYPES: dict[str, str] = {
    "easy": "Base",
    "recovery": "Base",
    "long_run": "Base",
    "tempo": "Tempo",
    "threshold": "Threshold",
    "vo2max": "VO2Max",
    "anaerobic": "Anaerobic",
    "sprint": "Sprint",
    "race": "Race",
}


def type_from_coaching_type(coaching_type: str | None) -> str | None:
    return _COACHING_TYPES.get(coaching_type or "")


def type_from_training_effect_label(label: str | None) -> str | None:
    """Garmin Coach labels rest days "INVALID", which maps to None."""
    if not label:
        return None
    return _TRAINING_EFFECT_LABEL_TYPES.get(label.strip().upper())


def infer_planned_type(name: str) -> str:
    normalized = _normalize(name)

    if _SHORT_INTERVAL_TIME_RE.search(normalized):
        return "Anaerobic"
    if _SHORT_REP_DISTANCE_RE.search(normalized):
        return "VO2Max"

    for pattern, activity_type in _KEYWORD_RULES:
        if pattern.search(normalized):
            return activity_type

    if _LADDER_RE.search(normalized):
        return "Threshold"

    return "Base"


def _normalize(name: str) -> str:
    s = name.lower()
    for accented, plain in {"é": "e", "è": "e", "ê": "e", "à": "a", "ô": "o", "û": "u"}.items():
        s = s.replace(accented, plain)
    return s
