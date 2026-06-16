// English UI strings. To add a language later, create a sibling file (e.g. `fr.ts`)
// with the same shape (`satisfies Strings`) and switch the active locale in `index.ts`.
//
// Conventions:
// - Plain strings for static copy.
// - Functions for interpolated / pluralized copy.
// - Pure number/date formatting stays in `@/lib/formatters`; only human-readable
//   words and units live here.

import type { ActivityType } from '@/domain/activity/types'

export const en = {
  // Locale tag used by Intl-based formatters (dates, numbers).
  locale: 'en-US',

  brand: {
    namePrefix: 'Run',
    nameSuffix: 'Omics',
    // Version number is injected from package.json (see @/lib/version); only the
    // display format lives here so it isn't duplicated across translation files.
    version: (v: string) => `v${v}`,
  },

  nav: {
    items: {
      dashboard: 'Dashboard',
      coach: 'Coach',
      activities: 'Activities',
      calendar: 'Calendar',
      analytics: 'Analytics',
      goals: 'Goals',
      records: 'Records',
      heatmap: 'HeatMap',
      profile: 'Profile',
    },
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },

  meta: {
    description: 'Your personal running training dashboard - stats, maps, trends.',
  },

  theme: {
    toggle: 'Toggle theme',
  },

  units: {
    km: 'km',
    bpm: 'bpm',
    vo2max: 'ml/kg/min',
    spm: 'spm',
    m: 'm',
    ms: 'ms',
    mm: 'mm',
    percent: '%',
    kcal: 'kcal',
    minPerKm: 'min/km',
  },

  common: {
    viewAll: 'View all',
    sessions: (n: number) => `${n} session${n !== 1 ? 's' : ''}`,
    runs: (n: number) => `${n} run${n !== 1 ? 's' : ''}`,
  },

  pages: {
    dashboard: {
      title: 'Dashboard',
      subtitle: (week: number, sessions: number) =>
        `Week ${week} · ${sessions} session${sessions !== 1 ? 's' : ''}`,
    },
    activities: {
      title: 'Activities',
      subtitle: (total: number) => `${total} total activities`,
    },
    calendar: {
      title: 'Calendar',
      subtitle: 'Monthly training overview',
    },
    map: {
      title: 'Running HeatMap',
      routes: (n: number) => `${n} routes`,
      zones: 'Zones',
    },
    notFound: {
      code: '404',
      heading: "This page went on a run and didn't come back.",
      sub: "The route you're looking for doesn't exist.",
      back: 'Back to Dashboard',
    },
  },

  dashboard: {
    stats: {
      distance: 'Distance',
      distanceSub: (lastWeek: string) => `vs ${lastWeek} last week`,
      time: 'Time',
      avgHr: 'Avg HR',
      avgPace: 'Avg Pace',
      thisWeek: 'this week',
      streak: 'Streak',
      streakSub: (best: number) => `best ${best}d`,
      vo2max: 'VO₂max',
      empty: '-',
    },
    recentActivities: {
      title: 'Recent Activities',
    },
    heatmap: {
      title: 'Activity',
      window: '· 12 months',
      days: 'days',
      less: 'Less',
      more: 'More',
      restDay: 'Rest day',
      day: (km: number, runs: number) =>
        `${km} km · ${runs} run${runs > 1 ? 's' : ''}`,
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      weekdays: ['Mon', '', 'Wed', '', 'Fri', '', ''],
    },
    weeklyVolume: {
      title: 'Weekly Volume',
    },
    trainingMix: {
      title: 'Training Mix',
    },
    trainingLoad: {
      title: 'Training Load',
      window: '· last 90 days',
      fitness: 'Fitness',
      fatigue: 'Fatigue',
      form: 'Form',
      status: {
        fresh: 'Fresh',
        neutral: 'Neutral',
        building: 'Building',
        overreaching: 'Overreaching',
      },
      footnote:
        'Fitness = 42-day load average (CTL) · Fatigue = 7-day (ATL) · Form = Fitness - Fatigue (TSB).',
    },
    vo2maxChart: {
      title: 'VO₂max',
      unit: 'ml/kg/min',
      footnote: 'Garmin VO₂max estimate',
    },
  },

  trainingStatus: {
    title: 'Training Status',
    status: {
      productive: 'Productive',
      fresh: 'Fresh',
      overreaching: 'Overreaching',
      recovery: 'Recovery',
      detraining: 'Detraining',
    },
    description: {
      productive: 'Fitness building steadily.',
      fresh: 'Fresh and ready to perform.',
      overreaching: 'Fatigue is high - consider easing off.',
      recovery: 'Load reduced, form recovering.',
      detraining: 'Training volume too low to maintain fitness.',
    },
    risk: {
      low: 'Low risk',
      moderate: 'Moderate risk',
      high: 'High risk',
    },
    loadTrend: {
      building: 'Building',
      maintaining: 'Maintaining',
      tapering: 'Tapering',
      detraining: 'Declining',
    },
    metrics: {
      fitness: 'Fitness',
      fatigue: 'Fatigue',
      form: 'Form',
      fitnessDelta: (d: number) => `${d >= 0 ? '+' : ''}${d} over 2 wk`,
    },
  },

  coach: {
    title: 'Coach',
    subtitle: 'Weekly training analysis',
    thisWeek: 'Last 7 days',
    vsLastWeek: 'vs previous 7 days',
    vsLastYear: 'Same week, last year',
    vsLastYearLabel: 'vs last year',
    sessionTypes: 'Session types',
    loadChanges: 'Load changes (7d)',
    suggestions: 'Recommendations',
    noData: 'Not enough data yet.',
    fitness: 'Fitness',
    fatigue: 'Fatigue',
    form: 'Form',
    sessions: (n: number) => `${n} run${n !== 1 ? 's' : ''}`,
    suggestion: {
      reduce_load: {
        title: 'Reduce load',
        detail: (acwr: number) =>
          `ACWR at ${acwr}x - injury risk elevated. Prioritise easy sessions or rest until acute load comes down.`,
      },
      fatigue_high: {
        title: 'Prioritise recovery',
        detail: 'Form is strongly negative. An easy run or rest day will help you bounce back faster.',
      },
      easy_session: {
        title: 'Keep it easy',
        detail: 'Moderate fatigue accumulating. Stick to easy effort for the next couple of sessions.',
      },
      quality_window: {
        title: 'Good window for intensity',
        detail: 'Form is positive and fitness solid - ideal timing for a quality session or a race.',
      },
      add_sessions: {
        title: 'Add a session',
        detail: 'Fitness is trending down. Even a short easy run will slow the decline.',
      },
      increase_volume: {
        title: 'Safe to build volume',
        detail: 'Acute load is low relative to your base. A gradual volume increase is well within safe range.',
      },
      maintain: {
        title: 'Stay the course',
        detail: 'Training load is well balanced. Continue with your current plan.',
      },
    } as Record<string, { title: string; detail: string | ((acwr: number) => string) }>,
    planTitle: '4-week plan',
    planSubtitle: (weeklyNeeded: number | null) =>
      weeklyNeeded !== null
        ? `Progressive weekly volume - your annual goal pace is about ${weeklyNeeded} km/week. Run count scales with your usual distance per run.`
        : 'Progressive weekly volume based on your current training load. Run count scales with your usual distance per run.',
    planWeek: (n: number) => `Week ${n}`,
    planFocus: {
      recovery: 'Recovery',
      maintain: 'Maintain',
      build: 'Build',
      quality: 'Add quality',
    } as Record<string, string>,
    planFocusDetail: {
      recovery: 'Lighter week - absorb recent training and keep injury risk low.',
      maintain: 'Hold steady at your current volume this week.',
      build: 'Progressive volume increase to keep building fitness.',
      quality: 'Volume steady - good window to add a quality or intense session.',
    } as Record<string, string>,
  },

  insights: {
    title: 'Insights',
    formFresh: "You're fresh - a good window for a hard session or a race.",
    formFatigued: 'Fatigue is high - an easy day or some rest would help.',
    acwrHigh: (ratio: number) => `Load ramping fast (${ratio}× your usual) - ease off to stay injury-free.`,
    acwrOptimal: 'Your training load is right in the sweet spot.',
    tooHard: (pct: number) => `Only ${pct}% of your time is easy this month - aim for ~80%.`,
    balanced: (pct: number) => `Great balance - ${pct}% easy, close to the 80/20 ideal.`,
    easyPaceImproved: (sec: number) => `Your easy pace improved ${sec}s/km this month.`,
    monthlyRecord: (km: number) => `Biggest month yet - ${km} km.`,
    volumeStreak: (weeks: number, km: number) => `${weeks} straight weeks over ${km} km.`,
    recentPr: (label: string) => `New ${label} personal best in the last month.`
  },

  analytics: {
  title: 'Analytics',
  season: (year: number) => `${year} season`,
    period: {
      chip: (n: number) => `${n} wk`,
      title: (n: number) => `Last ${n} weeks`,
      vsPrevious: (n: number) => `vs previous ${n} weeks`,
      distancePct: (p: number) => `${p >= 0 ? '+' : ''}${p}% km`,
      sessionsPct: (p: number) => `${p >= 0 ? '+' : ''}${p}% runs`,
      paceFaster: (s: number) => `easy pace -${s}s/km`,
      paceSlower: (s: number) => `easy pace +${s}s/km`,
    },
    tabs: {
      volume: 'Volume',
      performance: 'Performance',
      physiology: 'Physiology',
      seasons: 'Seasons',
    },
    stats: {
      distance: 'Distance',
      time: 'Time',
      sessions: 'Sessions',
      elevation: 'Elevation',
      avgPerWeek: 'Avg / week',
      calories: 'Calories',
      kcalPerWeek: 'Kcal / week',
      elevationValue: (m: number) => `+${m} m`,
      caloriesValue: (k: number) => `${k}k kcal`,
    },
    charts: {
      monthlyVolume: { title: 'Volume' },
      paceTrend: {
        title: 'Pace Trend',
        easy: 'Easy',
        workout: 'Workout',
        footnote: 'Distance-weighted average pace. Lower is faster.',
        explains: {
          improving: (sec: number) => `Easy pace improving - ${sec}s/km faster than earlier in the period`,
          stable: 'Easy pace stable throughout the period',
          slowing: (sec: number) => `Easy pace slowing by ${sec}s/km - may reflect fatigue or high volume`,
        },
      },
      efficiency: {
        title: 'Aerobic Efficiency',
        unit: 'm/min·bpm',
        footnote: 'Speed per heartbeat on easy runs (m/min ÷ avg HR). Higher means better aerobic fitness.',
        explains: {
          improving: (d: string) => `Improving +${d} - you're generating more speed per heartbeat`,
          stable: 'Aerobic efficiency stable',
          declining: 'Declining - consider more easy running or check for accumulated fatigue',
        },
      },
      zones: {
        title: 'Time in Zones',
        labels: {
          1: 'Warm Up',
          2: 'Easy',
          3: 'Aerobic',
          4: 'Threshold',
          5: 'Maximum',
        } as Record<number, string>,
      },
      hrTrend: {
        title: 'Avg Heart Rate',
        footnote: 'Duration-weighted average HR, all runs.',
      },
      cadence: {
        title: 'Cadence',
        unit: 'spm',
        footnote: 'Duration-weighted average cadence (steps/min).',
      },
      longRuns: {
        title: 'Long Runs',
        range1015: '10–15 km',
        range15: '15+ km',
      },
      easyHard: {
        title: 'Easy / Hard Split',
        easy: (pct: number) => `Easy (Z1–Z2): ${pct}%`,
        hard: (pct: number) => `Hard (Z3+): ${pct}%`,
        footnote: 'Share of time in Z1–Z2 vs Z3+. Dashed line = 80/20 target.',
        explains: {
          balanced: (pct: number) => `Good 80/20 balance - ${pct}% easy on average`,
          tooHard: (pct: number) => `Intensity too high - ${pct}% easy this period (aim for ~80%)`,
          tooEasy: (pct: number) => `Very conservative - ${pct}% easy, room to add quality sessions`,
        },
      },
      distance: {
        title: 'Distance Distribution',
        runs: (n: number) => `${n} runs`,
        kmTotal: (km: number) => `${km} km total`,
      },
      rpe: {
        title: 'RPE Trend',
        prefix: 'RPE',
        footnote: 'Average perceived effort (1–10).',
      },
      trainingEffect: {
        title: 'Training Effect',
        aerobic: 'Aerobic',
        anaerobic: 'Anaerobic',
        footnote: 'Avg aerobic & anaerobic training effect (1–5).',
      },
      monthlyComparison: { title: 'Month by Month' },
      efficiencyRolling: {
        title: 'Aerobic Efficiency - Rolling Trend',
        ef7: '7-day',
        ef30: '30-day',
        unit: 'm/min·bpm',
        footnote: 'Rolling aerobic efficiency over the last 90 days. 7-day captures recent form, 30-day shows the underlying trend.',
      },
    },
    yearOverYear: {
      title: 'Year over Year',
      vs: 'vs',
      rows: {
        distance: 'Distance',
        sessions: 'Sessions',
        time: 'Time',
        avgPerWeek: 'Avg / week',
        avgPace: 'Avg pace',
        avgHr: 'Avg HR',
        elevation: 'Elevation',
      },
    },
  },

  activities: {
    searchPlaceholder: 'Search...',
    all: 'All',
    distance: 'Distance',
    min: 'min',
    max: 'max',
    clear: 'Clear',
    count: (n: number) => `${n} activit${n !== 1 ? 'ies' : 'y'}`,
    page: (current: number, total: number) => ` · page ${current}/${total}`,
    empty: 'No activities found',
    row: {
      distance: 'distance',
      duration: 'duration',
      pace: 'pace',
      avgHr: 'avg HR',
      rpe: 'RPE',
      rpeValue: (n: number) => `RPE ${n}`,
      na: 'N/A',
    },
  },

  activity: {
    back: 'Activities',
    runTitle: (day: string) => `${day} Run`,
    metaFallbackTitle: 'Activity',
    share: 'Share',
    shareMenu: {
      share: 'Share to apps',
      download: 'Download',
      copy: 'Copy image',
      copied: 'Copied!',
    },
    shareCard: {
      distance: 'DISTANCE',
      time: 'TIME',
      pace: 'PACE',
      avgHr: 'AVG HR',
    },
    stats: {
      distance: 'Distance',
      duration: 'Duration',
      avgPace: 'Avg Pace',
      avgHr: 'Avg HR',
      elevation: 'Elevation',
      calories: 'Calories',
      rpe: 'RPE',
      rpeValue: (n: number) => `RPE ${n}`,
      na: 'N/A',
      elevationValue: (m: number) => `+${m}m`,
      caloriesValue: (kcal: number) => `${kcal} kcal`,
    },
    bestEfforts: {
      title: 'Best Efforts',
    },
    zones: {
      title: 'Heart Rate Zones',
      noData: 'No HR zone data',
      labels: {
        1: 'Z1 · Warmup',
        2: 'Z2 · Easy',
        3: 'Z3 · Aerobic',
        4: 'Z4 · Threshold',
        5: 'Z5 · Max',
      } as Record<number, string>,
      range: (min: number, max: number) => `${min}–${max} bpm`,
      rangeOpen: (min: number) => `>${min} bpm`,
    },
    trainingEffect: {
      title: 'Training Effect',
      aerobic: 'Aerobic',
      anaerobic: 'Anaerobic',
      levels: {
        noBenefit: 'No benefit',
        minor: 'Minor',
        maintaining: 'Maintaining',
        improving: 'Improving',
        highlyImproving: 'Highly Improving',
        overreaching: 'Overreaching',
      },
    },
    dynamics: {
      title: 'Running Dynamics',
      cadence: 'Cadence',
      strideLength: 'Stride Length',
      groundContact: 'Ground Contact',
      vertOscillation: 'Vert. Oscillation',
      vertRatio: 'Vert. Ratio',
    },
    charts: {
      heartRate: 'Heart Rate',
      hr: 'HR',
      avg: 'avg',
      max: 'max',
      pace: 'Pace',
      altitude: 'Altitude',
      elevation: 'Elevation',
      gain: (m: number) => `+${m} m gain`,
    },
    map: {
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      escToExit: 'Esc to exit',
      noTrace: 'GPS trace unavailable',
      noTraceHint: 'Available after Garmin sync',
    },
  },

  goals: {
    title: 'Goals',
    annualGoal: 'Annual Goal',
    kmRemaining: (km: number) => `${km} km remaining`,
    goalReached: 'Goal reached!',
    raceTargets: 'Race Targets',
    noTarget: 'No target',
    targetDone: (ahead: string) => `✓ Done (${ahead} ahead)`,
    targetToGo: (time: string) => `${time} to go`,
    seasonRaces: 'Season Races',
    raceAlt: (distance: string) => `${distance} race`,
    emptyPbsPrefix: (year: number) => `Add PBs for ${year} to`,
    projection: {
      status: {
        ahead: 'Ahead',
        on_track: 'On track',
        behind: 'Behind',
      },
      projected: (km: number) => `Projected ${km} km`,
      aheadBy: (km: number) => `+${km} km vs goal`,
      behindBy: (km: number) => `-${km} km vs goal`,
      rate: (current: number, needed: number) => `${current} km/wk pace · ${needed} km/wk needed`,
    },
  },

  records: {
    title: 'All-Time Records',
    footnote: '★ official race time · others auto-detected from activity data',
    pageTitle: 'Records',
    pageSubtitle: 'Your personal bests by distance',
    formAtPb: {
      fitness: 'Fitness',
      form: 'Form',
      now: 'now',
      formTooltip: 'Fitness minus Fatigue on race day. Positive = you were fresh, ideal for performance. Negative = you ran this while under training load.',
    },
  },

  profile: {
    pageTitle: 'Profile',
    pageSubtitle: 'Your runner identity card',
    yearsTracked: 'Years tracked',
    totalDistance: 'Lifetime distance',
    totalActivities: 'Activities logged',
    experienceLevel: 'Experience level',
    since: (date: string) => `Since ${date}`,
    levelCaveat: 'Based on activity history tracked in RunOmics, not your full running history.',
    level: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      experienced: 'Experienced',
      veteran: 'Veteran',
    } as Record<string, string>,
  },

  racePredictions: {
    title: 'Race Predictions',
    efforts: {
      '5k': '5K',
      '10k': '10K',
      half: 'Half',
      marathon: 'Marathon',
    } as Record<string, string>,
    from: (source: string) => `from ${source}`,
    beatBy: (time: string) => `✓ Beat by ${time}`,
    pbOff: (time: string) => `PB ${time} off`,
    footnote: 'Riegel formula · t₂ = t₁ × (d₂/d₁)^1.06',
  },

  trainingZones: {
    title: 'Training Zones',
    thresholdLabel: (pace: string) => `Threshold ${pace}`,
    perKm: '/km',
  },

  consistencyScore: {
    title: 'Consistency',
    rating: {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      low: 'Low',
    },
    detail: (weeks: number, adherence: number) => `${weeks} wk window · ${adherence}% weeks active`,
  },

  calendar: {
    today: 'Today',
    summary: (sessions: number, km: number) =>
      `${sessions} session${sessions !== 1 ? 's' : ''} · ${km} km`,
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    readiness: (tsb: number) => `Form ${tsb >= 0 ? '+' : ''}${tsb}`,
  },

  // Display labels for domain enums. Styling (colors, badge classes) stays in
  // the domain config; only the human-readable text lives here.
  activityTypes: {
    Sprint: 'Sprint',
    Anaerobic: 'Anaerobic',
    VO2Max: 'VO₂ Max',
    Threshold: 'Threshold',
    Tempo: 'Tempo',
    Base: 'Base',
    Race: 'Race',
  } as Record<ActivityType, string>,

  rpeLabels: {
    1: 'Very Light',
    2: 'Very Easy',
    3: 'Easy',
    4: 'Comfortable',
    5: 'Moderate',
    6: 'Steady',
    7: 'Hard',
    8: 'Very Hard',
    9: 'Near Maximal',
    10: 'Maximal',
  } as Record<number, string>,
} as const
