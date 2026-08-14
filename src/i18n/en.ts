// English UI strings - the reference locale. Sibling files (e.g. `fr.ts`) must
// keep the same shape (`satisfies Strings`); the active locale is picked in
// `index.ts` via NEXT_PUBLIC_LOCALE.
//
// Conventions:
// - Plain strings for static copy.
// - Functions for interpolated / pluralized copy.
// - Pure number/date formatting stays in `@/lib/formatters`; only human-readable
//   words and units live here.

import type { ActivityType, ScheduledTimeOfDay } from '@/domain/activity/types'

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

  chartWindow: {
    ranges: {
      '4w': '4w',
      '6m': '6m',
      '1y': '1y',
    },
    previous: 'Previous period',
    next: 'Next period',
    empty: 'No data recorded for this period.',
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
    yrs: 'yrs',
    kg: 'kg',
    cm: 'cm',
    kmh: 'km/h',
    mlKgMin: 'ml/kg/min',
  },

  common: {
    viewAll: 'View all',
    runs: (n: number) => `${n} run${n !== 1 ? 's' : ''}`,
    close: 'Close',
  },

  pwa: {
    updateAvailable: 'A new version of RunOmics is ready.',
    refresh: 'Refresh',
  },

  pages: {
    dashboard: {
      greeting: {
        morning:   'Good morning',
        afternoon: 'Good afternoon',
        evening:   'Good evening',
        weekDate:  (week: number, date: string) => `Week ${week} · ${date}`,
      },
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
      less: 'Rare',
      more: 'Frequent',
      noRoutes: 'No routes for this filter',
      mapUnavailable: 'Map unavailable - no map token configured',
      territory: {
        eyebrow: 'Home base · all-time',
        headline: (percent: number, radius: number) => `${percent}% of all your running sits within a ${radius} km radius.`,
        aroundPlace: (place: string) => `Centered on ${place}, where you run most.`,
        routesStat: 'distinct routes',
        radiusStat: 'median radius',
      },
    },
    shoes: {
      title: 'Shoes',
      subtitle: 'Mileage and wear per pair',
      back: 'Progress',
    },
    athlete: {
      title: 'Athlete',
      subtitle: 'Thresholds and heart rate zones',
      back: 'Progress',
      lastUpdated: (when: string) => `Updated ${when}`,
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
      age: 'Age',
      lthr: 'LTHR',
      lthrHint: 'Lactate threshold heart rate',
      thresholdPace: 'Thresh. pace',
      thresholdPaceHint: 'min:ss per km, e.g. 4:14',
      vma: 'VMA',
      vmaHint: 'Maximal aerobic speed',
      maxHr: 'Max HR',
      restingHr: 'Resting HR',
      vo2max: 'VO2max',
      weight: 'Weight',
      height: 'Height',
      fitnessAge: 'Fitness age',
      achievableFitnessAge: 'Potential',
      bmi: 'BMI',
      // Kept to a single short token - the tiles are a third of a phone wide.
      fitnessAgeBand: {
        younger: (years: number) => `−${years} yrs`,
        onPar: 'on par',
        older: (years: number) => `+${years} yrs`,
      },
      bmiBand: {
        underweight: 'underweight',
        healthy: 'healthy',
        overweight: 'overweight',
        obese: 'obese',
      },
      categories: {
        performance: 'Performance',
        cardio: 'Cardio',
        body: 'Body',
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
      since: (monthYear: string) => `paired ${monthYear}`,
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
      title: 'Consistency',
      activeDays: (n: number) => `${n} active days`,
      less: 'Less',
      more: 'More',
      restDay: 'Rest day',
      day: (km: number, runs: number) =>
        `${km} km · ${runs} run${runs !== 1 ? 's' : ''}`,
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      weekdays: ['Mon', '', 'Wed', '', 'Fri', '', ''],
    },
    trainingLoad: {
      title: 'Training Load',
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
      trendUp: (delta: number) => `+${delta}`,
      trendDown: (delta: number) => `${delta}`,
      trendSteady: '~0',
    },
    trainingStatusDays: {
      title: 'Training Status',
      today: 'Today',
      noReading: 'No reading',
    },
    vo2maxChart: {
      title: 'VO₂max',
      unit: 'ml/kg/min',
      footnote: 'Garmin VO₂max estimate',
      ranges: { '4w': '4 wk', '6m': '6 mo', '1y': '1 yr' },
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
      hardShareWatch: (hardPct: number) => `${Math.round(hardPct)}% hard`,
    },
    weeklyReview: {
      eyebrow: 'Week review',
      fallbackTitle: (km: number, sessions: number) =>
        `${km} km over ${sessions} session${sessions !== 1 ? 's' : ''} so far`,
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
      viewCta: 'View',
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
      message: "Today's decision lives in the card above - your readiness verdict and the one session to run next.",
    },
  },

  trainingStatus: {
    status: {
      productive: 'Productive',
      fresh: 'Peaking',
      overreaching: 'Overreaching',
      recovery: 'Recovery',
      detraining: 'Detraining',
      maintaining: 'Maintaining',
      unproductive: 'Unproductive',
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
    season: (year: number) => `${year} season`,
    allTimeChip: 'All',
    allTimeTitle: 'All-time',
    yearGroupLabel: 'Year',
    windowGroupLabel: 'Window',
    period: {
      chip: (n: number) => `${n} wk`,
      title: (n: number) => (n === 1 ? 'This week' : `Last ${n} weeks`),
      distancePct: (p: number) => `${p >= 0 ? '+' : ''}${p}% km`,
      sessionsPct: (p: number) => `${p >= 0 ? '+' : ''}${p}% runs`,
      paceFaster: (s: number) => `easy pace -${s}s/km`,
      paceSlower: (s: number) => `easy pace +${s}s/km`,
    },
    tabs: {
      fitness: 'Fitness',
      // Abbreviated so all four tabs fit the strip without scrolling; the
      // section heading above the race cards carries the full word.
      performance: 'Perf.',
      volume: 'Volume',
      health: 'Health',
    },
    insightCards: {
      vo2max: 'VO₂max',
      easyPace: 'Easy pace',
      threshold: 'Threshold',
      consistency: 'Consistency',
      days: 'days',
      holding: 'holding',
      excellent: 'excellent',
      topPercent: (p: number) => `top ${p}%`,
      faster: (s: number) => `↓ ${s} s`,
      slower: (s: number) => `↑ ${s} s`,
    },
    raceTimes: {
      title: 'Performance',
      trend: 'Race times ↓',
      // Abbreviated to fit four cards across a phone.
      shortLabels: {
        '5k': '5K',
        '10k': '10K',
        half: 'Half',
        marathon: 'Mara',
      } as Record<string, string>,
    },
    stats: {
      distance: 'Distance',
      time: 'Time',
      sessions: 'Sessions',
      elevation: 'Elevation',
      avgPerWeek: 'Avg / week',
      yearsTracked: 'Years tracked',
      calories: 'Calories',
      elevationValue: (m: number) => `+${m} m`,
    },
    charts: {
      weeklyVolume: {
        title: 'Weekly Volume',
        sessions: 'Sessions',
        weekOf: (label: string) => `Week of ${label}`,
        weekOfInProgress: (label: string) => `Week of ${label} (in progress)`,
        footnote: 'Each point is one full week, Monday to Sunday. The horizontal dashed line is the average over the window; the vertical one marks the week in progress, still partial and left out of that average.',
        explains: {
          up: (km: number, avg: number) => `Last week ran ${km} km above your ${avg} km average`,
          down: (km: number, avg: number) => `Last week ran ${km} km below your ${avg} km average`,
          steady: (avg: number) => `Volume steady around ${avg} km a week`,
        },
      },
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
        measured: 'Measured',
        adjusted: 'Heat-adjusted',
        felt: (deg: number) => `${deg}°C felt`,
        footnote: 'Speed per heartbeat on easy runs (m/min ÷ avg HR). Higher means better aerobic fitness. The adjusted line takes each run\'s heat cost back out, so a warm spell does not read as lost fitness.',
        explains: {
          improving: (d: string) => `Improving +${d} - you're generating more speed per heartbeat`,
          stable: 'Aerobic efficiency stable',
          declining: 'Declining - consider more easy running or check for accumulated fatigue',
          heatGap: (d: string) => `heat is holding the measured line ${d} below your actual fitness`,
        },
      },
      heatImpact: {
        title: 'Pace vs Temperature',
        unit: 's/km',
        bands: {
          cold: '< 5°C',
          cool: '5-15°C',
          mild: '15-20°C',
          warm: '20-25°C',
          hot: '25°C+',
        } as Record<string, string>,
        paceAtRefHr: (hr: number) => `Pace at ${hr} bpm`,
        cost: 'Cost',
        reference: 'Your best conditions',
        footnote: (hr: number) =>
          `Easy runs grouped by apparent temperature, each group converted to the pace it holds at ${hr} bpm, so the bars compare like for like. Bands pool every season, so the coldest one also carries early-season fitness.`,
        reading: (band: string, sec: number) => `At ${band} felt you give up about ${sec}s/km at the same heart rate.`,
        readingFlat: 'Temperature is not measurably changing your easy pace at equal heart rate.',
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
      runningForm: {
        title: 'Running Form',
        metrics: {
          cadence: 'Cadence',
          groundContact: 'Ground Contact',
          verticalOscillation: 'Vertical Osc.',
          verticalRatio: 'Vertical Ratio',
          strideLength: 'Stride Length',
        } as Record<string, string>,
        unit: {
          cadence: 'spm',
          groundContact: 'ms',
          verticalOscillation: 'mm',
          verticalRatio: '%',
          strideLength: 'm',
        } as Record<string, string>,
        footnote: {
          cadence: 'Duration-weighted average cadence (steps/min).',
          groundContact: 'Duration-weighted average ground contact time. Lower generally means a more efficient stride.',
          verticalOscillation: 'Duration-weighted average vertical oscillation. Lower means less bounce per stride.',
          verticalRatio: 'Vertical oscillation as a share of stride length. Lower means less energy spent going up for every metre gained forward.',
          strideLength: 'Duration-weighted average stride length.',
        } as Record<string, string>,
        // The axis already carries the range, so the reading carries the trend.
        reading: {
          up: (metric: string, delta: string, unit: string) => `${metric} is trending up, +${delta} ${unit} across this window.`,
          down: (metric: string, delta: string, unit: string) => `${metric} is trending down, -${delta} ${unit} across this window.`,
          flat: (metric: string) => `${metric} is holding steady across this window.`,
        },
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
        title: 'Aerobic Efficiency',
        ef7: '7-day',
        ef30: '30-day',
        unit: 'm/min·bpm',
        footnote: 'Rolling aerobic efficiency over the shown window. 7-day captures recent form, 30-day shows the underlying trend.',
        reading: {
          up: (d: string) => `The 30-day trend is climbing, +${d} m/min·bpm - more speed per heartbeat.`,
          down: 'The 30-day trend is declining - consider more easy running or check for accumulated fatigue.',
          flat: 'The 30-day trend is holding steady.',
        },
      },
      threshold: {
        title: 'Running Lactate Threshold',
        pace: 'Threshold pace',
        lthr: 'Threshold HR',
        footnote: 'The effort you can hold before lactate builds up, as the watch measures it. Garmin revises it every few weeks, so the line steps rather than drifts.',
        reading: {
          faster: (sec: number) => `Threshold pace is ${sec}s/km faster than the first reading.`,
          slower: (sec: number) => `Threshold pace is ${sec}s/km slower than the first reading.`,
          flat: 'Threshold pace is unchanged since the first reading.',
        },
      },
      racePredictor: {
        title: 'Race Predictor',
        emptyWindow: 'No predictions recorded for this period.',
        distances: {
          '5k': '5K',
          '10k': '10K',
          half: 'Half',
          marathon: 'Marathon',
        } as Record<string, string>,
        footnote: 'Finish times the watch predicts from VO₂max and recent training. Plotted as pace so all four distances share one scale; higher = faster.',
        reading: {
          faster: (distance: string, gain: string, current: string) =>
            `${distance} potential improved by ${gain} over this window, now ${current}.`,
          slower: (distance: string, loss: string) =>
            `${distance} potential slipped by ${loss} over this window.`,
          flat: 'Predicted times held steady over this window.',
        },
      },
      trainingStatusHistory: {
        title: 'Training Status',
        status: 'Status',
        chronic: 'Chronic load',
        acute: 'Acute load',
        daysUnit: 'd',
        footnote: 'The watch\'s daily verdict, with the acute and chronic load Firstbeat measured. The blue band is the chronic load range Garmin personalises for you.',
        reading: (dominant: string, pct: number, latest: string | null) =>
          `${dominant} dominates this window (${pct}% of rated days)${latest ? `, currently reading "${latest}"` : ''}.`,
      },
    },
    seasonHeadline: {
      eyebrow: 'Season headline',
      titlePositive: 'Fitter and more efficient than early season.',
      titleCaution: 'A tougher stretch than early season.',
      titleMixed: 'A mixed season - gains in some areas, dips in others.',
      efficiency: (d: number) => `Aerobic efficiency ${d > 0 ? '+' : ''}${d} - ${d > 0 ? 'more' : 'less'} speed per heartbeat`,
      easyPace: (to: string, from: string, weeks: number) =>
        `Easy pace ${to}, against ${from} averaged over the season's first ${weeks} weeks`,
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
    all: 'All',
    count: (n: number) => `${n} activit${n !== 1 ? 'ies' : 'y'}`,
    empty: 'No activities found',
    emptyFiltered: 'No sessions of this type',
    resetFilters: 'Reset filters',
    endOfList: 'That\'s all',
    thisWeek: 'This week',
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
      rpeValue: (n: number) => `RPE ${n}`,
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
      designLabels: {
        aurora: 'Aurora',
        pulse: 'Pulse',
        terrain: 'Terrain',
        prism: 'Prism',
        route: 'Route',
        map: 'Map',
        memory: 'Memory',
      },
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
      duration: 'Duration',
    },
    verdict: {
      title: 'Run Verdict',
      headline: {
        positive: (type: string) => `Solid ${type}`,
        neutral: (type: string) => `${type} logged`,
        caution: (type: string) => `Tough ${type}`,
      },
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
    decoupling: {
      title: 'Aerobic decoupling',
      stable: 'Held together',
      drifting: 'Faded',
      reading: {
        stable: 'Pace cost the same effort at the end as at the start - the aerobic base covered the distance.',
        drifting: 'Heart rate climbed while pace held - the aerobic base ran out before the distance did.',
        negative: 'The second half was more efficient than the first, usually a long warm-up settling in.',
      },
      footnote: 'Pace-to-heart-rate ratio, second half vs first. Under 5% is the mark of a steady run.',
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
      paceDelta: (seconds: number) => `+${seconds}s/km`,
      chartSummary: (n: number, best: string) =>
        `Pace across your ${n} runs on this route; record ${best}.`,
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
    weather: {
      wind: 'Wind',
      conditions: {
        clear: 'Clear sky',
        mainlyClear: 'Mainly clear',
        partlyCloudy: 'Partly cloudy',
        overcast: 'Overcast',
        fog: 'Fog',
        drizzle: 'Drizzle',
        freezingDrizzle: 'Freezing drizzle',
        rain: 'Rain',
        freezingRain: 'Freezing rain',
        snow: 'Snow',
        showers: 'Showers',
        snowShowers: 'Snow showers',
        thunderstorm: 'Thunderstorm',
      },
      compass: {
        n: 'N',
        ne: 'NE',
        e: 'E',
        se: 'SE',
        s: 'S',
        sw: 'SW',
        w: 'W',
        nw: 'NW',
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
      mapUnavailable: 'Map unavailable',
      mapUnavailableHint: 'No map token configured',
      routeMap: 'Activity route map',
    },
    splits: {
      title: 'Intervals',
      cols: {
        step: '#',
        type: 'Type',
        duration: 'Dur',
        dist: 'Dist',
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
    neverUsed: 'Never used',
    kmOf: (total: number, max: number) => `${total} / ${max} km`,
    retired: 'Retired',
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
    comparison: {
      title: 'How each pair is used',
      note: 'Pairs worn in different seasons are not a like-for-like test - the date range under each name says how far apart they ran.',
      period: (from: string, to: string) => `${from} - ${to}`,
      metrics: {
        sessions: 'Sessions',
        distance: 'Distance',
        keyShare: 'Key sessions',
        pace: 'Avg pace',
        heartRate: 'Avg HR',
        cadence: 'Cadence',
        groundContact: 'Ground contact',
        oscillation: 'Vert. oscillation',
      },
    },
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
        firstUsed: 'Since',
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
      lifetime: (runs: number, km: number) => `${runs} runs · ${km.toLocaleString('en')} km lifetime`,
      rankLine: (tier: string, pct: number) => `Rank ${tier} · top ${pct}% of VO₂max for your age`,
      rankBadge: (tier: string) => `RANK ${tier}`,
      topPctLine: (pct: number) => `Top ${pct}% VO₂max for your age`,
      namePlaceholder: 'Your name',
    },
    ytd: {
      thisYearChip: 'This year',
      allTimeChip: 'All',
      distance: 'Distance',
      duration: 'Duration',
      sessions: 'Sessions',
      elevation: 'Elevation',
      avgPerWeek: 'Avg / week',
      calories: 'Calories',
    },
    records: {
      title: 'Records',
      notYet: 'Not yet',
      viewAll: 'View Records',
      newBadge: 'NEW',
    },
    shoes: {
      title: 'Shoes',
      pairs: (n: number) => `${n} pair${n !== 1 ? 's' : ''} active`,
      allGood: 'All good',
      needsReplacing: (n: number) => n === 1 ? '1 pair needs replacing' : `${n} pairs need replacing`,
      viewShoes: 'View Shoes',
    },
    milestones: {
      distanceTier: (km: number) => `${km} km this year`,
      distanceTierDetail: (year: number) => `Crossed in ${year}`,
      streak: (weeks: number) => `${weeks}-week active streak`,
      streakDetail: 'Still going - a run logged every week since',
      record: (label: string) => `${label} record`,
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
      thisWeek: 'This week',
      recentWeeks: 'Last 4 weeks',
      noSessionsThisWeek: 'No sessions logged yet.',
      emptyWeekFallback: 'This week has no sessions yet - showing your last 4 weeks instead.',
      insight: {
        polarized: (pct: number, zoneLabel: string) =>
          `Very polarized: ${pct}% in ${zoneLabel}, little threshold work. Consistent with a base phase.`,
        dominant: (pct: number, zoneLabel: string) => `${pct}% of the time sits in ${zoneLabel}.`,
      },
    },
    athlete: {
      title: 'Athlete',
      lthr: 'LTHR',
      notSet: 'Not set',
      viewAthlete: 'View Athlete',
      details: 'Details',
      zoneRows: {
        5: 'Z5 Max',
        4: 'Z4 Thr',
        2: 'Z2 Easy',
      } as Record<number, string>,
      vo2maxShort: 'VO₂MAX',
      vmaShort: 'VMA',
      lthrShort: 'LTHR',
    },
    goal: {
      title: (year: number) => `Goal ${year}`,
      progress: (total: number, target: number) => `${total} / ${target} km`,
      viewGoals: 'View Goals',
    },
  },

  records: {
    title: 'Top Times',
    // Display names for the fixed record distances (see @/domain/activity/effort).
    distances: {
      '1k': '1K',
      '1mile': '1 Mile',
      '5k': '5K',
      '10k': '10K',
      half: 'Half',
      marathon: 'Marathon',
      longest: 'Longest Run',
    } as Record<string, string>,
    mostRecent: 'most recent',
    raceTag: 'race',
    notYetRun: 'Not yet run',
    segmented: {
      prs: 'Records',
      milestones: 'Milestones',
      routes: 'Routes',
    },
    recurring: {
      title: 'Routes you keep coming back to',
      subtitle: 'Same ground, same hills - the one place raw pace compares across months.',
      runCount: (n: number) => `${n} times`,
      best: 'Best',
    },
    noRecordYet: 'No record yet',
    predictedFromFitness: (time: string) => `Predicted ${time}`,
    findRace: (distance: string) => `Find a ${distance.toLowerCase()} ›`,
  },

  pbAlerts: {
    off: (diff: string) => `${diff} off your PR`,
  },

  nextRace: {
    countdown: (days: number) => `D-${days}`,
  },

  trainingZones: {
    title: 'Training Zones',
    thresholdLabel: (pace: string) => `Threshold ${pace}`,
    perKm: '/km',
    zones: {
      easy: {
        label: 'Easy',
        shortDesc: 'Aerobic base & recovery',
        example: 'Long runs, warm-up, cool-down',
      },
      marathon: {
        label: 'Marathon',
        shortDesc: 'Aerobic power & race pace',
        example: 'Tempo long runs, M-pace workouts',
      },
      threshold: {
        label: 'Threshold',
        shortDesc: 'Comfortably hard - T pace',
        example: 'Cruise intervals, tempo runs 20-40 min',
      },
      vo2max: {
        label: 'VO2max',
        shortDesc: '5K race effort - I pace',
        example: '3-5 min intervals, track workouts',
      },
    },
  },

  loadBalance: {
    title: 'Load Balance',
    window: 'last 4 weeks',
    buckets: {
      aerobicLow: 'Low Aerobic',
      aerobicHigh: 'High Aerobic',
      anaerobic: 'Anaerobic',
    },
    verdict: {
      below: 'Below target',
      onTarget: 'On target',
      above: 'Above target',
    },
    range: (min: number, max: number) => `Target ${min}–${max}`,
    // Garmin's own phrases; anything it adds later falls back to the raw code.
    feedback: {
      BELOW_TARGETS: 'Below targets',
      ABOVE_TARGETS: 'Above targets',
      ON_TARGET: 'Well balanced',
      LACKING_HIGH_AEROBIC: 'Lacking high aerobic',
      LACKING_LOW_AEROBIC: 'Lacking low aerobic',
      LACKING_ANAEROBIC: 'Lacking anaerobic',
      ANAEROBIC_SHORTAGE: 'Lacking anaerobic',
      NO_DATA: 'Not enough data',
    } as Record<string, string | undefined>,
    footnote: 'Firstbeat load over the last 4 weeks split by intensity, against the ranges Garmin personalises from your history. The marker is where you sit; the green zone is the target.',
  },

  loadRisk: {
    title: 'Load Risk',
    insufficientData: 'Not enough data',
    summary: {
      clear: (total: number) => `${total} markers, none in the alert zone`,
      flagged: (count: number) => `${count} marker${count !== 1 ? 's' : ''} to watch`,
    },
    acwr: {
      label: 'ACWR',
      description: 'Acute:chronic load ratio estimated from km · target 0.8–1.3',
      descriptionGarmin: 'Acute:chronic load ratio measured by the watch',
    },
    monotony: { label: 'Monotony', description: 'Day-to-day load variety · alert above 2.0' },
    rampRate: { label: 'Ramp rate', description: 'Δ CTL over 7 days' },
  },

  plan: {
    today: 'Today',
    prevPeriod: 'Previous',
    nextPeriod: 'Next',
    summary: (sessions: number, km: number) =>
      `${sessions} session${sessions !== 1 ? 's' : ''} · ${km} km`,
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    switcher: { week: 'Week', month: 'Month' },
    weekOf: (label: string) => `Week of ${label}`,
    // Tile-sized abbreviations of the activity types: a 44px day cell cannot
    // fit "VO₂ Max" or "Threshold" without clipping them to nonsense.
    typeShort: {
      Sprint: 'Sprint',
      Anaerobic: 'Anaero',
      VO2Max: 'VO2',
      Threshold: 'Thresh',
      Tempo: 'Tempo',
      Base: 'Base',
      Race: 'Race',
    } as Record<ActivityType, string>,
    restDay: 'Rest',
    planned: 'Planned',
    // Shown in place of the raw "Easy" zone name on a planned Base run.
    easyEffortLabel: 'Z2 easy',
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
    comingUp: 'Coming up',
    timeOfDay: {
      Morning: 'Morning',
      Afternoon: 'Afternoon',
      Evening: 'Evening',
      Night: 'Night',
    } as Record<ScheduledTimeOfDay, string>,
    keyTag: 'key',
    openPlanner: 'Open the weekly planner',
    viewDetail: 'View detail',
    type: 'Type',
    weekSummary: {
      load: 'Load',
      vsTypical: (percent: number) => `${percent - 100 >= 0 ? '+' : ''}${percent - 100}% vs typical`,
      easyHard: 'Easy / Hard',
      elevation: 'Elevation',
      climb: 'Climb',
    },
    raceFooter: {
      inDays: (days: number) => (days === 0 ? 'today' : days === 1 ? 'in 1 day' : `in ${days} days`),
      weeksIn: (done: number, total: number) => `${done}/${total}`,
      weeksInLabel: 'weeks in',
    },
    phaseTrack: {
      base: 'Base',
      build: 'Build',
      peak: 'Peak',
      taper: 'Taper',
      raceDay: 'Race',
    },
    weekPurpose: {
      recovery: 'Recovery week',
      steady: 'Steady week',
      build: 'Build week',
      thisWeek: 'This week',
      upcoming: 'Upcoming week',
      planPhase: {
        base: 'Base week',
        build: 'Build week',
        peak: 'Peak week',
        taper: 'Taper week',
        raceDay: 'Race day',
      },
      plannedSessions: (total: number, key: number) =>
        key > 0
          ? `${total} session${total > 1 ? 's' : ''} · ${key} key`
          : `${total} session${total > 1 ? 's' : ''}`,
      weekOfBlock: (done: number, total: number) => `week ${done} of ${total}`,
      adherence: (done: number, due: number) => `${done} / ${due} done`,
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
}
