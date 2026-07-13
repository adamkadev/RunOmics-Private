// English UI strings — the reference locale. Sibling files (e.g. `fr.ts`) must
// keep the same shape (`satisfies Strings`); the active locale is picked in
// `index.ts` via NEXT_PUBLIC_LOCALE.
//
// Conventions:
// - Plain strings for static copy.
// - Functions for interpolated / pluralized copy.
// - Pure number/date formatting stays in `@/lib/formatters`; only human-readable
//   words and units live here.

import type { ActivityType } from '@/domain/activity/types'
import type { RankTier } from '@/domain/athlete/rank'

function ordinal(n: number): string {
  const rem10 = n % 10
  const rem100 = n % 100
  if (rem10 === 1 && rem100 !== 11) return `${n}st`
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`
  return `${n}th`
}

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
      dashboard: 'Today',
      activities: 'Activities',
      plan: 'Plan',
      analytics: 'Analytics',
      heatmap: 'Heatmap',
      profile: 'Progress',
      settings: 'Settings',
    },
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
    spm: 'spm',
    m: 'm',
    ms: 'ms',
    mm: 'mm',
    percent: '%',
    kcal: 'kcal',
    perKm: '/km',
    minPerKm: 'min/km',
    celsius: '°C',
    hour: 'h',
    min: 'min',
    day: 'd',
    elevation: 'm gain'
  },

  common: {
    viewAll: 'View all',
    sessions: (n: number) => `${n} session${n !== 1 ? 's' : ''}`,
    runs: (n: number) => `${n} run${n !== 1 ? 's' : ''}`,
    close: 'Close',
    refreshing: 'Refreshing...',
  },

  pwa: {
    updateAvailable: 'A new version of RunOmics is ready.',
    refresh: 'Refresh',
  },

  pages: {
    dashboard: {
      title: 'Today',
      greeting: {
        morning:   'Good morning',
        afternoon: 'Good afternoon',
        evening:   'Good evening',
        weekDate:  (week: number, date: string) => `Week ${week} · ${date}`,
      },
      subtitle: (week: number, sessions: number, year?: number) =>
        `Week ${week}${year !== undefined ? ` ${year}` : ''} · ${sessions} session${sessions !== 1 ? 's' : ''}`,
      weekTitle: (week: number, year?: number) =>
        `Week ${week}${year !== undefined ? ` ${year}` : ''}`,
    },
    activities: {
      title: 'Activities',
    },
    plan: {
      title: 'Plan',
    },
    records: {
      title: 'Records',
      subtitle: 'Personal bests and race predictions',
      back: 'Progress',
    },
    map: {
      title: 'Running Heatmap',
      back: 'Activities',
      routes: (n: number) => `${n} routes`,
      zones: 'Zones',
      allYears: 'All years',
      allTypes: 'All types',
      types: 'Types',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      worldView: 'World view',
      exitWorldView: 'Exit world view',
      worldViewHint: 'Tap a zone to explore it',
      intensity: 'Intensity',
      less: 'Rare',
      more: 'Frequent',
      noRoutes: 'No routes for this filter',
      territory: {
        eyebrow: (year: string) => `Your territory · ${year}`,
        headline: (percent: number, radius: number) => `${percent}% of your volume falls within a ${radius} km radius.`,
        aroundPlace: (place: string) => `Mostly around ${place}.`,
        routesStat: 'distinct routes',
        radiusStat: 'median radius',
      },
    },
    shoes: {
      title: 'Shoes',
      subtitle: 'Mileage and wear per pair',
      back: 'Progress',
    },
    milestones: {
      title: 'Milestones',
      subtitle: 'Distance tiers, streaks, and personal records over time',
      back: 'Progress',
    },
    athlete: {
      title: 'Athlete',
      subtitle: 'Thresholds and heart rate zones',
      back: 'Progress',
    },
    profile: {
      title: 'Progress',
    },
    notFound: {
      code: '404',
      heading: "This page went on a run and didn't come back.",
      sub: "The route you're looking for doesn't exist.",
      back: 'Back to Today',
    },
    error: {
      heading: 'Something tripped mid-stride.',
      sub: 'An unexpected error occurred while loading this page.',
      retry: 'Try again',
      back: 'Back to Today',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Appearance, notifications and data export.',
      back: 'Progress',
    },
  },

  settings: {
    sections: {
      appearance: 'Appearance',
      notificationsData: 'Notifications & data',
      account: 'Account',
    },
    rowAction: {
      export: 'Export ›',
      clear: 'Clear ›',
    },
    appearance: {
      title: 'Appearance',
      themeLabel: 'Theme',
      light: 'Light',
      auto: 'Auto',
      dark: 'Dark',
      auroraNote: 'The aurora adapts to the selected accent.',
    },
    accent: {
      title: 'Accent color',
      subtitle: 'Pick the vibe - this applies instantly, no account needed.',
      preview: 'Preview',
      options: {
        nature:      { label: 'Nature', description: 'Calm trail green' },
        performance: { label: 'Performance', description: 'Electric race blue' },
        impact:      { label: 'Impact', description: 'Bold finish-line red' },
        motivation:  { label: 'Motivation', description: 'Energetic orange' },
        endurance:   { label: 'Endurance', description: 'Deep ultra violet' },
        silver:      { label: 'Silver', description: 'Pure data monochrome' },
      },
    },
    auth: {
      signIn: 'Sign in with Google',
      signOut: 'Sign out',
      switchAccount: 'Sign out and try another account',
      accessDenied: 'Access denied - this page is restricted to the site owner.',
      signingIn: 'Signing in...',
      error: 'Could not sign in, please retry.',
      notConfigured: 'Sign-in is not available right now.',
    },
    athlete: {
      title: 'Athlete Profile',
      lthr: 'LTHR (bpm)',
      lthrHint: 'Lactate threshold heart rate',
      thresholdPace: 'Threshold pace',
      thresholdPaceHint: 'min:ss per km, e.g. 4:14',
      thresholdPower: 'Threshold power (W)',
      thresholdPowerHint: 'Functional threshold power',
      vma: 'VMA (km/h)',
      vmaHint: 'Maximal aerobic speed',
      placeholders: {
        lthr: '177',
        thresholdPace: '4:14',
        thresholdPower: '339',
        vma: '16',
      },
    },
    actions: {
      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved',
      error: 'Error saving, please retry.',
      confirmQuestion: 'Sure?',
      confirmYes: 'Yes',
      confirmCancel: 'Cancel',
    },
    dataSource: {
      garmin: 'Garmin Connect',
      connected: (source: string) => `${source} connected`,
      lastSync: 'Last synced',
    },
    dataExport: {
      csv: 'Export activities (.csv)',
      exporting: 'Exporting...',
    },
    offlineCache: {
      clear: 'Clear offline cache',
      cleared: 'Offline cache cleared.',
      failed: 'Could not clear the offline cache.',
    },
    notifications: {
      title: 'Push notifications',
      denied: 'Notifications are blocked - allow them in your browser settings.',
      unsupported: 'Push notifications are not supported in this browser.',
      error: 'Could not update notification settings, please retry.',
      types: {
        training: {
          title: 'Training reminders',
          subtitle: 'Daily session at 10am, plus a weekly check-in on your distance goal.',
        },
        shoes: {
          title: 'Shoe wear alerts',
          subtitle: 'Warning at 70% and 90% wear.',
        },
        races: {
          title: 'Race predictions',
          subtitle: 'Automatic detection of new potential PR.',
        },
      },
    },
  },

  dashboard: {
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
        `${km} km · ${runs} run${runs !== 1 ? 's' : ''}`,
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      weekdays: ['Mon', '', 'Wed', '', 'Fri', '', ''],
    },
    weeklyVolume: {
      title: 'Weekly Volume',
    },
    trainingMix: {
      title: 'Training Mix',
      other: 'Other',
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
      reading: {
        up: (avg: number) => `Trending up, averaging ${avg} over this window.`,
        down: (avg: number) => `Trending down, averaging ${avg} over this window.`,
        flat: (avg: number) => `Holding steady around ${avg}.`,
      },
    },
    raceCockpit: {
      title: 'Form Projection',
      titleWithRace: (name: string) => `Form Projection · ${name}`,
      daysToTarget: (days: number) => `+${days} d`,
      projectedForm: 'Projected form',
      today: 'Today',
      projected: 'Projected',
      verdict: {
        'on-track': 'On track',
        'ease-off': 'Residual fatigue - ease off',
        'peak-ready': 'On track for a fresh peak',
        'build-more': 'Undertaper risk - keep building',
      },
      footnote: 'Estimated from planned sessions - actual form will vary with what you actually run.',
    },
    weeklyDigest: {
      newPr: (label: string, time: string) => `New ${label} best: ${time}`,
      statusFresh: (tsb: number) => `Fresh zone (Form +${tsb}) - a good window to train hard`,
      statusOverreaching: (tsb: number) => `Overreaching (Form ${tsb}) - consider easing off`,
      acwrWatch: (acwr: number) => `Acute:chronic load ratio at ${acwr.toFixed(2)} - outside the safe 0.8-1.3 range`,
      monotonyWatch: (monotony: number) => `Monotony at ${monotony.toFixed(1)} - your week lacks variety in daily load`,
      hardShareWatch: (hardPct: number) => `${Math.round(hardPct)}% hard - above the usual 80/20`,
    },
    syncStatus: {
      synced: (relative: string) => `Synced ${relative}`,
      justNow: 'just now',
      minutesAgo: (m: number) => `${m}m ago`,
      hoursAgo: (h: number) => `${h}h ago`,
      daysAgo: (d: number) => `${d}d ago`,
    },
    todayHero: {
      eyebrowByTone: {
        go: 'Green light',
        caution: 'Caution',
        hold: 'Hold back',
      },
      moodByTone: {
        go: 'fresh',
        caution: 'neutral',
        hold: 'fatigued',
      },
      readiness: {
        go: {
          headline: "You're fresh. Good day for quality.",
          body: () => `Fatigue is trending down - the planned session is a go.`,
        },
        caution: {
          headline: 'Steady day. Keep it moderate.',
          body: (loadTrendLabel: string) => `Load is ${loadTrendLabel.toLowerCase()} and form is holding neutral - stay honest on easy days.`,
        },
        hold: {
          headline: 'Dial it back today.',
          body: () => `Fatigue is elevated - an easy day or rest would help.`,
        },
      },
      sessionCta: 'Start',
      restDay: 'Rest day',
      restDaySubtitle: 'No session scheduled',
      race: 'Race',
      daysToRace: (days: number) => `D-${days}`,
      chargeOptimal: 'Optimal',
      chargeHigh: 'High',
      chargeLow: 'Low',
    },
    weeklyStreak: {
      weeksInARow: (weeks: number) => `${weeks} week streak`,
      kmRemaining: (km: number) => `${km} km to this week's goal`,
      goalReached: 'Weekly goal reached',
      freshWeek: 'New week.',
      freshWeekGoal: (km: number) => `Goal ${km} km - a first run kicks off the streak.`,
      streakSummary: (longest: number, current: number) => `Best streak: ${longest} weeks - current: ${current}`,
    },
    celebration: {
      eyebrow: 'New personal record',
      later: 'Later',
      viewAndShare: 'View & share',
    },
    onboarding: {
      message: 'Your form, planned session, and race countdown live in the card above - your running heatmap is further down the page.',
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
      vo2maxBand: {
        building: 'Building',
        solid: 'Solid',
        strong: 'Strong',
        elite: 'Elite',
      },
      topPercent: (pct: number) => `top ${pct}%`,
      fitnessBand: {
        peak: 'Peak fitness',
        nearPeak: 'Near peak',
        building: 'Building',
      },
    },
  },

  analytics: {
    title: 'Analytics',
    readingLabel: 'Reading:',
    effectLevel: {
      little: 'Little effect',
      medium: 'Medium effect',
      big: 'Big effect',
    },
    tapToExpand: 'Tap to expand the full scatter - hidden by default.',
    season: (year: number) => `${year} season`,
    allTimeChip: 'All',
    allTimeTitle: 'All-time',
    yearGroupLabel: 'Year',
    windowGroupLabel: 'Window',
    period: {
      chip: (n: number) => `${n} wk`,
      title: (n: number) => (n === 1 ? 'This week' : `Last ${n} weeks`),
      vsPrevious: (n: number) => (n === 1 ? 'vs previous week' : `vs previous ${n} weeks`),
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
      yearsTracked: 'Years tracked',
      calories: 'Calories',
      kcalPerWeek: 'Kcal / week',
      elevationValue: (m: number) => `+${m} m`,
      caloriesValue: (k: number) => `${k}k kcal`,
    },
    charts: {
      monthlyVolume: {
        title: 'Volume',
        reading: (topType: string, pct: number) => `${topType} makes up the largest share of monthly volume (~${pct}%).`,
      },
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
        reading: (pct: number, zoneLabel: string) => `Most time (${pct}%) sits in ${zoneLabel} - your training skews toward this intensity.`,
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
        footnote: 'Duration-weighted average HR, easy vs workout runs.',
        reading: {
          down: (bpm: number) => `Easy-run heart rate is dropping - down ~${bpm} bpm, same effort for less strain, a sign of improving fitness.`,
          up: (bpm: number) => `Easy-run heart rate is rising - up ~${bpm} bpm for the same effort, worth watching.`,
          flat: 'Easy and workout heart rate are holding steady.',
        },
      },
      cadence: {
        title: 'Cadence',
        unit: 'spm',
        footnote: 'Duration-weighted average cadence (steps/min).',
        reading: {
          up: (avg: number) => `Cadence is trending up, averaging ${avg} spm.`,
          down: (avg: number) => `Cadence is trending down, averaging ${avg} spm.`,
          flat: (avg: number) => `Cadence is steady around ${avg} spm.`,
        },
      },
      runningForm: {
        title: 'Running Form',
        metrics: {
          groundContact: 'Ground Contact',
          verticalOscillation: 'Vertical Osc.',
          strideLength: 'Stride Length',
        } as Record<string, string>,
        unit: {
          groundContact: 'ms',
          verticalOscillation: 'mm',
          strideLength: 'm',
        } as Record<string, string>,
        footnote: {
          groundContact: 'Duration-weighted average ground contact time. Lower generally means a more efficient stride.',
          verticalOscillation: 'Duration-weighted average vertical oscillation. Lower means less bounce per stride.',
          strideLength: 'Duration-weighted average stride length.',
        } as Record<string, string>,
        reading: {
          groundContact: (min: string, max: string) => `Ground contact ranges ${min}-${max} ms over this window - lower is generally more efficient.`,
          verticalOscillation: (min: string, max: string) => `Vertical oscillation ranges ${min}-${max} mm - lower means less bounce per stride.`,
          strideLength: (min: string, max: string) => `Stride length ranges ${min}-${max} m over this window.`,
        } as Record<string, (min: string, max: string) => string>,
      },
      longRuns: {
        title: 'Longest Run per Month',
        kmLabel: (km: number) => `${km} km`,
        refLine: '15 km',
        explains: {
          good: (km: number) => `Longest run avg. ${km} km - solid long run habit`,
          low: (km: number) => `Longest run avg. ${km} km - aim for 15+ km monthly`,
        },
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
        reading: (bracket: string, pct: number) => `Most runs (${pct}%) land in the ${bracket} bracket.`,
      },
      rpe: {
        title: 'RPE Trend',
        prefix: 'RPE',
        footnote: 'Average perceived effort (1–10).',
        reading: {
          down: (avg: string) => `Perceived effort is easing, averaging RPE ${avg}.`,
          up: (avg: string) => `Perceived effort is rising, averaging RPE ${avg}.`,
          flat: (avg: string) => `Perceived effort is steady around RPE ${avg}.`,
        },
      },
      trainingEffect: {
        title: 'Training Effect',
        aerobic: 'Aerobic',
        anaerobic: 'Anaerobic',
        footnote: 'Avg aerobic & anaerobic training effect (1–5).',
        reading: {
          aerobicLed: 'Aerobic training effect runs higher than anaerobic - most sessions build endurance rather than high-intensity capacity.',
          anaerobicLed: 'Anaerobic training effect runs higher than aerobic - most sessions lean toward high-intensity work.',
          balanced: 'Aerobic and anaerobic training effect are roughly balanced.',
        },
      },
      monthlyComparison: {
        title: 'Month by Month',
        reading: (curYear: number, deltaPct: number) =>
          deltaPct >= 0
            ? `${curYear} volume is running ${deltaPct}% ahead of last year.`
            : `${curYear} volume is running ${Math.abs(deltaPct)}% behind last year.`,
      },
      efficiencyRolling: {
        title: 'Aerobic Efficiency - Rolling Trend',
        ef7: '7-day',
        ef30: '30-day',
        unit: 'm/min·bpm',
        footnote: 'Rolling aerobic efficiency over the last 90 days. 7-day captures recent form, 30-day shows the underlying trend.',
        reading: {
          up: (d: string) => `The 30-day trend is climbing, +${d} m/min·bpm - more speed per heartbeat.`,
          down: 'The 30-day trend is declining - consider more easy running or check for accumulated fatigue.',
          flat: 'The 30-day trend is holding steady.',
        },
      },
      runningDynamicsRolling: {
        title: 'Running Dynamics - Rolling Trend',
        d7: '7-day',
        d30: '30-day',
        metrics: {
          cadence: 'Cadence',
          groundContact: 'Ground Contact',
          verticalOscillation: 'Vertical Osc.',
        } as Record<string, string>,
        unit: {
          cadence: 'spm',
          groundContact: 'ms',
          verticalOscillation: 'mm',
        } as Record<string, string>,
        footnote: {
          cadence: 'Rolling average cadence over the last 90 days. 7-day captures recent form, 30-day shows the underlying trend.',
          groundContact: 'Rolling average ground contact time over the last 90 days. Lower generally means a more efficient stride.',
          verticalOscillation: 'Rolling average vertical oscillation over the last 90 days. Lower means less bounce per stride.',
        } as Record<string, string>,
        reading: {
          cadence: (min: string, max: string) => `30-day cadence ranges ${min}-${max} spm over the last 90 days.`,
          groundContact: (min: string, max: string) => `30-day ground contact ranges ${min}-${max} ms - lower is generally more efficient.`,
          verticalOscillation: (min: string, max: string) => `30-day vertical oscillation ranges ${min}-${max} mm - lower means less bounce per stride.`,
        } as Record<string, (min: string, max: string) => string>,
      },
    },
    seasonHeadline: {
      eyebrow: 'Season headline',
      titlePositive: 'Fitter and more efficient than early season.',
      titleCaution: 'A tougher stretch than early season.',
      titleMixed: 'A mixed season - gains in some areas, dips in others.',
      efficiency: (d: number) => `Aerobic efficiency ${d > 0 ? '+' : ''}${d} - ${d > 0 ? 'more' : 'less'} speed per heartbeat`,
      easyPace: (s: number) => `Easy pace ${Math.abs(s)}s/km ${s < 0 ? 'faster' : 'slower'} than early season`,
      volume: (pct: number, year: number) =>
        `Volume ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% vs ${year}${pct < 0 ? ' - watch consistency' : ''}`,
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
    searchToggle: 'Search',
    all: 'All',
    count: (n: number) => `${n} activit${n !== 1 ? 'ies' : 'y'}`,
    page: (current: number, total: number) => ` · page ${current}/${total}`,
    empty: 'No activities found',
    emptyFiltered: 'No sessions of this type',
    resetFilters: 'Reset filters',
    endOfList: 'That\'s all',
    monthGroup: (count: number, km: number) => `${count} session${count !== 1 ? 's' : ''} · ${km} km`,
    thisWeek: 'This week',
    weekGroup: (km: number, runs: number, easyPct: number, hardPct: number) => `${km} km · ${runs} run${runs !== 1 ? 's' : ''} · ${easyPct}/${hardPct} E/H`,
    weekStat: {
      km: 'km',
      runs: 'runs',
      easyHard: 'E/H',
    },
    weekGroupCompact: (runs: number, km: number) => `${runs} run${runs !== 1 ? 's' : ''} · ${km} km`,
    sort: {
      label: 'Sort',
      date: 'Date',
      distance: 'Distance',
      duration: 'Duration',
      pace: 'Pace',
      avgHr: 'Avg HR',
    },
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
      share: 'Share',
      download: 'Download',
      copy: 'Copy',
      copied: 'Copied!',
    },
    shareCard: {
      distance: 'DISTANCE',
      time: 'TIME',
      pace: 'PACE',
      avgHr: 'AVG HR',
      close: 'Close',
      choosePhoto: 'Choose a photo',
      designLabel: 'Theme',
      designLabels: {
        aurora: 'Aurora',
        pulse: 'Pulse',
        terrain: 'Terrain',
        prism: 'Prism',
        cadence: 'Cadence',
        map: 'Map',
        memory: 'Memory',
      },
      statsToggle: 'Activity Stats',
      mapRouteToggle: 'Show Map Route',
      mapRouteSubtitle: 'Forces the Map theme',
      lightModeToggle: 'Light mode',
      lightModeSubtitle: 'Light background for printing',
      accentTitle: 'Accent',
      accentSubtitle: 'Unit color',
      galleryPlaceholder: 'Choose a photo',
      orUsePhoto: 'Or use your photo',
      changePhoto: 'Change',
      browsePhoto: 'Browse...',
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
      cadence: 'Cadence',
    },
    heatNote: (temperature: number, adjustSeconds: number) =>
      `Hot run (${temperature}°C) - pace looks ~${adjustSeconds}s/km slower than the same effort in mild weather.`,
    loadNote: (atlContribution: number) => `Contributes ~${atlContribution} to this week's fatigue (ATL).`,
    verdict: {
      title: 'Run Verdict',
      headline: {
        positive: (type: string) => `Solid ${type}`,
        neutral: (type: string) => `${type} logged`,
        caution: (type: string) => `Tough ${type}`,
      },
      heatSuffix: ' in tough heat',
      heatClause: (pace: string, adjustSeconds: number, temperature: number) =>
        `${pace}/km was ~${adjustSeconds}s slower than usual - expected at ${temperature}°C.`,
      effortClause: (rpeLabel: string, rpe: number) => `Perceived effort: ${rpeLabel} (RPE ${rpe}).`,
    },
    tabs: {
      groupLabel: 'Activity sections',
      overview: 'Overview',
      splits: 'Splits',
      charts: 'Charts',
      dynamics: 'Dynamics',
    },
    bestEfforts: {
      title: 'Best Efforts',
      prBadge: 'PR',
      rankBadge: (rank: number) => `#${rank}`,
    },
    achievements: {
      title: 'Achievements from this run',
    },
    dataQuality: {
      estimated: 'Estimated',
      noHr: 'No heart-rate data - zones and load are estimated from pace.',
    },
    similarRuns: {
      title: 'Similar runs',
      timesBadge: (n: number) => `${n} times`,
      summary: (n: number, rank: number) =>
        `You've run this route ${n} times. This run: ${rank === 1 ? 'your best pace' : `your ${ordinal(rank)}-best pace`}.`,
      thisRun: 'This run',
      record: 'record',
      recordLine: (pace: string) => `record ${pace}/km`,
      paceDelta: (seconds: number) => `+${seconds}s/km`,
      chartSummary: (n: number, best: string) =>
        `Pace across your ${n} runs on this route; record ${best}/km.`,
    },
    notes: {
      title: 'Notes',
      notePlaceholder: 'How did it feel? Weather, terrain, sensations...',
      tagPlaceholder: 'Add a tag (e.g. rain, trail, tired)... press Enter',
      removeTag: (tag: string) => `Remove tag ${tag}`,
    },
    zones: {
      title: 'Time in Zones',
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
      aerobic: 'Aerobic effect',
      anaerobic: 'Anaerobic effect',
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
      cadence: 'Cadence',
      sectionPhysiology: 'Physiology',
      sectionPerformance: 'Pace & Cadence',
    },
    map: {
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      escToExit: 'Esc to exit',
      noTrace: 'GPS trace unavailable',
      noTraceHint: 'Available after Garmin sync',
      routeMap: 'Activity route map',
    },
    splits: {
      title: 'Intervals',
      cols: {
        step: '#',
        type: 'Type',
        duration: 'Duration',
        dist: 'Distance',
        pace: 'Pace',
        hr: 'HR',
        total: 'Total',
      },
      intervalTypes: {
        interval_warmup:   'Warmup',
        interval_active:   'Interval',
        interval_rest:     'Rest',
        interval_recovery: 'Recovery',
        interval_cooldown: 'Cooldown',
      } as Record<string, string>,
    },
    nav: {
      previous: 'Previous',
      next: 'Next',
    },
  },

  goals: {
    title: 'Goals',
    empty: 'No goals configured yet.',
    back: 'Progress',
    annualGoal: 'Annual Goal',
    kmRemaining: (km: number) => `${km} km remaining`,
    goalReached: 'Goal reached!',
    seasonTimeline: 'Season Timeline',
    target: 'Target',
    noTarget: '-',
    noTargetSet: 'No target set',
    noDateSet: 'no date set',
    done: 'done',
    beatenBy: (gap: string) => `beaten by ${gap}`,
    missedBy: (gap: string) => `missed by ${gap}`,
    best: 'Best',
    predictedTag: 'predicted',
    findRace: 'Find a race ›',
    nextRaceHint: (name: string, date: string) => `next: ${name} ${date}`,
    seasonRaces: 'Season Races',
    raceAlt: (distance: string) => `${distance} race`,
    emptyPbs: (year: number) => `No PBs for ${year} yet - add them in Settings.`,
    noPhoto: 'No photo',
    daysUntil: (n: number) => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n}d`,
    registrationLink: 'Registration',
    projection: {
      status: {
        ahead: 'Ahead',
        on_track: 'On track',
        behind: 'Behind',
      },
      rate: (current: number) => `${current} km/wk pace`,
      projected: (km: number) => `Projected ${km.toLocaleString()} km`,
    },
    monthlyVolume: {
      title: 'Monthly Volume',
      expand: 'Expand',
      collapse: 'Collapse',
      status: {
        ahead: 'Ahead',
        on_track: 'On track',
        behind: 'Behind',
        pending: 'Upcoming',
      },
      km: (actual: number, target: number) => `${actual} / ${target}`,
    },
    history: {
      title: 'Past Years',
      achieved: 'Achieved',
      missed: 'Missed',
      annualKm: (actual: number, target: number) => `${actual} / ${target} km`,
      targetsCount: (achieved: number, total: number) => `${achieved}/${total} race targets`,
    },
  },

  shoes: {
    lastRun: (date: string) => `Last run ${date}`,
    neverUsed: 'Never used',
    kmOf: (total: number, max: number) => `${total} / ${max} km`,
    retired: 'Retired',
    alertBadge: 'Alert',
    criticalBadge: 'Critical',
    status: {
      ok: 'Good',
      watch: 'Replace soon',
      replace: 'Replace',
    },
    kmLeft: (km: number) => `~${km} km left`,
    hero: {
      usage: (n: number, total: number) => `Used in ${n} of your last ${total} tempo/threshold runs`,
      rotateBeforeRace: (date: string) => ` - rotate in a backup before your ${date} race.`,
      rotate: ' - rotate in a backup.',
      restOfRotation: 'Rest of rotation',
    },
    wearAlert: (name: string, totalKm: number, alertThresholdKm: number) => `${name} has ${totalKm} km - past its ${alertThresholdKm} km alert threshold`,
    summary: {
      totalDistance: 'Total km',
      activePairs: 'Active',
      sessions: 'Sessions',
    },
    detail: {
      back: 'Shoes',
      stats: {
        distance: 'Distance',
        activities: 'Activities',
        firstUsed: 'First worn',
        kmPerWeek: 'km / week',
      },
      activitiesTitle: 'Tracked Activities',
      empty: 'No activities recorded with this pair yet.',
      verdict: {
        eyebrow: (statusLabel: string) => `Verdict · ${statusLabel}`,
        weeksLeft: (weeks: number) => `About ${weeks} more weeks at your pace.`,
        planReplacement: 'Plan the replacement this month.',
        replaceNow: 'Line up the replacement now.',
        noPaceData: 'Not enough recent mileage to project a timeline yet.',
      },
    },
  },

  profile: {
    hero: {
      since: (date: string) => `Athlete since ${date}`,
      summary: (activities: number, km: number) => `${activities} activities · ${km} km`,
      lifetime: (runs: number, km: number) => `${runs} runs · ${km.toLocaleString('en')} km lifetime`,
      rankLine: (tier: string, pct: number) => `Rank ${tier} · top ${pct}% of VO₂max for your age`,
      editName: 'Edit name',
      namePlaceholder: 'Your name',
      rankExplain: 'Fitness rank from VO₂max and race pace.',
      rankSource: (vo2maxGarmin: number | null, vdot: number | null) => {
        const parts = []
        if (vo2maxGarmin !== null) parts.push(`VO₂max ${vo2maxGarmin}`)
        if (vdot !== null) parts.push(`VDOT ${vdot}`)
        return `From ${parts.join(' · ')}`
      },
    },
    ytd: {
      title: 'This year',
      distance: 'Distance',
      duration: 'Duration',
      sessions: 'Sessions',
      elevation: 'Elevation',
    },
    records: {
      title: 'Personal records',
      notYet: 'Not yet',
      viewAll: 'View all records',
      newBadge: 'NEW',
      legend: 'NEW = set in the last 90 days',
    },
    shoes: {
      title: 'Shoes',
      line: (totalKm: number, remainingKm: number) => `${totalKm} km · ~${remainingKm} km left`,
      pairs: (n: number) => `${n} pair${n !== 1 ? 's' : ''}`,
      allGood: 'All good',
      needsReplacing: (n: number) => n === 1 ? '1 pair needs replacing' : `${n} pairs need replacing`,
      viewShoes: 'View Shoes',
    },
    milestones: {
      title: 'Milestones',
      distanceTier: (km: number) => `${km} km this year`,
      distanceTierDetail: (year: number) => `Crossed in ${year}`,
      streak: (weeks: number) => `${weeks}-week active streak`,
      streakDetail: 'Still going - a run logged every week since',
      record: (label: string) => `${label} record`,
      viewAll: 'View all milestones',
      firstActivity: 'First step',
      firstActivityDetail: (km: number) => `Where it all began - ${km.toFixed(1)} km`,
      lifetimeDistance: (km: number) => `${km.toLocaleString('en-US')} km lifetime`,
      lifetimeDistanceDetail: (marathons: number) => `≈ ${marathons.toLocaleString('en-US')} marathons run`,
      lifetimeDistanceWorldTour: '🌍 A full trip around the Earth',
      activityCount: (n: number) => `${ordinal(n)} run`,
      activityCountDetail: (km: number) => `${km.toLocaleString('en-US')} km covered so far`,
    },
    hrZones: {
      title: 'Heart rate zones',
      lthr: 'LTHR',
      recalculate: 'Recalculate from LTHR',
      thisWeek: 'this week',
      noSessionsThisWeek: 'No sessions logged this week yet.',
      insight: {
        polarized: (pct: number, zoneLabel: string) =>
          `Very polarized week: ${pct}% in ${zoneLabel}, little threshold work. Consistent with a base phase.`,
        dominant: (pct: number, zoneLabel: string) => `${pct}% of this week's time sits in ${zoneLabel}.`,
      },
    },
    athlete: {
      title: 'Athlete',
      lthr: 'LTHR',
      notSet: 'Not set',
      viewAthlete: 'View Athlete',
    },
    goal: {
      title: (year: number) => `Goal ${year}`,
      progress: (total: number, target: number) => `${total} / ${target} km`,
      viewGoals: 'View Goals',
    },
  },

  records: {
    title: 'Top Times',
    all: 'All',
    longest: 'Longest Run',
    mostRecent: 'most recent',
    raceTag: 'race',
    notYetRun: 'Not yet run',
    segmented: {
      prs: 'Personal records',
      milestones: 'Milestones',
    },
    noRecordYet: 'No record yet',
    predictedFromFitness: (time: string) => `Predicted ${time}`,
    findRace: (distance: string) => `Find a ${distance.toLowerCase()} ›`,
    leaderboard: {
      title: 'Top Times',
      rank: '#',
      time: 'Time',
      dist: 'Distance',
      pace: 'Pace',
      date: 'Date',
    },
  },

  pbAlerts: {
    off: (diff: string) => `${diff} off your PR`,
  },

  nextRace: {
    line: (name: string, distance: string, daysUntil: string) => `${name} (${distance}) - ${daysUntil}`,
    countdown: (days: number) => `D-${days}`,
  },

  racePredictions: {
    title: 'Race Predictions',
    formulaLabel: '(Riegel formula)',
    formulaExplainer: 'Peter Riegel\'s formula (1977): T2 = T1 × (D2/D1)^1.06. The standard used by most running apps.',
    efforts: {
      '1k': '1K',
      '1mile': '1M',
      '5k': '5K',
      '10k': '10K',
      half: 'Half',
      marathon: 'Marathon',
    } as Record<string, string>,
    from: (source: string) => `from ${source}`,
    beatBy: (time: string) => `✓ Beat by ${time}`,
    pbUpside: (time: string) => `PB -${time}`,
    trendFaster: (time: string, weeks: number) => `${time} faster in ${weeks}wk`,
    trendSlower: (time: string, weeks: number) => `${time} slower in ${weeks}wk`,
    trendFlat: 'Stable',
  },

  trainingZones: {
    title: 'Training Zones',
    thresholdLabel: (pace: string) => `Threshold ${pace}`,
    perKm: '/km',
  },

  loadRisk: {
    title: 'Load Risk',
    insufficientData: 'Not enough data',
    zone: {
      low: 'Reduced load',
      safe: 'Safe zone',
      caution: 'Caution',
      risk: 'High risk',
    },
    acwr: { label: 'ACWR', description: 'Acute:chronic load ratio · target 0.8–1.3' },
    monotony: { label: 'Monotony', description: 'Day-to-day load variety · alert above 2.0' },
    strain: { label: 'Strain', description: 'Weekly load × monotony (Foster)' },
    rampRate: { label: 'Ramp rate', description: 'Δ CTL over 7 days' },
  },

  consistencyScore: {
    title: 'Consistency',
    weeks: 'weeks',
    gradeExplain: 'Ranks your last 12 weeks by weeks active (60%) and weekly volume stability (40%).',
  },

  plan: {
    today: 'Today',
    prevPeriod: 'Previous',
    nextPeriod: 'Next',
    summary: (sessions: number, km: number) =>
      `${sessions} session${sessions !== 1 ? 's' : ''} · ${km} km`,
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    readiness: (tsb: number) => `Form ${tsb >= 0 ? '+' : ''}${tsb}`,
    switcher: { week: 'Week', month: 'Month' },
    weekOf: (label: string) => `Week of ${label}`,
    restDay: 'Rest',
    planned: 'Planned',
    structure: {
      title: 'Structure',
      warmup: 'Warm-up',
      cooldown: 'Cool-down',
      single: (min: number, zone: string) => `${min}' @ ${zone}`,
      reps: (n: number, effort: number, zone: string) => `${n} × ${effort}' @ ${zone}`,
      repsWithRecovery: (n: number, effort: number, recovery: number, zone: string) => `${n} × ${effort}' @ ${zone} / ${recovery}' easy`,
      easyZone: 'Z1-Z2',
      min: (m: number) => `${m}'`,
    },
    nextWeek: (n: number) => `Next week - ${n} planned`,
    viewDetail: 'View detail',
    type: 'Type',
    weekSummary: {
      load: 'Load',
      vsTypical: (percent: number) => `${percent - 100 >= 0 ? '+' : ''}${percent - 100}% vs typical`,
      easyHard: 'Easy / Hard',
      elevation: 'Elevation',
    },
    weekPurpose: {
      recovery: 'Recovery week',
      steady: 'Steady week',
      build: 'Build week',
      thisWeek: 'This week',
      adherence: (done: number, due: number) => `${done}/${due} done`,
    },
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

  // Shared by the consistency grade ring and the profile rank badge, both of which
  // place a value on the same 9-tier percentile ladder (see domain/athlete/rank.ts).
  rankTierLabels: {
    D: 'Below average',
    C: 'Average',
    B: 'Above average',
    A: 'Excellent',
    S: 'Elite',
  } as Record<RankTier, string>,
}
