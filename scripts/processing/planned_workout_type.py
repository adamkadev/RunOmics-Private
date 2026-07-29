from __future__ import annotations

import re

# Keyword -> ActivityType rules for planned (not yet run) workouts. A planned
# workout has only a Garmin workout name to go on - no training-effect data
# exists yet (that's only known once the activity is completed and parsed from
# the FIT file, see processing/activity_type.py). Checked in order, first match
# wins; this athlete's French workout naming convention is the source of truth,
# not the noisier post-hoc training-effect labels on completed activities.
_SHORT_INTERVAL_TIME_RE = re.compile(r"\d+\s*['’′]\s*/\s*\d+\s*['’′]")
_SHORT_REP_DISTANCE_RE = re.compile(r"\b(?:100|150|200|300|400)\s*m\b")
_LADDER_RE = re.compile(r"\d+\s*m\s*/\s*\d+\s*m")

_KEYWORD_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"anaerob"), "Anaerobic"),
    (re.compile(r"sprint"), "Sprint"),
    (re.compile(r"\bvma\b"), "VO2Max"),
    (re.compile(r"allure"), "Threshold"),
    (re.compile(r"seuil"), "Threshold"),
    (re.compile(r"tempo"), "Tempo"),
    (re.compile(r"progressi"), "Tempo"),
    (re.compile(r"\bbase\b"), "Base"),
    (re.compile(r"endurance|footing|recuperation|longue"), "Base"),
]


# Garmin's `trainingEffectLabel` for a planned workout -> ActivityType. Only
# Garmin Coach's adaptive workouts carry it, and it's the same taxonomy as the
# FIT `primary_benefit` enum used for *completed* activities (see
# processing/activity_type.py), so when present it beats guessing from the name.
#
# Deliberately NOT keyed off the sibling `workoutPhrase`, which looks similar
# but is a finer-grained coaching taxonomy on a different axis: observed values
# include AEROBIC_LOW_SHORTAGE_BASE, ANAEROBIC_SPEED, LONG_WORKOUT and
# FORCED_REST, i.e. it mixes intensity with plan intent and has no bounded set
# we could map exhaustively.
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
    # Garmin labels its short-rep neuromuscular sessions SPEED (e.g. "Sprint",
    # 3x3x0:15@2:45/km); there is no separate SPRINT label in practice.
    "SPEED": "Sprint",
    "SPRINT": "Sprint",
}


# Garmin Coach names each of its own sessions after the session type and
# nothing else ("Base", "Seuil", "Anaérobique"), unlike third-party plans whose
# names already spell the session out ("9 x 400m (R=1 min)"). Such a name says
# nothing the type badge next to it doesn't already say, so it gets replaced by
# the session's real structure - see garmin_workout.main_set_descriptor.
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


# Canonical Garmin Coach display word per ActivityType - the inverse of
# _COACH_TYPE_WORDS, used to revert a name/description that was wrongly
# reduced to a bare duration ("30'") back to the type word ("Base") when
# there's no richer descriptor available to replace it with instead.
_TYPE_TO_COACH_WORD: dict[str, str] = {
    "Base": "Base",
    "Tempo": "Tempo",
    "Threshold": "Seuil",
    "VO2Max": "VMA",
    "Anaerobic": "Anaérobique",
    "Sprint": "Sprint",
}


def coach_word_for_type(activity_type: str) -> str | None:
    """The canonical Garmin Coach display word for an ActivityType, or None
    for a type Garmin Coach never labels its own sessions with."""
    return _TYPE_TO_COACH_WORD.get(activity_type)


def coach_type_word(name: str) -> str | None:
    """ActivityType when `name` is a Garmin Coach session-type word,
    optionally followed by a structure descriptor ("Seuil" or "Seuil - 3x8'@4:20").
    None for anything else, so a third-party plan's descriptive name or an
    athlete's own rename is never treated as disposable.

    Descriptor patterns (e.g. "Seuil - 3x8:00@4:20/km", "Sprint - 2x3x0:15@2:45/km")
    are recognized and will be normalized, whether already folded into the name or
    added later."""
    normalized = _normalize(name)
    # Check bare word first: "Base", "Seuil", etc.
    if normalized in _COACH_TYPE_WORDS:
        return _COACH_TYPE_WORDS[normalized]

    # Check word + descriptor: "Seuil - 3x8@4:20" -> extract "Seuil"
    head = normalized.split(" - ", 1)[0].strip()
    return _COACH_TYPE_WORDS.get(head)


def type_from_training_effect_label(label: str | None) -> str | None:
    """ActivityType for Garmin's own training-effect label, or None when there
    is no label or it isn't one we map - notably "INVALID", which Garmin Coach
    uses for rest days. Caller falls back to `infer_planned_type`."""
    if not label:
        return None
    return _TRAINING_EFFECT_LABEL_TYPES.get(label.strip().upper())


def infer_planned_type(name: str) -> str:
    """Guess the ActivityType of a planned workout from its Garmin workout name."""
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
