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
  locale: 'en-US',

  brand: {
    namePrefix: 'Run',
    nameSuffix: 'Omics',
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
    weeklyMeans: (weeks: number) =>
      `${weeks} complete week${weeks === 1 ? '' : 's'} in this window · weekly means`,
    pointsInWindow: (points: number) => `${points} point${points === 1 ? '' : 's'} in this window`,
    tooFewToPlot: 'Too few points to draw a trend',
  },

  dates: {
    monthShortYear: (month: string, year2: string) => `${month} ’${year2}`,
  },

  // Form's named bands (domain/training/formBand).
  formBand: {
    tired: 'Tired',
    neutral: 'Neutral',
    fresh: 'Fresh',
    veryFresh: 'Very fresh',
  },

  // Every pace axis runs the same way (lib/chartAxis paceAxis).
  paceAxis: {
    caption: 'faster ↑',
  },

  // A session's state, drawn in shape (see the .state-* recipes) and named the
  // same way wherever a week is shown.
  sessionState: {
    done: 'Done',
    planned: 'Planned',
    missed: 'Missed',
    rest: 'Rest',
    today: 'Today',
    dayLabel: (day: string, state: string) => `${day}: ${state}`,
  },
  // Planned against ran, on a SessionCard.
  sessionCard: {
    ranAt: (km: string, pace: string) => `Ran ${km} km at ${pace}`,
    ran: (km: string) => `Ran ${km} km`,
    plannedKm: (km: string) => `planned ${km} km`,
    coachInsight: 'Coach insight',
    onPlan: 'On plan',
    plannedLine: (km: string) => `Planned ${km} km`,
    plannedType: (type: string) => `Planned ${type}`,
    ranLine: (km: string, time: string) => `Ran ${km} km · ${time}`,
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
    sec: 's',
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
      allAreas: 'All areas',
      areasRemainder: (name: string, extra: number) => `${name} +${extra} area${extra === 1 ? '' : 's'}`,
      allYears: 'All years',
      allTypes: 'All types',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      worldView: 'World view',
      exitWorldView: 'Exit world view',
      worldViewHint: 'Tap a zone to explore it',
      less: 'Rare',
      more: 'Frequent',
      noRoutes: 'No routes for this filter',
      mapUnavailable: 'Map unavailable - no map token configured',
      attribution: '© MapTiler · © OpenStreetMap contributors',
      territory: {
        eyebrowFor: (place: string) => `${place} · all-time`,
        headline: (percent: number, radius: number, place: string) =>
          `${percent}% of all your ${place} running sits within a ${radius} km radius.`,
        routesStat: 'distinct routes',
        radiusStat: 'median radius',
        eyebrowWorld: 'All areas · all-time',
        headlineWorld: (areaCount: number, percent: number, place: string) =>
          `Your running spreads across ${areaCount} area${areaCount === 1 ? '' : 's'} — ${percent}% of it in ${place}.`,
        areasStat: 'areas',
      },
    },
    shoes: {
      title: 'Shoes',
      subtitle: 'Mileage and wear per pair',
      back: 'Progress',
    },
    athlete: {
      title: 'Athlete',
      subtitle: 'Body, thresholds and training zones',
      back: 'Progress',
      source: 'Garmin',
      lastUpdated: (source: string, when: string) => `${source} · ${when}`,
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
    sync: {
      title: 'Garmin sync',
      subtitle: 'Pull in today’s runs without waiting for tonight.',
      action: 'Sync now',
      starting: 'Starting the workflow…',
      fetching: 'Fetching from Garmin, then rebuilding the app…',
      writing: 'New data is live. Writing the verdict…',
      upToDate: 'Already up to date — no new run to fetch.',
      stillRunning: 'Still running. The verdict will appear on its own.',
      failed: 'Could not start the sync.',
      viewRun: 'View run ›',
      takesAbout: 'Takes about five minutes end to end.',
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
    },
    accent: {
      title: 'Accent color',
      preview: 'Preview',
      caption: 'Semantic hues shift to avoid a clash — red stays injury, amber stays caution.',
      options: {
        nature:      { label: 'Green' },
        teal:        { label: 'Teal' },
        performance: { label: 'Blue' },
        endurance:   { label: 'Violet' },
        silver:      { label: 'Silver' },
      },
      custom: {
        label: 'Custom',
        open: 'Custom accent hue',
        close: 'Done',
        reserved: 'Reserved for injury and caution.',
        hue: (degrees: number) => `Custom · ${Math.round(degrees)}°`,
        stop: (degrees: number) => `Hue ${Math.round(degrees)} degrees`,
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
      thresholdPace: 'Thresh. pace',
      vma: 'VMA',
      maxHr: 'Max HR',
      restingHr: 'Resting HR',
      vo2max: 'VO2max',
      weight: 'Weight',
      height: 'Height',
      fitnessAge: 'Fitness age',
      achievableFitnessAge: 'Potential',
      bmi: 'BMI',
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
      workbook: 'Export training data (.xlsx)',
      exporting: 'Exporting...',
      failed: 'Could not export the training data.',
    },
    offlineCache: {
      clear: 'Clear offline cache',
      cost: 'Pages and maps reload from the network until you visit them again.',
      confirm: 'Clear it?',
      cleared: 'Offline cache cleared.',
      failed: 'Could not clear the offline cache.',
    },
    notifications: {
      title: 'Push notifications',
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
      activeDaysUnit: 'active days',
      rollingWindow: 'rolling 12 months',
      less: 'Less',
      more: 'More',
      restDay: 'Rest day',
      day: (km: number, runs: number) =>
        `${km} km · ${runs} run${runs !== 1 ? 's' : ''}`,
    },
    trainingLoad: {
      title: 'Training Load',
      fitness: 'Fitness',
      fatigue: 'Fatigue',
      form: 'Form',
      footnote:
        'Fitness = 42-day load average (CTL) · Fatigue = 7-day (ATL) · Form = Fitness - Fatigue (TSB).',
    },
    // Training status and Form / Fitness / Fatigue, one card on Today.
    bodyCard: {
      daysOfLast: (days: number, total: number) => `${days} of the last ${total} days`,
      legendItem: (status: string, days: number) => `${status} ${days} d`,
      deltaIn: (delta: string, days: number) => `${delta} in ${days} d`,
      openHistory: 'Training status history',
    },
    latestRecord: 'Latest record',
    trainingStatusDays: {
      title: 'Training Status',
      titleToday: (title: string) => `${title} · today`,
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
          headline: 'Fatigue is ahead of fitness.',
          headlineFormDown: 'Form is below your usual range.',
          body: (fatigue: number, fitness: number, form: string, weekDelta: string) =>
            `Fatigue ${fatigue} vs fitness ${fitness} · form ${form}, ${weekDelta} this week.`,
          weekDown: (points: number) => `down ${points}`,
          weekUp: (points: number) => `up ${points}`,
          weekFlat: 'flat',
        },
      },
      restDay: 'Rest day',
      restDaySubtitle: 'No session scheduled',
      race: 'Race',
    },
    weeklyStreak: {
      weeksInARow: (weeks: number) => `${weeks} week streak`,
      kmRemaining: (km: number) => `${km} km to this week's goal`,
      perDayToGoal: (perDay: string, target: string) => `${perDay} km/day to hit ${target}`,
      ringOf: (target: number) => `of ${target} km`,
      // The ring's target is the annual goal's weekly share, and says so; the
      // plan's own total sits beside it, named, so the two never pass for one.
      goalLabel: 'Weekly goal',
      planHas: (sessions: number, km: string) => `plan has ${sessions} session${sessions !== 1 ? 's' : ''}, ${km}\u00a0km`,

      goalReached: 'Weekly goal reached',
    },
    celebration: {
      eyebrow: 'New personal record',
      later: 'Later',
      viewAndShare: 'View & share',
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
    },
  },

  analytics: {
    title: 'Analytics',

    aboutChart: 'What this chart measures',
    season: (year: number) => `${year} season`,
    allTimeChip: 'All',
    tabs: {
      fitness: 'Fitness',
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
      topPercent: (p: number) => `top ${p}%`,
      vsNorms: 'vs age & sex norms',
      since: (when: string) => `vs ${when}`,
      ofDays: (days: string) => `of ${days} days`,
    },
    raceTimes: {
      title: 'Performance',
      trend: 'Race times ↓',
      shortLabels: {
        '5k': '5K',
        '10k': '10K',
        half: 'Half',
        marathon: 'Mara',
      } as Record<string, string>,
    },
    stats: {
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
        footnote: 'Distance-weighted average pace, faster ↑.',
        explains: {
          improving: (delta: string) => `Easy pace improving - ${delta} vs earlier in the period`,
          stable: 'Easy pace stable throughout the period',
          slowing: (delta: string) => `Easy pace slowing ${delta} - may reflect fatigue or high volume`,
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
        targetLine: '80% easy',
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
        footnote: 'Every run of the season, grouped by distance. Colour intensity reflects relative frequency.',
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
      monthlyComparison: {
        title: 'Month by Month',
        reading: (curYear: number, deltaPct: number) =>
          deltaPct >= 0
            ? `${curYear} volume is running ${deltaPct}% ahead of last year.`
            : `${curYear} volume is running ${Math.abs(deltaPct)}% behind last year.`,
      },
      threshold: {
        title: 'Running Lactate Threshold',
        pace: 'Threshold pace',
        lthr: 'Threshold HR',
        footnote: 'The effort you can hold before lactate builds up, as the watch measures it. Garmin revises it every few weeks, so the line steps rather than drifts.',
        reading: {
          change: (delta: string) => `Threshold pace is ${delta} since the first reading in this window.`,
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
        footnote: 'Finish times the watch predicts from VO₂max and recent training. Plotted as pace so all four distances share one scale, faster ↑.',
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
        distribution: 'Days at each status',
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
      efficiency: (d: number) => `Aerobic efficiency ${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)} - ${d > 0 ? 'more' : 'less'} speed per heartbeat`,
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
    countWithDistance: (runs: number, km: string) => `${runs} run${runs === 1 ? '' : 's'} · ${km} km`,
    empty: 'No activities found',
    emptyFiltered: 'No sessions of this type',
    resetFilters: 'Reset filters',
    endOfList: 'That\'s all',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    weekStat: {
      km: 'km',
      runs: (n: number): string => (n === 1 ? 'run' : 'runs'),
      easy: 'easy',
      noSplit: '—',
    },
    weekGoal: (done: string, goal: string) => `${done} of ${goal} km · weekly goal`,
    weekPlanTotal: (km: string) => `plan ${km} km`,
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
      distance: 'Distance',
      duration: 'Duration',
      pace: 'Pace',
      avgHr: 'Avg HR',
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
    // Read-only: RPE comes from the watch, and the note is the one thing on an
    // activity the user writes.
    effort: {
      label: 'Effort (RPE)',
      value: (rpe: number, label: string) => `${rpe} · ${label}`,
      notLogged: 'not logged on the watch',
    },
    noteRow: {
      label: 'Note',
      add: 'Add',
      edit: 'Edit',
      read: 'Read',
      none: 'No note',
    },
    tabs: {
      groupLabel: 'Activity sections',
      overview: 'Overview',
      intervals: 'Intervals',
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
    officialResult: {
      title: 'Official result',
      chip: 'Chip',
      gun: 'Gun',
      placing: (place: number, count: number) => `${place} of ${count}`,
      placingWithoutField: (place: number) => `${place}${place % 10 === 1 && place % 100 !== 11 ? 'st' : place % 10 === 2 && place % 100 !== 12 ? 'nd' : place % 10 === 3 && place % 100 !== 13 ? 'rd' : 'th'}`,
      topPercent: (percent: number) => `Top ${percent}%`,
      deviceNote: (distance: string, duration: string) => `Watch recorded ${distance} in ${duration}`,
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
      seeInCharts: 'See it in Charts ›',
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
      // The row that stands in for the card on Overview. Ranked by pace, so it
      // says pace; a run's total time is secondary.
      rowTitle: (rank: number, n: number) =>
        rank === 1 ? `Same route · best pace of ${n}` : `Same route · ${ordinal(rank)}-best pace of ${n}`,
      rowDelta: (seconds: number) => `+${seconds} s/km vs your route best`,
      rowBest: 'Your best pace on this route',
    },
    notes: {
      title: 'Notes',
      sheetTitle: 'Run notes',
      notePlaceholder: 'How did it feel? Weather, terrain, sensations...',
      tagPlaceholder: 'New tag',
      tagHint: 'Press Enter to add',
      usedBefore: 'Used before',
      removeTag: (tag: string) => `Remove tag ${tag}`,
      addTag: (tag: string) => `Add tag ${tag}`,
    },
    zones: {
      title: 'Time in Zones',
      noData: 'No HR zone data',
      unused: (range: string) => `${range} unused on this run`,
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
      band: (weeks: number) => `band = your ${weeks}-week range`,
      verdict: {
        longer: 'longer',
        shorter: 'shorter',
        quicker: 'quicker',
        slower: 'slower',
        bouncier: 'bouncier',
        tighter: 'tighter',
        costlier: 'costlier',
        flatter: 'flatter',
        level: 'level',
      },
      form: {
        title: 'Form through the run',
        faded: (km: string) => `faded after ${km} km`,
        held: 'held to the finish',
        readingFaded: (km: string) =>
          `Cadence dropped over the last ${km} km and stayed down - the fade the decoupling figure reports, in your mechanics.`,
        readingHeld:
          'Cadence held its level from the first kilometre to the last - nothing in the mechanics slipped.',
        summary: 'Cadence over the run, marked where it dropped away.',
      },
    },
    charts: {
      heartRate: 'Heart Rate',
      hr: 'HR',
      avg: 'avg',
      max: 'max',
      best: 'best',
      pace: 'Pace',
      elevation: 'Elevation',
      cadence: 'Cadence',
      elevationGain: (m: number) => `+${m} m gain`,
      readoutAt: 'At',
      runAverage: 'Run average',
      dragToScrub: 'drag to scrub',
      dashedAverage: 'dashed = run average',
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
      lapTitle: 'Laps',
      perKmTitle: 'Kilometre splits',
      continuous: 'Continuous run — no interval structure recorded.',
      partialKm: (km: string) => `final ${km}`,
      repSetLabel: (reps: number, duration: string) => `${reps} × ${duration}`,
      bandLabel: (range: string) => `band ${range}/km`,
      colFaster: 'faster →',
      recoveryLine: (duration: string, km: string) => `rec ${duration} · ${km} km`,
      acrossTheSet: 'Across the set',
      drift: {
        down: (bpm: number) => `heart rate came down ${bpm} bpm`,
        flat: 'heart rate sat flat',
        up: (bpm: number) => `heart rate climbed ${bpm} bpm`,
        unknown: 'heart rate went unrecorded',
      },
      spread: 'pace spread',
      inBand: (inBand: number, total: number) => `${inBand}/${total} in band`,
      repHrDrift: 'Rep HR drift',
      recoveryPace: 'Recovery pace',
      reading: {
        repsBuilt: (total: number, first: string, last: string, drift: string) =>
          `${total} reps tightening from ${first} to ${last}/km, and ${drift} across the set - this one was built, not held.`,
        repsHeld: (inBand: number, total: number, drift: string) =>
          `${inBand} of ${total} reps landed inside the band and ${drift} across the set - this was a repeatable effort.`,
        repsHeldRecoveriesSlowed: (inBand: number, total: number, first: string, last: string) =>
          `${inBand} of ${total} reps stayed in the band while the recoveries slowed from ${first} to ${last}/km - the fatigue landed between the reps, not inside them.`,
        repsFaded: (inBand: number, total: number, spread: number) =>
          `Only ${inBand} of ${total} reps landed inside the band, ${spread}s apart from fastest to slowest - the work drifted as the set went on.`,
      },
      cols: {
        km: 'Km',
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
        lap:               'Lap',
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
    noDateSet: 'no date set',
    done: 'done',
    beatenBy: (gap: string) => `beaten by ${gap}`,
    missedBy: (gap: string) => `missed by ${gap}`,
    best: 'Best',
    predictedTag: 'predicted',
    findRace: 'Find a race ›',
    seasonRaces: 'Season Races',
    emptyPbs: (year: number) => `No PBs for ${year} yet - add them in Settings.`,
    projection: {
      status: {
        ahead: 'Ahead',
        on_track: 'On track',
        behind: 'Behind',
      },
      projected: (km: string) => `Projected ${km} km`,
      projectedValue: (km: string) => `${km} km`,
      projectedLabel: 'projected',
      projectedTick: 'proj.',
      shortBy: (km: string) => `${km} short`,
      overBy: (km: string) => `${km} over`,
      needsWeeklyDetail: (needed: string, current: string) => `Needs ${needed} km/wk — currently running ${current}`,
    },
    monthlyVolume: {
      title: 'Monthly Volume',
      expand: 'Expand',
      collapse: 'Collapse',
      status: {
        ahead: 'Hit',
        on_track: 'On track',
        behind: 'Short',
        pending: 'Upcoming',
      },
      km: (actual: number, target: number) => `${actual} / ${target}`,
      targetRule: 'monthly target',
      inProgress: 'in progress',
      daysIn: (month: string, days: number) => `${month} is ${days} day${days === 1 ? '' : 's'} in`,
      proRata: (actual: number, target: number) => `${actual} of a pro-rata ${target} km`,
      proRataCaption: (days: number) => `pro-rata · ${days} day${days === 1 ? '' : 's'} in`,
    },
    history: {
      title: 'Past Years',
      achieved: 'Achieved',
      missed: 'Missed',
      annualKm: (actual: string, target: string) => `${actual} / ${target} km`,
      targetsCount: (achieved: number, total: number) => `${achieved}/${total} race targets`,
    },
  },

  shoes: {
    neverUsed: 'Never used',
    kmOf: (total: number, max: number) => `${total} / ${max} km`,
    retired: 'Retired',
    active: 'Active',
    rotationSummary: (activePairs: number, retiredPairs: number, km: string) =>
      `${activePairs} in rotation · ${retiredPairs} retired · ${km} km tracked`,
    // The rotation row used to print a bare `Sep 13` next to the mileage, with
    // nothing saying which date it was. Both keys take an already-formatted
    // date because i18n can never import the formatters.
    lastRun: (date: string) => `last run ${date}`,
    status: {
      ok: 'Good',
      watch: 'Replace soon',
      replace: 'Replace',
    },
    kmLeft: (km: number) => `~${km} km left`,
    // No tilde on the detail hero: promoting a number to 34px and then
    // hedging it with "~" undercuts the very thing that made it the hero.
    // The list row keeps the tilde - there, it's one line among several, not
    // the headline.
    kmLeftExact: (km: number) => `${km} km left`,
    kmPerWeek: (km: number) => `${km} km/wk`,
    retiredLife: (era: string, runs: number, weeks: number) => `${era} · ${runs} runs · ${weeks} weeks`,
    hero: {
      usage: (n: number, total: number) => `Used in ${n} of your last ${total} tempo/threshold runs`,
      rotateBeforeRace: (date: string) => ` – rotate in a backup before your ${date} race.`,
      rotate: ' – rotate in a backup.',
    },
    comparison: {
      title: 'Compare two pairs',
      change: 'Change',
      changeLabel: 'Change which pairs are compared',
      pickHint: 'Pick two pairs — a new pick replaces the older one',
      // The two clauses read as one sentence now instead of two stacked
      // captions - what's real, then why it's still not a fair fight. Only
      // shown alongside an actual averages claim - with too few runs there's
      // no averages difference for this caveat to qualify.
      note: 'Both ran in different blocks – read the difference as the season, not the shoe.',
      delta: 'Δ',
      same: 'same',
      beyondNoise: (metrics: string) => `${metrics} differ beyond measurement noise; the rest is the same runner.`,
      noneBeyondNoise: 'Nothing here differs beyond measurement noise - the rest is the same runner.',
      // Names which pair(s) fall short, not just the fact that some do - "too
      // few runs" alone leaves the reader guessing which of two columns it
      // means.
      tooFewRunsShoe: (name: string, count: number) => `${name} has ${count} run${count === 1 ? '' : 's'}`,
      tooFewRuns: (shoes: string, minRuns: number) => `${shoes} – form averages need about ${minRuns}.`,
      groups: {
        howMuch: 'How much',
        howItRan: 'How it ran',
      },
      // The unit lives in the label, not a second span next to every value -
      // a 78px label column has no room to also print "km"/"bpm" per row.
      metrics: {
        sessions: 'Runs',
        distance: 'Distance km',
        keyShare: 'Key sessions',
        pace: 'Pace /km',
        heartRate: 'HR bpm',
        cadence: 'Cadence spm',
        groundContact: 'Contact ms',
        oscillation: 'Bounce mm',
      },
      metricNames: {
        pace: 'pace',
        heartRate: 'heart rate',
        cadence: 'cadence',
        groundContact: 'ground contact',
        oscillation: 'vertical oscillation',
      },
    },
    detail: {
      back: 'Shoes',
      stats: {
        distance: 'Distance',
        activities: 'Runs',
        firstRun: 'First run',
        kmPerWeek: 'km / week',
        avgPace: 'Avg pace',
        weeks: 'Weeks',
        avgRun: 'Avg run',
      },
      activitiesTitleActive: 'Recent runs',
      activitiesTitleRetired: 'Last runs before retiring',
      allActivitiesCount: (count: number) => `All ${count}`,
      empty: 'No activities recorded with this pair yet.',
      projectedRunOut: (weeklyKm: number, maxKm: number, targetDate: string, weeksRemaining: number) =>
        `At ${weeklyKm} km a week you'll hit ${maxKm} km around ${targetDate} – about ${weeksRemaining} more week${weeksRemaining === 1 ? '' : 's'}.`,
      // A three-year forecast off six runs is noise, not information - past a
      // year out, the sentence drops the date and says only what's true: it's
      // a long way off at this rate.
      projectedRunOutFar: (weeklyKm: number, maxKm: number) =>
        `At ${weeklyKm} km a week, ${maxKm} km is more than a year away.`,
      verdict: {
        eyebrow: (statusLabel: string) => `Verdict · ${statusLabel}`,
        weeksLeft: (weeks: number) => `About ${weeks} more weeks at your pace.`,
        planReplacement: 'Plan the replacement this month.',
        replaceNow: 'Line up the replacement now.',
        noPaceData: 'Not enough recent mileage to project a timeline yet.',
      },
      typeShareLabels: {
        intervals: 'Intervals',
      },
      // The bar folds seven activity types into three buckets silently
      // otherwise - a shoe with Race or Anaerobic runs in it never shows
      // those words anywhere, so the caption says what each bucket holds.
      typeShareGrouped: 'Tempo groups threshold; Intervals groups sprint, anaerobic, VO2max and races.',
      whatYouRunIn: {
        title: 'What you run in it',
        summary: (pace: string, hr: number) => `${pace} · ${hr} bpm`,
      },
      whatItWasFor: {
        title: 'What it was for',
        // No pace here: a retired pair's stat row already has "Avg pace" - this
        // line only earns its place by adding the one figure the row doesn't.
        summary: (hr: number) => `${hr} bpm avg`,
        // No "your key-session pair" branding - that possessive reads as a
        // superlative ("the one pair that's for quality work"), and two
        // retired pairs can land on the same side of this same 50% line.
        keySessionPair: (percent: number) => `${percent}% of its distance was tempo or intervals.`,
        easyPair: (percent: number) => `${percent}% of its distance was base running.`,
      },
      retiredHero: {
        // "Ran out" only means something for a pair that actually reached the
        // end of its life - one that was swapped out early gets the honest
        // percentage instead of a life it never finished.
        ranOut: (maxKm: number, weeks: number) => `Ran nearly all of a ${maxKm} km life in ${weeks} weeks.`,
        ranOutFastest: (maxKm: number, weeks: number) =>
          `Ran nearly all of a ${maxKm} km life in ${weeks} weeks – the fastest you've worn a pair through.`,
        retiredEarly: (percent: number, maxKm: number, weeks: number) =>
          `Retired at ${percent}% of a ${maxKm} km life, after ${weeks} weeks.`,
      },
    },
  },

  profile: {
    hero: {
      lifetime: (runs: number, km: string) => `${runs} runs · ${km} km lifetime`,
      recency: (lastRun: string, activeDays: number) => `Last run ${lastRun} · ${activeDays} active days lifetime`,
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
      vsLastYear: (year: number) => `vs ${year}`,
      noComparison: '—',
    },
    records: {
      title: 'Records',
      notYet: 'Not yet',
      viewAll: 'View Records',
      newBadge: 'NEW',
    },
    shoes: {
      pairs: (n: number) => `${n} pair${n !== 1 ? 's' : ''} active`,
      needsReplacing: (n: number) => n === 1 ? '1 pair needs replacing' : `${n} pairs need replacing`,
      namedMileage: (name1: string, km1: string, name2: string, km2: string, max: string) =>
        `${name1} ${km1} km · ${name2} ${km2} km · both of ${max}`,
      mileageOfMax: (km1: string, km2: string, max: string) => `${km1} and ${km2} km of ${max}`,
    },
    milestones: {
      distanceTier: (km: string) => `${km} km this year`,
      streak: (weeks: number) => `${weeks}-week active streak`,
      streakDetail: 'Still going - a run logged every week since',
      record: (label: string) => `${label} record`,
      firstActivity: 'First step',
      firstActivityDetail: (km: number) => `Where it all began - ${km.toFixed(1)} km`,
      lifetimeDistance: (km: string) => `${km} km lifetime`,
      lifetimeDistanceDetail: (marathons: number) => `${marathons} marathons run`,
      lifetimeDistanceWorldTour: '🌍 A full trip around the Earth',
      activityCount: (n: number) => `${ordinal(n)} run`,
      activityCountDetail: (km: string) => `${km} km covered so far`,
    },
    trainingZones: {
      title: 'Training zones',
      lthr: 'LTHR',
      subline: (lthr: number) => `LTHR ${lthr} bpm`,
      sublineWithThreshold: (lthr: number, pace: string) => `LTHR ${lthr} bpm · threshold ${pace} /km`,
      total: (duration: string) => `${duration} total`,
      thisWeek: 'This week',
      thisWeekCaption: 'this week',
      recentWeeks: 'Last 4 weeks',
      avgPerWeek: 'avg / week',
      columnZone: 'Zone',
      columnPace: 'Pace /km',
      columnThisWeek: 'This wk',
      columnAvgWeek: 'Avg / wk',
      zoneNames: {
        5: 'Max',
        4: 'Threshold',
        3: 'Aerobic',
        2: 'Easy',
        1: 'Warmup',
      } as Record<number, string>,
      noSessionsThisWeek: 'No sessions logged yet.',
      noSessionsRecent: 'No sessions logged in these 4 weeks.',
      emptyWeekFallback: 'This week has no sessions yet - showing your last 4 weeks instead.',
      highIntensityNote: (pct: number) =>
        `${pct}% of your time was Z4–Z5, against the 10–15% a build block usually asks for.`,
    },
    athlete: {
      title: 'Athlete',
      lthr: 'LTHR',
      notSet: 'Not set',
      details: 'Details',
      zoneRows: {
        5: 'Z5 Max',
        4: 'Z4 Thr',
        3: 'Z3 Aerobic',
        2: 'Z2 Easy',
        1: 'Z1 Rec',
      } as Record<number, string>,
      vo2maxShort: 'VO₂MAX',
      vmaShort: 'VMA',
      lthrShort: 'LTHR',
    },
    goal: {
      title: (year: number) => `Goal ${year}`,
      progress: (total: string, target: string) => `${total} / ${target} km`,
      viewGoals: 'View Goals',
    },
  },

  records: {
    title: 'Top Times',
    distances: {
      '1k': '1K',
      '1mile': '1 Mile',
      '5k': '5K',
      '10k': '10K',
      half: 'Half',
      marathon: 'Marathon',
      longest: 'Longest Run',
    } as Record<string, string>,
    raceTag: 'race',
    trainingTag: 'training run',
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
      trailKey: 'taller = faster',
    },
    noRecordYet: 'No record yet',
    predictedHeader: 'best · predicted',
    medalLegend: ['1st', '2nd', '3rd'] as [string, string, string],
    findRace: (distance: string) => `Find a ${distance.toLowerCase()} ›`,
  },

  pbAlerts: {
    off: (diff: string) => `${diff} off your PR`,
  },

  nextRace: {
    countdown: (days: number) => `D-${days}`,
    today: 'Today',
    tomorrow: 'Tomorrow',
  },

  trainingZones: {
    title: 'Pace zones',
    zoneNumber: (n: number) => `Z${n}`,
    subline: (pace: string) => `min/km · from threshold ${pace}`,
    perKm: '/km',
    zones: {
      warmup: {
        label: 'Warmup',
        shortDesc: 'Recovery & pre-run shakeout',
      },
      easy: {
        label: 'Easy',
        shortDesc: 'Aerobic base & recovery',
      },
      marathon: {
        label: 'Aerobic',
        shortDesc: 'Aerobic power & race pace',
      },
      threshold: {
        label: 'Threshold',
        shortDesc: 'Comfortably hard - T pace',
      },
      vo2max: {
        label: 'VO2max',
        shortDesc: '5K race effort - I pace',
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
    summary: (sessions: number, ranKm: number, plannedKm: number) =>
      `${sessions} session${sessions !== 1 ? 's' : ''} · ${ranKm} of ${plannedKm} km planned`,
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    switcher: { week: 'Week', month: 'Month' },
    weekGutter: 'WK',
    weekGutterEmpty: '—',
    extra: 'extra',
    monthLegend: {
      plannedKm: 'planned km',
      ran: 'ran',
      unplanned: 'unplanned',
    },
    typeShort: {
      Sprint: 'Sprint',
      Anaerobic: 'Anaer.',
      VO2Max: 'VO₂',
      Threshold: 'Thresh.',
      Tempo: 'Tempo',
      Base: 'Base',
      Race: 'Race',
    } as Record<ActivityType, string>,
    restDay: 'Rest',
    planned: 'Planned',
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
      rec: (m: number) => `${m}' rec`,
    },
    timeOfDay: {
      Morning: 'Morning',
      Afternoon: 'Afternoon',
      Evening: 'Evening',
      Night: 'Night',
    } as Record<ScheduledTimeOfDay, string>,
    openPlanner: 'Open the weekly planner',
    viewActivity: 'view activity',
    type: 'Type',
    races: 'Races',
    targetPace: (pace: string) => `target ${pace}`,
    continuous: 'continuous',
    ranKm: (km: string) => `${km} km ran`,
    plannedKmLabel: (km: number) => `${km} km planned`,
    restCard: {
      title: 'Rest day',
      noSession: 'No session planned',
      next: (weekday: string, title: string) => `No session planned · next is ${weekday}, ${title}`,
    },
    intensityNote: (zones: string) => `Colour = intensity (${zones})`,
    weekSummary: {
      load: 'Load',
      loadUnit: 'pts',
      missed: (n: number) => `${n} missed`,
      sessionsCount: (n: number) => `${n} session${n !== 1 ? 's' : ''}`,
      ranOfPlan: (ran: string, plan: string) => `${ran} of ${plan} km`,
      sessionsOfPlan: (ran: number, plan: number) => `${ran} of ${plan} session${plan !== 1 ? 's' : ''}`,
      planOnly: (km: string, sessions: number) => `Plan ${km} km · ${sessions} session${sessions !== 1 ? 's' : ''}`,
      easyHardRatio: (easy: number, hard: number) => `${easy}/${hard} easy`,
      easyHardPlanned: (easy: number, hard: number) => `${easy}/${hard} easy planned`,
      loadPlanned: 'planned',
    },
    plannedVsRecorded: (planned: string, recorded: string) => `planned ${planned} · recorded ${recorded}`,
    raceFooter: {
      weeksIn: (done: number, total: number) => `${done}/${total}`,
      targetTime: (clock: string) => `target ${clock}`,
      primaryTarget: 'primary',
      tuneUp: 'tune-up',
      blockEndsHere: 'block end',
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
      thisWeek: 'This week',
      upcoming: 'Upcoming week',
      prePlan: 'Pre-plan',
      planPhase: {
        base: 'Base week',
        build: 'Build week',
        peak: 'Peak week',
        taper: 'Taper week',
        raceDay: 'Race day',
      },
      weekOfTarget: (done: number, total: number) => `${done} of ${total}`,
    },
  },

  coaching: {
    garminOutOfDate: 'Garmin out of date',
    states: {
      prescribed: 'Prescribed',
      adjusted: 'Adjusted',
      completed: 'Completed',
      missed: 'Missed',
      cancelled: 'Cancelled',
    },
    outcomes: { KEEP: 'Keep', ADJUST: 'Adjust', REPLAN: 'Replan' },
    planned: 'Planned',
    actual: 'Actual',
    distance: 'Distance',
    pace: 'Pace',
    heartRate: 'Heart rate',
  },

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

/** The shape every locale must match, derived from the English table. */
export type Strings = typeof en
