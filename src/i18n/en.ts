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
      activities: 'Activities',
      calendar: 'Calendar',
      analytics: 'Analytics',
      heatmap: 'Heatmap',
      profile: 'Profile',
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
    day: 'd',
    elevation: 'm gain'
  },

  common: {
    viewAll: 'View all',
    sessions: (n: number) => `${n} session${n !== 1 ? 's' : ''}`,
    runs: (n: number) => `${n} run${n !== 1 ? 's' : ''}`,
    close: 'Close',
  },

  pages: {
    dashboard: {
      title: 'Dashboard',
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
    calendar: {
      title: 'Calendar',
    },
    records: {
      title: 'Records',
      subtitle: 'Personal bests and race predictions',
      back: 'Profile',
    },
    map: {
      title: 'Running Heatmap',
      back: 'Activities',
      routes: (n: number) => `${n} routes`,
      zones: 'Zones',
      allYears: 'All years',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
    },
    shoes: {
      title: 'Shoes',
      subtitle: 'Mileage and wear per pair',
      back: 'Profile',
    },
    profile: {
      title: 'Profile',
    },
    notFound: {
      code: '404',
      heading: "This page went on a run and didn't come back.",
      sub: "The route you're looking for doesn't exist.",
      back: 'Back to Dashboard',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Appearance, notifications and data export.',
      back: 'Profile',
    },
  },

  settings: {
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
      title: 'Data source',
      garmin: 'Garmin Connect',
      syncMethod: 'Synced automatically once a day',
    },
    dataExport: {
      csv: 'Export activities (.csv)',
      exporting: 'Exporting...',
    },
    notifications: {
      title: 'Push notifications',
      denied: 'Notifications are blocked - allow them in your browser settings.',
      unsupported: 'Push notifications are not supported in this browser.',
      error: 'Could not update notification settings, please retry.',
      types: {
        training: {
          title: 'Training reminders',
          subtitle: 'Weekly check-in on your distance goal.',
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
      prevWeek: 'Previous week',
      nextWeek: 'Next week',
      jumpToCurrent: 'This week',
    },
    weekLoad: {
      label: (percent: number): string => {
        if (percent >= 120) return '↑ Heavy week'
        if (percent >= 90)  return 'Normal week'
        if (percent >= 60)  return '↓ Light week'
        return '↓ Very light week'
      },
      level: {
        low: 'Light load',
        normal: 'Normal load',
        high: 'Heavy load',
      },
      tooltip: (window: number) => `Training load (TRIMP) so far this week vs the average of the last ${window} weeks`,
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
    },
    syncStatus: {
      synced: (relative: string) => `Synced ${relative}`,
      justNow: 'just now',
      minutesAgo: (m: number) => `${m}m ago`,
      hoursAgo: (h: number) => `${h}h ago`,
      daysAgo: (d: number) => `${d}d ago`,
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
      fatigue: 'Fatigue',
      form: 'Form',
      fitnessTooltip: 'Chronic Training Load (42d avg). Your aerobic base.',
      fatigueTooltip: 'Acute Training Load (7d avg). Recent fatigue.',
      formTooltip: 'Form = Fitness - Fatigue. Positive = fresh legs.',
      tsbHint: (tsb: number): string => {
        if (tsb >= 15) return 'Peak form\nrace ready'
        if (tsb >= 5)  return 'Fresh legs\ntrain hard'
        if (tsb >= 0)  return 'Balanced\noptimal window'
        if (tsb >= -10) return 'Slight fatigue\nrecovery possible'
        if (tsb >= -20) return 'High fatigue\nease off'
        return 'Overreaching\nrest needed'
      },
    },
  },

  analytics: {
    title: 'Analytics',
    season: (year: number) => `${year} season`,
    allTimeChip: 'All',
    allTimeTitle: 'All-time',
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
      yearsTracked: 'Years tracked',
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
        footnote: 'Duration-weighted average HR, easy vs workout runs.',
      },
      cadence: {
        title: 'Cadence',
        unit: 'spm',
        footnote: 'Duration-weighted average cadence (steps/min).',
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
      temperatureCorrelation: {
        title: 'Temperature vs Pace',
        footnote: 'Each dot is one run (>= 3 km). Dashed line shows the overall trend.',
        tooltip: { temp: 'Temp', pace: 'Pace', distance: 'Distance' },
        explains: {
          slowing: (sec: number) => `Pace slows ~${sec}s/km per 10°C - heat has a clear impact`,
          stable: 'Temperature has little impact on your pace',
        },
      },
      rpeLoadCorrelation: {
        title: 'Form vs Relative Effort',
        footnote: 'Each dot is one run (>= 3 km), compared to your usual RPE for that session type so a sprint and an easy run are judged fairly. Color shows temperature when known. Dashed line shows the overall trend.',
        tooltip: { form: 'Form (TSB)', rpe: 'RPE', delta: 'vs usual', temp: 'Temp' },
        explains: {
          harder: (delta: number) => `Runs feel ~${delta} RPE harder than usual per 10-point drop in form - fatigue clearly affects perceived effort`,
          stable: 'Your form has little impact on how hard runs feel relative to usual',
        },
      },
      monthlyComparison: { title: 'Month by Month' },
      efficiencyRolling: {
        title: 'Aerobic Efficiency - Rolling Trend',
        ef7: '7-day',
        ef30: '30-day',
        unit: 'm/min·bpm',
        footnote: 'Rolling aerobic efficiency over the last 90 days. 7-day captures recent form, 30-day shows the underlying trend.',
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
    searchToggle: 'Search',
    all: 'All',
    count: (n: number) => `${n} activit${n !== 1 ? 'ies' : 'y'}`,
    page: (current: number, total: number) => ` · page ${current}/${total}`,
    empty: 'No activities found',
    emptyFiltered: 'No sessions of this type',
    resetFilters: 'Reset filters',
    endOfList: 'That\'s all',
    monthGroup: (count: number, km: number) => `${count} session${count !== 1 ? 's' : ''} · ${km} km`,
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
    bestEfforts: {
      title: 'Best Efforts',
      prBadge: 'PR',
    },
    notes: {
      title: 'Notes',
      notePlaceholder: 'How did it feel? Weather, terrain, sensations...',
      tagPlaceholder: 'Add a tag (e.g. rain, trail, tired)... press Enter',
      removeTag: (tag: string) => `Remove tag ${tag}`,
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
    back: 'Profile',
    annualGoal: 'Annual Goal',
    kmRemaining: (km: number) => `${km} km remaining`,
    goalReached: 'Goal reached!',
    raceTargets: 'Race Targets',
    noTarget: 'No target',
    targetDone: (ahead: string) => `✓ Done (${ahead} ahead)`,
    targetToGo: (time: string) => `${time} to go`,
    seasonRaces: 'Season Races',
    raceAlt: (distance: string) => `${distance} race`,
    emptyPbs: (year: number) => `No PBs for ${year} yet - add them in Settings.`,
    noPhoto: 'No photo',
    upcomingRaces: 'Upcoming Races',
    daysUntil: (n: number) => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n}d`,
    pastRace: 'Past',
    registrationLink: 'Registration',
    projection: {
      status: {
        ahead: 'Ahead',
        on_track: 'On track',
        behind: 'Behind',
      },
      rate: (current: number, needed: number) => `${current} km/wk pace · ${needed} km/wk needed`,
    },
    monthlyGoal: {
      title: 'Monthly Goals',
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
      },
      activitiesTitle: 'Tracked Activities',
      empty: 'No activities recorded with this pair yet.',
    },
  },

  profile: {
    hero: {
      since: (date: string) => `Athlete since ${date}`,
      summary: (activities: number, km: number) => `${activities} activities · ${km} km`,
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
      viewShoes: 'View Shoes',
    },
    hrZones: {
      title: 'Heart rate zones',
      lthr: 'LTHR',
      recalculate: 'Recalculate from LTHR',
    },
    goal: {
      title: (year: number) => `Goal ${year}`,
      pace: (km: number) => `At this pace: ${km} km by year-end`,
      viewGoals: 'View Goals',
    },
  },

  records: {
    title: 'Top Times',
    all: 'All',
    longest: 'Longest Run',
    mostRecent: 'Most recent',
    footnote: '★ official race time · others auto-detected from activity data',
    notYetRun: 'Not yet run',
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
  },

  trainingZones: {
    title: 'Training Zones',
    thresholdLabel: (pace: string) => `Threshold ${pace}`,
    perKm: '/km',
  },

  consistencyScore: {
    title: 'Consistency',
    weeks: 'weeks',
    gradeExplain: 'Ranks your last 12 weeks by weeks active (60%) and weekly volume stability (40%).',
  },

  calendar: {
    today: 'Today',
    prevPeriod: 'Previous',
    nextPeriod: 'Next',
    summary: (sessions: number, km: number) =>
      `${sessions} session${sessions !== 1 ? 's' : ''} · ${km} km`,
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    readiness: (tsb: number) => `Form ${tsb >= 0 ? '+' : ''}${tsb}`,
    switcher: { week: 'Week', month: 'Month' },
    weekOf: (label: string) => `Week of ${label}`,
    restDay: 'Rest day',
    planned: 'Planned',
    nextWeek: (n: number) => `Next week - ${n} planned`,
    viewDetail: 'View detail',
    type: 'Type',
    legend: {
      toggleLabel: 'Status legend',
      completed: 'Completed',
      missed: 'Missed',
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
