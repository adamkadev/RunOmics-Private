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
    notEnoughRuns: 'Not enough runs in this window',
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

  // One definition per term, behind an (i) wherever the term is shown.
  // One set of zone names for every screen (G16): Intensity said "Warm Up"
  // and "Maximum" where Athlete & zones said "Recovery" and "Max".
  zoneLabels: {
    1: 'Recovery',
    2: 'Easy',
    3: 'Aerobic',
    4: 'Threshold',
    5: 'Max',
  } as Record<number, string>,

  vo2Grade: {
    title: 'VO₂ max grade',
    band: (sex: 'male' | 'female', bracket: string) => `${sex === 'male' ? 'Men' : 'Women'} ${bracket.replace('-', '–')}`,
    source: 'ACSM percentiles',
    unit: 'ml/kg/min',
    topForAge: (n: number) => `Top ${n}% for your age`,
    topForAgeInline: (n: number) => `top ${n}% for your age`,
    in30d: 'in 30 days',
    toNext: (gap: string, grade: string) => `${gap} to ${grade}.`,
    // v4.17: under the bar, "0.4 to A+", the gap in ink.
    toGrade: (grade: string) => `to ${grade}`,
    ladder: 'Every grade for your age',
    eta: (weeks: number) => `About ${weeks} week${weeks === 1 ? '' : 's'} at your current trend.`,
    newGrade: 'New grade',
    // A grade held until recently, lost in a dip and back: not new (Oct 2026).
    regainedGrade: 'Grade regained',
    upFrom: (grade: string) => `up from ${grade}`,
    downFrom: (grade: string, daysOff: number | null) => (daysOff ? `From ${grade} after ${daysOff} days off` : `From ${grade}`),
    dropNote: 'Usually returns within 2–3 weeks of normal training.',
    calibrating: 'Calibrating',
    gradeIn: (n: number) => `Grade in ${n} more run${n === 1 ? '' : 's'}`,
    gradeAfter: 'Grade after 4 weeks of runs with heart rate',
    open: 'VO₂max grade details',
    back: 'Athlete & zones',
    range: (min: string, max: string) => `${min} – ${max}`,
    andAbove: (min: string) => `${min} and above`,
    below: (max: string) => `Below ${max}`,
    you: (value: string) => `you, ${value}`,
    topPct: (n: number) => `Top ${n}%`,
    season: 'This season',
    coach: 'Coach',
    coachNext: (grade: string) => `Your fastest route to ${grade} is one VO₂ interval session a week plus your current easy volume.`,
    coachTop: 'Hold it with one VO₂ interval session a week and your current easy volume.',
    todayUp: (grade: string) => `VO₂max grade up to ${grade}`,
    todayBack: (grade: string) => `VO₂max grade back to ${grade}`,
    dismiss: 'Dismiss',
    todayFrom: (grade: string) => `↑ from ${grade}`,
    todayRest: (value: string, top: number) => ` · ${value} · top ${top}%`,
    shareBadge: 'VO₂max grade badge',
    badge: (grade: string) => `VO₂max ${grade}`,
  },
  glossary: {
    about: (term: string) => `What is ${term}?`,
    aboutThese: 'What these numbers mean',
    form: {
      term: 'Form',
      definition: (tired: number, fresh: number, veryFresh: number) =>
        `Form (TSB) is Fitness minus Fatigue. Below ${tired} you are tired, up to +${fresh} neutral, above that fresh, and above +${veryFresh} very fresh.`,
    },
    fitness: { term: 'Fitness', definition: 'Fitness (CTL) is your 42-day average training load: the work your body has absorbed.' },
    fatigue: { term: 'Fatigue', definition: 'Fatigue (ATL) is your 7-day average training load: what the last week has cost you.' },
    vma: { term: 'VMA', definition: 'Maximal aerobic speed: the speed you reach at VO₂max, held for about six minutes.' },
    vo2Grade: { term: 'Men / Women and age', definition: 'Your VO₂max against people of your sex and age decade, from Garmin’s age and sex norms (ACSM / Cooper Institute percentiles). A+ is the top 5%, C below the 45th percentile. The grade changes only once your VO₂max has stayed past the edge for 7 days.' },
    vo2max: { term: 'VO₂max', definition: 'The most oxygen your body can use per kilo each minute, as Garmin estimates it from your runs.' },
    lthr: { term: 'Threshold HR', definition: 'Lactate-threshold heart rate (LTHR): about the heart rate you could hold for an hour-long race.' },
    thresholdPace: { term: 'Threshold pace', definition: 'The pace at your lactate threshold: about what you could race for an hour.' },
    rpe: { term: 'RPE', definition: 'Rate of perceived exertion, 1 to 10, as logged on the watch after the run.' },
    aerobicEffect: { term: 'Aerobic effect', definition: 'Garmin’s 0–5 score of how much the run built your aerobic fitness.' },
    anaerobicEffect: { term: 'Anaerobic effect', definition: 'Garmin’s 0–5 score of how much the run built your capacity for short, hard efforts.' },
    strideLength: { term: 'Stride length', definition: 'How far you travel with each step, averaged over the run.' },
    groundContact: { term: 'Ground contact', definition: 'How long each foot stays on the ground per step. Shorter usually means a springier stride.' },
    verticalOscillation: { term: 'Vertical oscillation', definition: 'How far your body rises and falls with each step: the bounce.' },
    verticalRatio: { term: 'Vertical ratio', definition: 'Bounce as a share of stride length. Lower means less effort spent going up for each metre forward.' },
    decoupling: { term: 'Decoupling', definition: 'How much heart rate drifted against pace from the first half to the second. Under 5% is a steady run.' },
  },

  // Every pace axis runs the same way (lib/chartAxis paceAxis).
  // The rolling year as month rows (/consistency).
  consistency: {
    // v4.17: three stats, the year as week columns, then active days per month.
    activeDays: 'Active days',
    ofDays: (days: number, since: string) => `of ${days} days since ${since}`,
    share: 'Share of days',
    vsPrior: (delta: string) => `${delta} pts vs prior 12 months`,
    // A history that starts inside the year before is compared over what it covers.
    vsMonths: (delta: string, months: number) => `${delta} pts vs prior ${months} month${months === 1 ? '' : 's'}`,
    streak: 'Current streak',
    weeks: (weeks: number): string => (weeks === 1 ? 'week' : 'weeks'),
    best: (weeks: number) => `Best: ${weeks} week${weeks === 1 ? '' : 's'}`,
    calendarTitle: 'Every day, last 12 months',
    colourKey: 'colour = distance',
    levels: { rest: 'Rest', long: 'Long run (15 km +)' },
    today: 'Today',
    toCome: 'to come',
    perMonth: 'Active days per month',
    monthSummary: (month: string, active: number) => `${month}: ${active} active day${active === 1 ? '' : 's'}`,
    monthSoFar: (month: string, active: number) => `${month}: ${active} active day${active === 1 ? '' : 's'} so far`,
    monthLegend: { strong: (days: number) => `${days}+ days`, fewer: 'Fewer', soFar: 'So far' },
    restDay: (date: string) => `${date} · Rest day`,
    empty: 'No runs in the last 12 months yet.',
  },

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
    kmPlanned: (km: string) => `${km} km planned`,
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
    // The compass letter for west on a coordinate: east, north and south share their letter in French.
    west: 'W',
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

  // The private site's way in (RUNOMICS_PRIVATE, src/proxy.ts).
  signIn: {
    title: 'Sign in',
    heading: 'This RunOmics is private',
    lead: 'Sign in with your Google account to open it.',
    opening: 'Opening...',
    notInvited: (email: string | null) =>
      email ? `The account ${email} isn't invited to this RunOmics.` : "This account isn't invited to this RunOmics.",
    otherAccount: 'Use another account',
    unavailable: "Sign-in isn't set up on this deployment yet.",
    retry: 'Retry',
  },

  pages: {
    dashboard: {
      title: 'Today',
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
      title: 'Heatmap',
      back: 'Activities',
      // Only runs with a GPS track are on the map (v5.6 #5): 294 of 298.
      runs: (n: number) => `${n} run${n === 1 ? '' : 's'} with GPS`,
      area: 'Area',
      areas: 'Areas',
      areasSummary: (areas: number, runs: number) =>
        `${areas} area${areas === 1 ? '' : 's'} · ${runs} run${runs === 1 ? '' : 's'}`,
      moreAreas: (n: number) => `${n} more area${n === 1 ? '' : 's'}`,
      including: (name: string) => `incl. ${name}`,
      shareNote: '% = share of km, the same basis the card uses.',
      allYears: 'All years',
      allTypes: 'All types',
      clearFilter: (label: string) => `Clear ${label}`,
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      less: 'Rare',
      more: 'Frequent',
      noRoutes: 'No routes for this filter',
      mapUnavailable: 'Map unavailable - no map token configured',
      attribution: '© MapTiler · © OpenStreetMap contributors',
      territory: {
        // The place is the eyebrow's (v4.17); the ring is the map's.
        headline: (percent: number, reach: string, home: boolean) => ({
          lead: `${percent}% of your running is here. Half your runs stay inside the `,
          accent: `${reach} ring`,
          tail: home ? ' around home.' : ' around where they start.',
        }),
        homeArea: 'Home area',
        runsStat: 'Runs',
        kmStat: 'Distance',
        reachStat: 'Median reach',
      },
    },
    shoes: {
      title: 'Shoes',
      subtitle: 'Mileage and wear per pair',
      back: 'Progress',
    },
    athlete: {
      title: 'Athlete & zones',
      back: 'Progress',
      fromGarmin: 'From Garmin',
      syncedAgo: (when: string) => `From Garmin · synced ${when}`,
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
      back: 'Progress',
    },
    consistency: {
      title: 'Consistency',
      rolling: 'Rolling 12 months',
      window: (range: string) => `${range} · rolling 12 months`,
      back: 'Progress',
    },
  },

  settings: {
    about: (version: string, commit: string) => `RunOmics ${version} · ${commit}`,
    buildCopied: 'Build info copied',
    sections: {
      profile: 'Profile',
      appearance: 'Appearance',
      data: 'Data',
      account: 'Account',
      notifications: 'Notifications',
    },
    sync: {
      title: 'Garmin sync',
      subtitle: 'Pull in today’s runs without waiting for tonight.',
      action: 'Sync now',
      // The button while the chain runs; the device line says which step.
      running: 'Syncing…',
      starting: 'Starting the workflow…',
      fetching: 'Fetching from Garmin, then rebuilding the app…',
      writing: 'New data is live. Writing the verdict…',
      upToDate: 'Already up to date — no new run to fetch.',
      stillRunning: 'Still running. The verdict will appear on its own.',
      failed: 'Could not start the sync.',
      // The server's limits on manual syncs (design review, Oct 2026).
      cooldown: (min: number) => `Up to date — next sync in ${min} min.`,
      dailyCap: 'Daily sync limit reached. Auto-sync continues tonight.',
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
      themeHint: 'Auto follows your system setting',
      light: 'Light',
      auto: 'Auto',
      dark: 'Dark',
    },
    accent: {
      title: 'Accent',
      hint: 'Used for highlights and your own data — never for warnings',
      options: {
        teal:     { label: 'Teal' },
        periwinkle: { label: 'Periwinkle' },
        violet:     { label: 'Violet' },
        pink:     { label: 'Pink' },
        mono:     { label: 'Mono' },
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
      signInToManage: 'Sign in to manage',
    },
    athlete: {
      age: 'Age',
      thresholdPace: 'Threshold pace',
      thresholdHr: 'Threshold HR',
      details: 'Heart & body',
      vma: 'VMA',
      maxHr: 'Max HR',
      // Garmin's setting the zones and the load are computed from, not a
      // reading of today (Analytics > Recovery has that, "Daily resting HR").
      restingHr: 'Resting HR (zones)',
      vo2max: 'VO₂max',
      weight: 'Weight',
      height: 'Height',
      fitnessAge: 'Fitness age',
      // Fitness age against the real age: "20 actual 29" (C2, v4.4; v4.17).
      ofAge: (age: number) => `actual ${age}`,
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
      readOnly: 'Runs are read-only here',
      readOnlySynced: (when: string, runs: string) => `last synced ${when} · ${runs} · read-only here`,
      lastSync: 'Last synced',
      since: (monthYear: string) => `paired ${monthYear}`,
      // v4.17: the device row - "● Connected · last synced 2h ago · 299 runs · Garmin Connect since Aug 2025".
      connectedNow: 'Connected',
      lastSyncedAgo: (when: string) => `last synced ${when}`,
      sourceSince: (source: string, monthYear: string) => `${source} since ${monthYear}`,
    },
    dataExport: {
      workbook: 'Export training data (.xlsx)',
      title: 'Export activities',
      signedOut: (runs: string) => `Workbook of all ${runs} · sign in to export`,
      exporting: 'Exporting...',
      failed: 'Could not export the training data.',
    },
    profile: {
      // Under the read-only height, weight and BMI (design review, Oct 2026).
      readOnly: 'From Garmin Connect - change them there.',
    },
    offlineCache: {
      clear: 'Clear offline cache',
      cost: 'Pages and maps reload from the network until you visit them again.',
      confirm: 'Clear it?',
      cleared: 'Offline cache cleared.',
      failed: 'Could not clear the offline cache.',
    },
    notifications: {
      title: 'Notifications',
      error: 'Could not update notification settings, please retry.',
      types: {
        training: {
          title: 'Training reminders',
          subtitle: 'Daily session at 10:00, plus a weekly check-in on your distance goal.',
        },
        shoes: {
          title: 'Shoe wear alerts',
          subtitle: 'Warns at 70% and 90% of a shoe’s lifespan.',
        },
        // The title says what the toggle does (v5.6 #6): the PR alert.
        races: {
          title: 'PRs and predictions',
          subtitle: 'When a run sets a PR or moves a race prediction.',
        },
      },
    },
  },

  dashboard: {
    recentActivities: {
      title: 'Recent',
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
      deltaIn: (delta: string, days: number) => `${delta} in ${days} days`,
      // Which way Form moved, before by how much (v4.17.1): "recovering, +7 in 7 days".
      formTrend: { up: 'recovering', down: 'absorbing load', flat: 'steady' },
      // Before the delta: "recovering," then "+7 in 7 days".
      formMoveLead: (trend: string) => `${trend},`,
      formOnScale: (form: string, band: string) => `Form ${form}: ${band}`,
      // The card opens its metrics' owner, Analytics › Load (design review, Oct 2026).
      open: 'Open Load in Analytics',
    },
    trainingStatusDays: {
      title: 'Training Status',
      titleToday: (title: string) => `${title} · today`,
    },
    syncStatus: {
      tapToSync: 'tap to sync',
      syncing: 'Syncing…',
      failed: 'Sync failed · tap to retry',
      // The header's sync line, which is the sync control (design review, Oct 2026).
      nextIn: (min: number) => `Up to date · next sync in ${min} min`,
      dailyCap: 'Daily sync limit reached',
      upToDate: 'Up to date',
      stillRunning: 'Still syncing…',
      synced: (relative: string) => `Synced ${relative}`,
      justNow: 'just now',
      minutesAgo: (m: number) => `${m}m ago`,
      hoursAgo: (h: number) => `${h}h ago`,
      daysAgo: (d: number) => `${d}d ago`,
    },
    todayHero: {
      // The session tile under the verdict (design review, Oct 2026): today's
      // before it is run, then the next one.
      tileToday: (date: string | null) => (date ? `Today · ${date}` : 'Today'),
      tileNext: (date: string) => `Next · ${date}`,
      // The last-run row above it.
      doneTitle: (title: string) => `${title} · Done`,
      missedTitle: (weekday: string, title: string) => `${weekday} · ${title}`,
      notRun: (km: string | null) => (km ? `Not run · ${km} km planned` : 'Not run'),
      eyebrowByTone: {
        go: 'Green light',
        build: 'Building',
        caution: 'Caution',
        hold: 'Hold back',
      },
      // The coach card without a written verdict (v4.17.1): what to do with
      // today, then why and what it gives - never a figure the Form /
      // Fitness / Fatigue row under it already prints.
      verdict: {
        headline: {
          rest: { go: 'Rest day. Enjoy it.', build: 'Rest day, right on plan.', caution: "Make today's rest count.", hold: "Take full advantage of today's rest." },
          easy: { go: 'Fresh legs. Keep easy days easy.', build: 'On track. Keep easy days easy.', caution: 'Steady day. Keep it easy.', hold: 'Keep today truly easy.' },
          quality: { go: "You're fresh. Good day for quality.", build: 'On track. Run it as planned.', caution: 'Run it, but keep it controlled.', hold: 'Go easier than planned today.' },
          race: { go: "Race day. You're fresh for it.", build: "Race day. You're ready for it.", caution: 'Race day. Start controlled.', hold: 'Race day. Start controlled.' },
          done: { go: 'Session done. Nicely timed.', build: 'Session done, as planned.', caution: 'Session done. Recover well.', hold: 'Session done. Now let it sink in.' },
        },
        why: {
          go: 'Fatigue has come down.',
          build: 'Your training load is in range.',
          caution: 'Fatigue is starting to build up.',
          hold: 'Fatigue has run ahead of fitness.',
        },
        whyDone: {
          go: '',
          build: '',
          caution: '',
          hold: 'You ran it on tired legs.',
        },
        yesterdayInLegs: (kind: string) => `Yesterday's ${kind} is still in your legs.`,
        tomorrow: 'tomorrow',
        // A session in a sentence: "Tuesday's threshold session".
        kind: {
          easy: 'easy run',
          recovery: 'recovery run',
          long_run: 'long run',
          tempo: 'tempo run',
          threshold: 'threshold session',
          vo2max: 'VO₂ max session',
          anaerobic: 'anaerobic session',
          sprint: 'sprint session',
          race: 'race',
        },
        gain: {
          restPaysOff: (when: string, kind: string) => `Rest today pays off in ${when}'s ${kind}.`,
          restFresh: (when: string, kind: string) => `It keeps you fresh for ${when}'s ${kind}.`,
          restSinksIn: 'A day off is when the work turns into fitness.',
          easyHold: 'Easy running helps you recover without adding load.',
          easyLands: (when: string, kind: string) => `Keep it easy so ${when}'s ${kind} lands.`,
          easySave: (when: string, kind: string) => `Save the freshness for ${when}'s ${kind}.`,
          easySettle: 'Keeping it easy lets the load settle.',
          easyGo: 'Easy days are what make the hard ones count.',
          quality: {
            go: 'Hit the planned paces: this is when the work counts most.',
            build: 'Hit the planned paces, and no faster.',
            caution: 'Hold the planned paces and skip any extra reps.',
            hold: 'Cut the reps or swap it for an easy run: quality on tired legs rarely pays.',
          },
          race: {
            go: 'This is what the training was for.',
            build: 'This is what the training was for.',
            caution: 'Start slower than you want and build into it.',
            hold: 'Start slower than you want and build into it.',
          },
          done: {
            go: 'You ran it fresh, when the work counts most.',
            build: 'Sessions like this are how the work adds up.',
            caution: 'An easy day next lets it land.',
            hold: 'Sleep and an easy day next are what turn it into fitness.',
          },
        },
      },
      restDay: 'Rest day',
      restDaySubtitle: 'No session scheduled',
      // The next session on the plan, under today's rest day (v4.17).
      next: (weekday: string, title: string, km: string | null) => `Next: ${weekday} · ${title}${km ? ` · ${km} km` : ''}`,
      openPlan: 'Open plan',
      race: 'Race',
    },
    weeklyStreak: {
      title: 'This week',
      weeksInARow: (weeks: number) => `${weeks} week streak`,
      ofKm: (target: string) => `of ${target} km`,
      runsOf: (done: number, planned: number) => `${done} of ${planned} run${planned !== 1 ? 's' : ''}`,
      // The session under each day of the week strip, by the coach's type,
      // and its short label for a phone under 480 pt, where "Threshold" and
      // "Long run" were cut (v4.17.3).
      kinds: {
        easy: { label: 'Easy', shortLabel: 'Easy' },
        easyStrides: { label: 'Easy + strides', shortLabel: 'Easy' },
        recovery: { label: 'Recovery', shortLabel: 'Easy' },
        long_run: { label: 'Long run', shortLabel: 'Long' },
        tempo: { label: 'Tempo', shortLabel: 'Tempo' },
        threshold: { label: 'Threshold', shortLabel: 'Thr' },
        vo2max: { label: 'VO₂ max', shortLabel: 'Int' },
        anaerobic: { label: 'Anaerobic', shortLabel: 'Int' },
        sprint: { label: 'Sprint', shortLabel: 'Int' },
        race: { label: 'Race', shortLabel: 'Race' },
        rest: { label: 'Rest', shortLabel: 'Rest' },
      },
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
    // Which load model a card reads, named in its head: the watch's
    // acute/chronic load, or the app's own stress (Fitness / Fatigue).
    model: { garmin: 'Garmin', runomics: 'RunOmics' },
    title: 'Analytics',

    aboutChart: 'What this chart measures',
    season: (year: number) => `${year} season`,
    allTimeChip: 'All',
    // Named for what each tab holds, whole words: "Perf." was cut short by
    // hand, and "Health" held the zone distribution.
    tabs: {
      fitness: 'Load',
      performance: 'Performance',
      volume: 'Volume',
      health: 'Intensity',
    },
    // v4.5: one question per tab, one answer per card (D1-D4).
    cards: {
      period: {
        label: 'Period',
        short: { '4w': '4 wk', '12w': '12 wk', '1y': '1 yr' } as Record<string, string>,
        words: { '4w': '4 weeks', '12w': '12 weeks', '1y': 'a year' } as Record<string, string>,
        weeks: (n: number) => `${n} week${n === 1 ? '' : 's'}`,
        hours: (h: string) => `${h} h`,
      },
      about: 'About this card',
      close: 'Close',
      today: 'Today',
      thisWeek: 'This week',
      scrubWeek: (date: string) => `Week of ${date}`,
      coachRead: {
        // Each tab reads its own period and says which (design review, Oct
        // 2026): one 12-week read over every tab put "Load is up, keep
        // building" over race predictions that had all slipped.
        eyebrow: (span: string, tab: string) => `Coach read · ${span} · ${tab}`,
        why: 'Why →',
        // Only a way to the plan: it is generated by the coach, never edited here.
        openPlan: 'Open plan →',
        openPlanButton: 'Open plan',
        last: { '4w': 'the last 4 weeks', '12w': 'the last 12 weeks', '1y': 'the last year' } as Record<string, string>,
        ago: { '4w': '4 weeks ago', '12w': '12 weeks ago', '1y': 'a year ago' } as Record<string, string>,
        within: { '4w': 'in 4 weeks', '12w': 'in 12 weeks', '1y': 'in a year' } as Record<string, string>,
        headline: {
          positive: 'Your load is turning into speed.',
          positiveSteadyLoad: (last: string) => `Speed has improved over ${last}.`,
          // Names only the reads that slipped (v4.16.4).
          cautionLoadUp: (slipped: string, plural: boolean) => `Load is up, but ${slipped} ${plural ? 'have' : 'has'} slipped.`,
          caution: (last: string) => `Speed has slipped over ${last}.`,
          neutral: (last: string) => `Speed is holding steady over ${last}.`,
          mixed: (improved: string, improvedPlural: boolean, slipped: string, slippedPlural: boolean) =>
            `${improved} ${improvedPlural ? 'have' : 'has'} improved, but ${slipped} ${slippedPlural ? 'have' : 'has'} slipped.`,
        },
        // How a headline names each speed read, and whether it takes "have".
        names: {
          threshold: { word: 'threshold', plural: false },
          easy: { word: 'easy pace', plural: false },
          predictions: { word: 'race predictions', plural: true },
          efficiency: { word: 'aerobic efficiency', plural: false },
        },
        load: {
          spikeAndDip: 'Load spiked and recovery is dipping. Take 2 easy days.',
          spike: (pct: number, span: string) => `Load jumped ${pct}% in ${span}. Ease off before it catches up.`,
          spikeAbove: 'Load is above your safe range. Ease off before it catches up.',
          dip: 'Recovery is dipping. Keep this week easy.',
          building: (pct: number, span: string) => `Load is up ${pct}% in ${span} and recovery is holding. Keep building.`,
          buildingLoad: (pct: number, span: string) => `Load is up ${pct}% in ${span}. Keep building.`,
        },
        fitness: (value: number, delta: string, within: string) => `Fitness ${value}, ${delta} ${within}.`,
        fatigue: (value: number, delta: string, within: string) => `Fatigue ${value}, ${delta} ${within}.`,
        thresholdFaster: (pace: string, s: number, ago: string) => `Threshold ${pace} /km, ${s} s faster than ${ago}.`,
        thresholdSlower: (pace: string, s: number, ago: string) => `Threshold ${pace} /km, ${s} s slower than ${ago}.`,
        thresholdLevel: (pace: string, ago: string) => `Threshold ${pace} /km, level with ${ago}.`,
        easyFaster: (pace: string, s: number, ago: string) => `Easy pace averaged ${pace} /km, ${s} s faster than ${ago}.`,
        easySlower: (pace: string, s: number, ago: string) => `Easy pace averaged ${pace} /km, ${s} s slower than ${ago}.`,
        easyLevel: (pace: string, ago: string) => `Easy pace averaged ${pace} /km, level with ${ago}.`,
        predictionsSlower: (n: number, of: number, ago: string) => `${n} of ${of} race predictions slower than ${ago}.`,
        predictionsFaster: (n: number, of: number, ago: string) => `${n} of ${of} race predictions faster than ${ago}.`,
        predictionsHeld: (last: string) => `Race predictions held over ${last}.`,
        // The unit and what it means, not a bare "1.15" (v4.16.4).
        efficiencyUp: (value: string, delta: string, within: string) => `Aerobic efficiency ${value} m per heartbeat, ${delta} ${within}: more ground for each beat.`,
        efficiencyDown: (value: string, delta: string, within: string) => `Aerobic efficiency ${value} m per heartbeat, ${delta} ${within}: less ground for each beat.`,
        efficiencyLevel: (value: string, ago: string) => `Aerobic efficiency ${value} m per heartbeat, level with ${ago}.`,
        volume: (delta: string) => `${delta} km vs this date last year.`,
        volumeSince: (delta: string, since: string) => `${delta} km vs last year over the same dates, from ${since}.`,
        // The Volume tab's read: the long run first, then the plan, then the average.
        volumeTab: {
          longRunOver: (n: number, of: number) => `Your long run was over 35% of its week in ${n} of ${of} weeks.`,
          underPlan: (hit: number, of: number) => `On plan in only ${hit} of ${of} weeks.`,
          onPlan: (hit: number, of: number) => `On plan in ${hit} of ${of} weeks.`,
          average: (km: string) => `Averaging ${km} km a week.`,
          avgRow: (km: string, n: number) => `${km} km a week on average over ${n} finished week${n === 1 ? '' : 's'}.`,
          onPlanRow: (hit: number, of: number) => `${hit} of ${of} planned weeks at 90% of the plan or more.`,
          longRunRow: (n: number) => (n === 0 ? 'No week with a long run over 35% of it.' : `${n} week${n === 1 ? '' : 's'} with a long run over 35% of it.`),
        },
        // The Intensity tab's read: the easy / moderate / hard verdict Analytics and Athlete share.
        intensityTab: {
          inRange: (easy: number) => `Intensity is in range: ${easy}% of the time easy.`,
          tooModerate: (pct: number) => `Too much time in the moderate middle: ${pct}% in Z3.`,
          tooHard: (easy: number) => `Too much hard running: ${easy}% of the time easy.`,
          splitRow: (easy: number, moderate: number, hard: number) => `${easy}% easy (Z1–Z2), ${moderate}% moderate (Z3), ${hard}% hard (Z4–Z5).`,
          hardRow: (range: string) => `Hard time ${range} min a week.`,
          qualityRow: (avg: string) => `${avg} quality sessions a week on average.`,
          qualityPlanRow: (avg: string, asks: string) => `${avg} quality sessions a week, against ${asks} on the plan.`,
        },
      },
      form: {
        title: 'Form',
        caption: 'fitness − fatigue',
        about: 'Form is fitness minus fatigue. Fitness is the 42-day average of your training load, fatigue the 7-day one. Below −10 you are carrying fatigue; above +5 you are fresh.',
        range: {
          tired: 'below −10',
          neutral: '−10 to +5',
          fresh: '+5 to +25',
          veryFresh: 'above +25',
        } as Record<string, string>,
        fitness: 'Fitness',
        fatigue: 'Fatigue',
        inPeriod: (delta: string, period: string) => `${delta} in ${period}`,
        legend: { fresh: 'Fresh', neutral: 'Neutral', tired: 'Tired' },
      },
      loadTrend: {
        title: 'Load trend',
        caption: '7-day acute load',
        about: 'Your acute load: the last 7 days of Garmin training load, day by day (weekly averages on a year). The band is your safe range, 0.8–1.3 × your chronic 28-day load; days outside it are marked. The Load ratio under Injury risk is the last point divided by its chronic load.',
        safe: (lo: number, hi: number) => `safe range ${lo}–${hi}`,
        span: (days: number) => (days < 14 ? (days === 1 ? '1 day' : `${days} days`) : Math.round(days / 7) === 1 ? '1 week' : `${Math.round(days / 7)} weeks`),
        upIn: (pct: number, span: string) => ['Load up ', `${pct}% in ${span}`, ', still inside your safe range.'] as [string, string, string],
        downIn: (pct: number, span: string) => ['Load down ', `${pct}% in ${span}`, ', still inside your safe range.'] as [string, string, string],
        inRange: ['Load is ', 'inside your safe range', '.'] as [string, string, string],
        steady: ['Load ', 'steady', ', inside your safe range.'] as [string, string, string],
        jumped: (pct: number, span: string) => ['Load jumped ', `${pct}% in ${span}`, ', above your safe range. Ease off for 3–4 days.'] as [string, string, string],
        above: ['Load is ', 'above your safe range', '. Ease off for 3–4 days.'] as [string, string, string],
        below: ['Load is ', 'below your safe range', '. Fitness will start to slip.'] as [string, string, string],
        wentOver: (days: number, last: string) => (days === 1 ? ` One day went over, on ${last}.` : ` ${days} days went over, the last on ${last}.`),
        legend: { acute: 'Acute load', safe: 'Safe range', outside: 'Outside range' },
        readout: (date: string, acute: number, lo: number, hi: number) => `${date} · ${acute} · safe ${lo}–${hi}`,
      },
      recovery: {
        title: 'Recovery',
        caption: 'Garmin · overnight',
        // One series, named in the caption.
        captionDaily: 'Resting HR · Garmin',
        captionHrv: 'HRV · Garmin',
        about: 'Overnight HRV and resting heart rate from your watch, each against your own baseline: the middle 80% of your last 60 nights. Higher HRV and lower resting HR mean you are recovering. Each shows once the period has 7 days of it. Without the watch on overnight there is no HRV, and resting HR comes from your quietest stretch of the day, so it reads a little higher.',
        hrv: 'HRV',
        restingHr: 'Daily resting HR',
        ms: 'ms',
        bpm: 'bpm',
        vsWeek: (delta: string) => `${delta} vs 7-day avg`,
        noChange: 'no change',
        baseline: (lo: number, hi: number) => `baseline ${lo}–${hi}`,
        bothInside: ['Both ', 'inside your baseline', ". You're absorbing the load."] as [string, string, string],
        insideBaseline: (lo: number, hi: number, unit: string) => ['Inside your ', `${lo}–${hi} ${unit} baseline`, ". You're absorbing the load."] as [string, string, string],
        hrvLead: 'HRV ',
        hrvLow: (n: number) => (n <= 1 ? 'below baseline last night' : `below baseline ${n} nights running`),
        hrvHigh: 'above baseline',
        rhrLead: 'Resting HR ',
        rhrUpBold: (d: number) => `up ${d} bpm`,
        rhrHighBold: 'above baseline',
        rhrLowBold: 'below baseline',
        andRhrUp: (d: number) => ` and resting HR up ${d} bpm`,
        andRhrHigh: ' and resting HR above baseline',
        andRhrLow: ' and resting HR below baseline',
        takeEasy: '. Take tomorrow easy.',
        readout: (date: string, value: number, unit: string) => `${date} · ${value} ${unit}`,
      },
      status: {
        title: 'Training status',
        caption: (span: string) => `Garmin · ${span}`,
        span: { days28: '28 days', weeks12: '12 weeks', months12: '12 months' },
        spanLive: { days28: 'last 28 days', weeks12: 'last 12 weeks', months12: 'last 12 months' },
        about: "Garmin's training status: how your recent load compares with what your body is used to. Each cell is one day (one week on longer periods).",
        sentenceToday: (count: number, days: number) => ` today, and on ${count} of the last ${days} days.`,
        sentenceOn: (date: string, count: number, days: number) => ` on ${date}, and on ${count} of those ${days} days.`,
        days: (n: number) => `${n} d`,
      },
      risk: {
        title: 'Injury risk',
        about: 'Three load checks linked to injury. Each bar shows the safe range; the marker is where you are now.',
        inRange: (n: number, of: number) => `${n} of ${of} in range`,
        loadRatio: 'Load ratio',
        loadRatioHint: 'acute ÷ chronic',
        loadRatioFormula: (acute: number, chronic: number) => `Acute ${acute} ÷ chronic ${chronic}: the last 7 days against the last 28.`,
        loadRatioFormulaLocal: 'The last 7 days of load against the last 28.',
        monotony: 'Monotony',
        monotonyHint: 'day-to-day sameness',
        monotonyFormula: 'The mean daily load of the last 7 days ÷ its spread. High means every day looks the same.',
        rampRate: 'Ramp rate',
        rampRateHint: 'fitness per week',
        rampRateFormula: 'Fitness today minus fitness 7 days ago.',
        safeBetween: (lo: string, hi: string) => `Safe ${lo} – ${hi}`,
        safeBelow: (hi: string) => `Safe below ${hi}`,
        safeSigned: (lo: string, hi: string) => `Safe ${lo} to ${hi}`,
      },
      summary: {
        vo2max: 'VO₂max',
        threshold: 'Threshold pace',
        easyPace: 'Easy pace',
        in12w: (delta: string) => `${delta} in 12 weeks`,
        noChange12w: 'No change in 12 weeks',
        slower: (s: string) => `${s} slower`,
        faster: (s: string) => `${s} faster`,
        same: 'No change',
        secs: (n: number) => `${n} s`,
      },
      predictions: {
        title: 'Race predictions',
        caption: (period: string) => `change in ${period}`,
        about: "Garmin's predicted race times. The line under each is the period's trend, faster up.",
        count: (n: number): string => (n === 4 ? 'All four' : n === 3 ? 'All three' : n === 2 ? 'Both' : 'It'),
        slipped: (who: string, range: string, period: string) => `${who} slipped ${range} over ${period}.`,
        improved: (who: string, range: string, period: string) => `${who} improved by ${range} over ${period}.`,
        held: (who: string, period: string) => `${who} held over ${period}.`,
        // Some moved, the others held: the held ones are grey on their rows.
        someSlipped: (n: number, of: number, range: string, period: string) => `${n} of ${of} slipped ${range} over ${period}.`,
        someImproved: (n: number, of: number, range: string, period: string) => `${n} of ${of} improved by ${range} over ${period}.`,
        mixed: (faster: number, of: number, period: string) => `${faster} of ${of} got faster over ${period}.`,
        offTarget: (distance: string, gap: string, target: string) => `The ${distance} is ${gap} off your ${target} target.`,
        onTarget: (distance: string, gap: string, target: string) => `The ${distance} is ${gap} inside your ${target} target.`,
        range: (lo: string, hi: string) => (lo === hi ? lo : `${lo}–${hi}`),
        race: (distance: string) => `${distance} race: `,
        inDays: (n: number) => (n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `${n} days`),
      },
      paceTrend: {
        title: 'Pace trend',
        caption: 'weekly average · higher is faster',
        about: 'The weekly average pace of your easy runs and of your workouts (every run that is not easy). Faster is up.',
        easyFaster: (s: string) => ['Easy runs got ', `${s}/km faster`, '.'] as [string, string, string],
        easySlower: (s: string) => ['Easy runs got ', `${s}/km slower`, '.'] as [string, string, string],
        easyHeld: ['Easy pace ', 'held', '.'] as [string, string, string],
        workoutFaster: (s: string) => [' Workout pace got ', `${s}/km faster`, '.'] as [string, string, string],
        workoutSlower: (s: string) => [' Workout pace got ', `${s}/km slower`, '.'] as [string, string, string],
        workoutHeld: [' Workout pace ', 'held', '.'] as [string, string, string],
        easy: 'Easy',
        workout: 'Workout',
      },
      efficiency: {
        title: 'Aerobic efficiency',
        caption: 'metres per heartbeat',
        about: 'How far you run for each heartbeat on easy runs. Heat-adjusted removes the cost of warm days, so what is left is fitness and fatigue.',
        in4w: ' in 4 weeks',
        in12w: ' in 12 weeks',
        dipping: 'Dipping this month.',
        dippingHeat: (heat: string) => ` Heat costs you ${heat}; the rest looks like fatigue, so keep easy days easy.`,
        dippingNoHeat: ' It is not the heat, so keep easy days easy while it comes back.',
        rising: 'Rising this month: you cover more ground for each heartbeat.',
        steady: 'Holding steady this month.',
        adjusted: 'Heat-adjusted',
        measured: 'Measured',
        rpe: 'Perceived effort',
        rpeLine: (avg: string, trend: string) => `RPE avg ${avg}, ${trend} · 4 weeks`,
        rpeTrend: { easing: 'easing', rising: 'rising', steady: 'steady' } as Record<string, string>,
      },
      heatCost: {
        title: 'Heat cost',
        caption: (hr: number) => `pace at ${hr} bpm, vs your best band`,
        about: 'Your easy-run pace at the same heart rate, by the temperature it felt like. Each bar is the seconds per km you lose against your best temperature band.',
        lose: (range: string) => ['Above 20 °C you lose ', `${range} s/km`, ' at the same heart rate.'] as [string, string, string],
        little: 'Heat has cost you little so far: under 5 s/km at the same heart rate.',
        noWarm: 'No easy runs above 20 °C yet to measure what heat costs you.',
        best: 'best',
        noRuns: 'no runs',
        plus: (s: number) => `+${s} s`,
        barKey: 'Longer bar: more s/km lost against your best band.',
      },
      weekly: {
        title: 'Weekly distance',
        caption: 'vs plan',
        about: 'What you ran each week, with what the plan scheduled as a tick. A week counts as on plan at 90% of its planned distance.',
        thisWeek: 'This week',
        weekOf: (date: string) => `Week of ${date}`,
        ofPlan: (km: string) => `/ ${km} km`,
        avgWeeks: (n: number) => `${n}-week average`,
        perWeek: 'km/week',
        onPlan: 'Weeks on plan',
        ofPlanned: (n: number) => `of ${n} planned`,
        withoutPlan: (n: number) => `${n} wk unplanned`,
        onOrAbove: 'On or above plan',
        belowPlan: 'Below plan / unplanned',
        done: 'Done',
        plan: 'Plan',
      },
      ytd: {
        title: 'Year to date',
        caption: 'same dates, both years',
        about: 'Your distance so far this year, against last year on the same dates and the straight line to your goal. When your history starts partway through last year, both years count from that date.',
        vs: (delta: string, year: number) => `${delta} km vs ${year} to date`,
        vsSince: (delta: string, year: number, since: string) => `${delta} km vs ${year}, both from ${since}`,
        goal: (km: string) => `${km} km goal`,
        short: (km: string) => `${km} km short`,
        shortRest: (rate: string, needed: string) => ` at your current ${rate} km/week. The goal needs ${needed}.`,
        onTrack: (km: string, rate: string) => `On track for ${km} km at your current ${rate} km/week.`,
        reached: (km: string) => `Goal reached, ${km} km over.`,
      },
      longRun: {
        title: 'Long run',
        caption: 'share of weekly distance',
        about: "Each week's longest run. One run above 35% of the week's distance puts a lot of the week's load on a single day.",
        rule: 'Keep your long run under 35% of the week. ',
        over: (n: number) => (n === 0 ? 'No week went over.' : n === 1 ? '1 week went over.' : `${n} weeks went over.`),
      },
      easyHard: {
        title: 'Easy vs hard',
        caption: 'target 80 / 20',
        about: 'Time in heart-rate zones over the period: easy (Z1-Z2) against everything harder. Most of it should be easy, with little in the moderate middle.',
        inRange: 'In range',
        tooModerate: 'Too much moderate',
        tooHard: 'Too much hard',
        easy: 'Easy · Z1–Z2',
        moderate: 'Moderate · Z3',
        hard: 'Hard · Z4–Z5',
        part: (h: string, pct: number) => `${h} h · ${pct}%`,
      },
      zones: {
        title: 'Time in zones',
        caption: 'hours per week',
        about: 'Hours in each heart-rate zone, week by week. The current week is lighter until it is done.',
        stayed: (range: string, total: string) => ['Hard time stayed at ', `${range} min a week`, total] as [string, string, string],
        ranged: (range: string, total: string) => ['Hard time ranged ', `${range} min a week`, total] as [string, string, string],
        total: { grew: ' while total time grew.', dropped: ' while total time dropped.', held: ' while total time held.' } as Record<string, string>,
        recovered: (week: string) => `; total time recovered after ${week}.`,
        hours: (h: string) => ` ${h} h in all.`,
      },
      quality: {
        title: 'Quality sessions',
        caption: 'per week',
        about: 'Threshold and interval sessions each week, and the ones the plan had that were not run.',
        avg: 'avg',
        planAsks: (n: string) => ` · plan asks for ${n}`,
        readout: (week: string, done: number, planned: number | null) =>
          planned === null ? `${week} · ${done} done, no plan` : `${week} · ${done} of ${planned} planned done`,
        perWeek: ' a week',
        threshold: 'Threshold',
        intervals: 'Intervals',
        missed: 'Missed',
      },
      zoneRanges: {
        title: 'Zone ranges',
        subtitle: 'Pace and heart rate for each zone',
      },
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
      trend: (months: number) => `predicted · change in ${months} m`,
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
        footnote: 'Each point is one week\'s total, Monday to Sunday. The dashed line is the average of the complete weeks; the dashed end is the week in progress, left out of that average.',
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
        adjustedNeedsTemp: 'Heat-adjusted needs temperature data',
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
          cold: '< 5 °C',
          cool: '5–15 °C',
          mild: '15–20 °C',
          warm: '20–25 °C',
          hot: '25 °C +',
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
        easyTime: (pct: number) => `${pct}% easy time`,
        reading: (pct: number, zoneLabel: string) => `Most time (${pct}%) sits in ${zoneLabel} - your training skews toward this intensity.`,
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
        title: 'Easy time',
        targetLine: '80% easy',
        easy: (pct: number) => `Easy (Z1–Z2): ${pct}%`,
        hard: (pct: number) => `Hard (Z3+): ${pct}%`,
        footnote: 'Share of time in Z1–Z2 vs Z3+. Dashed line = 80/20 target.',
        explains: {
          balanced: (pct: number) => `Good 80/20 balance - ${pct}% easy time this period`,
          tooHard: (pct: number) => `Intensity too high - ${pct}% easy time this period (aim for ~80%)`,
          tooEasy: (pct: number) => `Very conservative - ${pct}% easy time, room to add quality sessions`,
        },
      },
      distance: {
        title: 'Distance Distribution',
        runs: (n: number) => `${n} runs`,
        kmTotal: (km: string) => `${km} km total`,
        reading: (bracket: string, pct: number) => `Most runs (${pct}%) land in the ${bracket} bracket.`,
        footnote: 'Every run of the season, grouped by distance. Colour intensity reflects relative frequency.',
      },
      rpe: {
        noneLogged: 'no RPE logged',
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
        reading: (deltaPct: number, current: string, previous: string, cutoff: string | null) =>
          `${Math.abs(deltaPct)}% ${deltaPct >= 0 ? 'ahead of' : 'behind'} the same date last year: ${current} km against ${previous} km${cutoff ? ` to ${cutoff}` : ''}.`,
      },
      threshold: {
        title: 'Running Lactate Threshold',
        pace: 'Threshold pace',
        lthr: 'Threshold HR',
        footnote: 'The effort you can hold before lactate builds up, as the watch measures it. Garmin revises it every few weeks, so the line steps rather than drifts.',
        reading: {
          change: (delta: string, since: string) => `Threshold pace is ${delta} since ${since}.`,
          flat: (since: string) => `Threshold pace is unchanged since ${since}.`,
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
        reading: (status: string, days: number, windowDays: number, latest: string | null) =>
          `${status} on ${days} of the last ${windowDays} days${latest ? `, reading ${latest} now` : ', and today'}.`,
      },
    },
    yearOverYear: {
      title: 'Year over Year',
      vs: 'vs',
      toDate: (date: string) => `to ${date}`,
      rows: {
        distance: 'Distance',
        sessions: 'Sessions',
        time: 'Time',
        avgPerWeek: 'Per week',
        avgPace: 'Avg pace',
        avgHr: 'Avg HR',
        elevation: 'Elevation',
      },
    },
  },

  activities: {
    // What the search reads: a run's name and notes, its weekday and date.
    searchPlaceholder: 'Search runs, notes, dates…',
    all: 'All',
    count: (n: number) => `${n} activit${n !== 1 ? 'ies' : 'y'}`,
    countWithDistance: (runs: number, km: string) => `${runs} run${runs === 1 ? '' : 's'} · ${km} km`,
    since: (month: string) => `since ${month}`,
    empty: 'No activities found',
    emptyFiltered: 'No sessions of this type',
    resetFilters: 'Reset filters',
    endOfList: 'That\'s all',
    thisWeek: 'This week',
    shoeFilter: { clear: 'Show runs in every shoe' },
    weekLine: {
      ofKm: (target: string) => ` of ${target} km`,
      runs: (n: number): string => (n === 1 ? '1 run' : `${n} runs`),
      runsOf: (done: number, planned: number) => `${done} of ${planned} run${planned !== 1 ? 's' : ''}`,
      easy: (pct: number) => `${pct}% easy`,
    },
    mapButton: 'Map view',
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
      copied: 'Copied',
    },
    shareCard: {
      title: 'Share run',
      close: 'Close',
      distance: 'Distance',
      pace: 'Pace',
      avgHr: 'Avg HR',
      time: 'Time',
      designTitle: 'Design',
      designLabels: {
        route: 'Route',
        stats: 'Stats',
        photo: 'Photo',
      },
      background: 'Background',
      themeLabels: {
        dark: 'Dark',
        light: 'Light',
      },
      timeInZones: 'Time in zones',
      mostly: (zone: number, pct: number) => `mostly Z${zone} · ${pct}%`,
      inZone: (zone: number) => `in Z${zone}`,
      minutes: (n: number) => `${n} min`,
      noZones: 'No heart-rate zones for this run',
      photo: 'Photo',
      photoEmpty: 'Your photo fills this frame',
      choosePhoto: 'Choose photo',
      changePhoto: 'Change photo',
    },
    stats: {
      distance: 'Distance',
      duration: 'Moving time',
      pace: 'Avg pace',
      avgHr: 'Avg heart rate',
    },
    verdict: {
      title: 'Run Verdict',
      headline: {
        positive: (type: string) => `Solid ${type}`,
        neutral: (type: string) => `${type} logged`,
        caution: (type: string) => `Tough ${type}`,
      },
      effortClause: (rpeLabel: string, rpe: number) => `Perceived effort: ${rpeLabel} (RPE ${rpe}).`,
      // The insight's eyebrow, in the verdict's status colour (v4.17).
      eyebrow: {
        positive: 'Strong session',
        neutral: 'Session logged',
        caution: 'Tough session',
      },
    },
    // Read-only: RPE comes from the watch, and the note is the one thing on an
    // activity the user writes.
    effort: {
      label: 'Effort',
      value: (rpe: number, label: string) => `${rpe} · ${label}`,
      notLogged: 'not logged on the watch',
    },
    noteRow: {
      label: 'Note',
      add: 'Add note',
      edit: 'Edit',
      read: 'Read',
      none: 'No note',
    },
    tabs: {
      groupLabel: 'Activity sections',
      overview: 'Overview',
      intervals: 'Splits',
      charts: 'Charts',
      dynamics: 'Dynamics',
    },
    bestEfforts: {
      title: 'Best efforts',
      // The tile's name: the distance with its unit (v4.17).
      distances: {
        '1k': '1 km',
        '5k': '5 km',
        '10k': '10 km',
        half: 'Half marathon',
        marathon: 'Marathon',
      } as Record<string, string>,
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
      held: 'Held — under 5%',
      faded: 'Faded — over 5%',
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
    },
    similarRuns: {
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
      sheetTitle: 'Run notes',
      notePlaceholder: 'How did it feel? Weather, terrain, sensations...',
      tagPlaceholder: 'New tag',
      tagHint: 'Press Enter to add',
      usedBefore: 'Used before',
      removeTag: (tag: string) => `Remove tag ${tag}`,
      addTag: (tag: string) => `Add tag ${tag}`,
    },
    zones: {
      // The basis is in the name: these are heart-rate zones, not pace.
      title: 'Time in HR zones',
      noData: 'No HR zone data',
      short: 'Heart-rate zones',
      shareOfTime: 'share of time',
      mostIn: (zone: number, pct: number) => `most in Z${zone} · ${pct}%`,
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
    conditions: {
      label: 'Conditions',
      wind: (reading: string) => `wind ${reading}`,
    },
    shoe: {
      label: 'Shoe',
      add: 'Add',
      changeInGarmin: (name: string) => `${name} - change in Garmin Connect`,
      addInGarmin: 'Set the shoe in Garmin Connect',
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
      title: 'Running dynamics',
      cadence: 'Cadence',
      strideLength: 'Stride length',
      groundContact: 'Ground contact',
      vertOscillation: 'Vertical oscillation',
      vertRatio: 'Vertical ratio',
      vsBaselineShort: 'vs baseline',
      level: 'Level with baseline',
      ratioUnit: 'pt',
      baselineNote: (weeks: number) => `Shaded band = your baseline, the middle half of your runs over the last ${weeks} weeks.`,
    },
    charts: {
      heartRate: 'Heart rate',
      avg: 'avg',
      max: 'max',
      bestSmoothed: 'best 30 s',
      pace: 'Pace',
      paceUnitHint: '/km · higher is faster',
      elevation: 'Elevation',
      cadence: 'Cadence',
      elevationGain: (m: string) => `+${m} m gain`,
      scrubAt: (km: string, elapsed: string | null) => (elapsed ? `At ${km} km · ${elapsed} elapsed` : `At ${km} km`),
      scrubHint: 'Drag across the charts to scrub — the dot on the map follows',
      lineLabel: 'Chart line',
      smoothed: 'Smoothed',
      raw: 'Raw',
      legend: {
        zones: 'Background = your zones',
        average: 'Run average',
        km: 'Each km',
      },
    },
    map: {
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
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
      continuous: 'continuous run',
      spreadShort: (kind: string, spread: number) => `${kind} · ${spread} s spread`,
      spreadKind: { even: 'Even run', negative: 'Negative split', faded: 'Faded', uneven: 'Uneven' },
      partialKm: (km: string) => `final ${km}`,
      repSetLabel: (reps: number, duration: string) => `${reps} × ${duration}`,
      bandLabel: (range: string) => `band ${range}`,
      recoveryAvg: 'Recovery avg',
      // The set's summary at the top of its card: three numbers, no sentence (H14).
      inBandLabel: 'In band',
      spread: 'Spread',
      hrDrift: 'HR drift',
      cols: {
        km: 'Km',
        step: '#',
        type: 'Type',
        duration: 'Dur',
        dist: 'Dist',
        pace: 'Pace',
        speed: 'Speed',
        vsAvg: 'vs avg',
        hr: 'HR',
        total: 'Total',
      },
      intervalTypes: {
        interval_warmup:   'Warm-up',
        interval_active:   'Interval',
        interval_rest:     'Rest',
        interval_recovery: 'Recovery',
        interval_cooldown: 'Cool-down',
        lap:               'Lap',
      } as Record<string, string>,
    },
    nav: {
      previous: 'Previous run',
      next: 'Next run',
    },
  },

  goals: {
    // The hub row's name, so the row and the screen it opens agree.
    title: 'Goals & season',
    empty: 'No goals configured yet.',
    back: 'Progress',
    // v4.17: the year's card is "Distance goal"; the year tabs say which year.
    distanceGoal: 'Distance goal',
    ofKm: (goal: string) => `of ${goal} km`,
    reached: (over: string) => `Reached · +${over} km`,
    half: 'Half',
    kmRemaining: (km: number) => `${km} km remaining`,
    goalReached: 'Goal reached!',
    upcoming: 'Upcoming races',
    doneHeading: 'Done',
    targetTime: (time: string) => `target ${time}`,
    finish: 'finish',
    noDateSet: 'no date set',
    beatenBy: (gap: string) => `beat by ${gap}`,
    missedBy: (gap: string) => `missed by ${gap}`,
    best: 'Best',
    predictedTag: 'predicted',
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
      needsWeeklyDetail: (needed: string, current: string) => `Needs ${needed} km/wk, running ${current}.`,
      // "Projected 1,757 km · 243 short.": the verdict alone, in its tone.
      verdict: (projected: string, outcome: string | null) => `${projected}${outcome ? ` · ${outcome}` : ''}.`,
      // v4.17: under the bar, then the verdict and what the goal needs.
      today: 'Today',
      projectedMark: (km: string) => `Projected ${km}`,
      shortAtPace: (km: string) => `${km} km short at this pace.`,
      overAtPace: (km: string) => `${km} km over at this pace.`,
      onPace: 'On pace for the goal.',
      needs: (needed: string, current: string) => `The goal needs ${needed} km a week; you’re averaging ${current}.`,
    },
    monthlyVolume: {
      title: 'Monthly volume',
      subtitle: (from: string, to: string) => `${from} – ${to} against the monthly target`,
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
    // C3, v4.4: the season strip and timeline.
    season: {
      title: 'Season',
      today: 'Today',
      todayOn: (date: string) => `TODAY · ${date}`,
      blockWeek: (race: string, week: number, weeks: number) => `${race} block wk ${week} of ${weeks}`,
      // v4.17: a race row - "NOV 29 · IN 62 DAYS", "Target 40:00 · plan week 4 of 12".
      inDays: (days: number) => (days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`),
      done: 'done',
      target: (time: string) => `Target ${time}`,
      planWeek: (week: number, weeks: number) => `plan week ${week} of ${weeks}`,
      predictedOff: (gap: string) => `predicted · ${gap} off`,
      predictedUnder: (gap: string) => `predicted · ${gap} under`,
      underTarget: (gap: string) => `${gap} under target`,
      overTarget: (gap: string) => `${gap} over target`,
      noDate: 'Goals without a date',
      noTarget: 'no target set',
    },
    history: {
      title: 'Past seasons',
      achieved: 'Achieved',
      missed: 'Missed',
      annualKm: (actual: string, target: string) => `${actual} of ${target} km`,
      targetsCount: (achieved: number, total: number) => `${achieved} of ${total} race targets`,
    },
  },

  // C6, v4.4b: Progress > All time.
  allTime: {
    title: 'All time',
    back: 'Progress',
    subtitle: (since: string, months: number) => `Since ${since} · ${months} month${months === 1 ? '' : 's'}`,
    km: 'km',
    runs: 'runs',
    hours: 'hours',
    byYear: 'By year',
    byYearUnits: 'km · runs · h',
    partialYear: (year: number, month: string, months: number, currentMonths: number, currentYear: number) =>
      `${year} started in ${month}: ${months} months vs ${currentMonths} in ${currentYear}.`,
    monthly: 'Monthly km',
    best: (month: string, km: string) => `best ${month} · ${km}`,
    longestRun: 'Longest run',
    biggestWeek: 'Biggest week',
    yearLabel: (year: number, km: string, runs: number, hours: string) => `${year}: ${km} km, ${runs} runs, ${hours} h`,
  },

  shoes: {
    // C4-C5, v4.4b: the list, the detail hero and the type mix.
    tracked: (km: string) => `${km} km tracked`,
    add: 'Add',
    addLabel: 'Add a pair in Garmin Connect',
    edit: 'Edit shoe',
    editLabel: 'Edit limit, role or retire in Garmin Connect',
    inRotation: (n: number) => `In rotation · ${n}`,
    retiredSection: (n: number) => `Retired · ${n}`,
    kmLeftShort: 'km left',
    left: (km: string) => `${km} left`,
    ofLimit: (limit: string) => `of ${limit} km`,
    lastRun: (date: string) => `last ${date}`,
    runs: (n: number) => `${n} run${n === 1 ? '' : 's'}`,
    overLimit: 'Over limit, consider retiring',
    since: (brand: string, month: string) => `${brand} · since ${month}`,
    roles: { daily: 'daily trainer', workouts: 'workouts', intervals: 'intervals', races: 'races' },
    shareOfDistance: 'share of distance',
    easy: 'Easy',
    heroStats: { runs: 'Runs', avgDistance: 'Avg distance', avgPace: 'Avg pace', avgHr: 'Avg heart rate' },
    lastRuns: 'Last runs',
    neverUsed: 'Never used',
    // Both numbers arrive formatted (formatKm), so 1,375 has its separator.
    kmOf: (total: string, max: string) => `${total} / ${max} km`,
    retired: 'Retired',
    rotationSummary: (activePairs: number, retiredPairs: number, km: string) =>
      `${activePairs} in rotation · ${retiredPairs} retired · ${km} km tracked`,
    // The rotation row used to print a bare `Sep 13` next to the mileage, with
    // nothing saying which date it was. Both keys take an already-formatted
    // date because i18n can never import the formatters.
    lastRunSentence: (date: string) => `Last run ${date}.`,
    limitLine: (km: string, limit: string, runs: number) => `${km} km · limit ${limit} km · ${runs} run${runs === 1 ? '' : 's'}`,
    retiredTitle: (name: string) => `Retired · ${name}`,
    status: {
      ok: 'Good',
      watch: 'Replace soon',
      replace: 'Replace',
    },
    kmLeft: (km: string) => `~${km} km left`,
    // No tilde on the detail hero: promoting a number to 34px and then
    // hedging it with "~" undercuts the very thing that made it the hero.
    // The list row keeps the tilde - there, it's one line among several, not
    // the headline.
    kmLeftExact: (km: string) => `${km} km left`,
    // Past the limit, the overrun is the news - "0 km left" hid it.
    pastLimit: (over: string, limit: string) => `${over} km past its ${limit} km limit`,
    kmOver: (over: string) => `${over} km over`,
    retiredLife: (era: string, runs: number, km: string) => `${era} · ${runs} runs · ${km} km`,
    hero: {
      usage: (n: number, total: number) => `Used in ${n} of your last ${total} tempo/threshold runs.`,
    },
    comparison: {
      title: 'Compare two pairs',
      subtitle: 'Pace, HR and session mix side by side',
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
      // A pair's page is under Progress, which lists the pairs (v4.17).
      back: 'Progress',
      retireFromWorkouts: (km: string) => `${km} km · retire from workouts`,
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
      projectedRunOut: (weeklyKm: number, maxKm: string, targetDate: string, weeksRemaining: number) =>
        `At ${weeklyKm} km a week you'll hit ${maxKm} km around ${targetDate} – about ${weeksRemaining} more week${weeksRemaining === 1 ? '' : 's'}.`,
      // A three-year forecast off six runs is noise, not information - past a
      // year out, the sentence drops the date and says only what's true: it's
      // a long way off at this rate.
      projectedRunOutFar: (weeklyKm: number, maxKm: string) =>
        `At ${weeklyKm} km a week, ${maxKm} km is more than a year away.`,
      verdict: {
        eyebrow: (statusLabel: string) => `Verdict · ${statusLabel}`,
        weeksLeft: (weeks: number) =>
          weeks <= 0 ? 'It has reached its limit.' : weeks === 1 ? 'About 1 more week at your pace.' : `About ${weeks} more weeks at your pace.`,
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
        keySessionPair: (percent: number) => `${percent}% of its distance was tempo, threshold or intervals.`,
        easyPair: (percent: number) => `${percent}% of its distance was base running.`,
      },
      retiredHero: {
        // "Ran out" only means something for a pair that actually reached the
        // end of its life - one that was swapped out early gets the honest
        // percentage instead of a life it never finished.
        ranOut: (maxKm: string, weeks: number) => `Ran nearly all of a ${maxKm} km life in ${weeks} weeks.`,
        ranOutFastest: (maxKm: string, weeks: number) =>
          `Ran nearly all of a ${maxKm} km life in ${weeks} weeks – the fastest you've worn a pair through.`,
        retiredEarly: (percent: number, maxKm: string, weeks: number) =>
          `Retired at ${percent}% of a ${maxKm} km life, after ${weeks} weeks.`,
      },
    },
  },

  profile: {
    // The hub: the year so far, then one row per sub-page with its status.
    hub: {
      // v4.17: the header's season line, then the year card, four tiles, shoes and all time.
      season: (year: number) => `Season ${year}`,
      raceIn: (distance: string, days: number) =>
        days <= 0 ? `${distance} today` : days === 1 ? `${distance} tomorrow` : `${distance} in ${days} days`,
      yearTitle: (year: number) => `${year} distance`,
      runs: 'runs',
      records: 'Records',
      recordsWhen: 'all time',
      recordLabels: { '1k': '1 km', '5k': '5 km', '10k': '10 km', half: 'Half marathon' } as Record<string, string>,
      // The record set most recently, marked (v4.3.3); "new" only in its first weeks.
      newRecord: 'NEW PR',
      latestRecord: 'LATEST',
      latestRecordLabel: 'most recent record',
      shoes: 'Shoes',
      allPairs: 'All pairs',
      consistency: 'Consistency',
      settings: 'Settings',
      nextRace: 'Next race',
      vo2max: 'VO₂ max',
      allTime: 'All time',
      vsYear: (delta: string, year: number) => `${delta} km vs ${year} to date`,
      ofGoal: (km: string) => `of ${km} km`,
      goal: 'Goal',
      runsHours: (runs: number, hours: number) => `${runs} runs · ${hours} h`,
      // "62 days · 10K Wintzenheim, Nov 29": the unit after the countdown.
      raceMeta: (days: number, race: string, date: string) => `${days === 1 ? 'day' : 'days'} · ${race}, ${date}`,
      predicted: 'Predicted',
      target: (time: string) => `Target ${time}`,
      toFind: (gap: string) => `${gap} to find`,
      underTarget: (gap: string) => `${gap} under`,
      noRace: 'No race planned',
      vo2Delta: (delta: string) => `${delta} in 12 weeks`,
      // The footers as segments, each kept whole on the line (v4.3.1).
      thresholdParts: (pace: string | null, lthr: number | null) =>
        [pace ? `Threshold ${pace} /km` : null, lthr ? `LTHR ${lthr} bpm` : null].filter((part): part is string => part !== null),
      noRecords: 'No records yet',
      // "Last 12 weeks · 203 active days in 12 months · 4-week streak", the figures in ink.
      consistencyWindow: 'Last 12 weeks',
      consistencyDays: (days: number) => ({ lead: '', value: String(days), tail: ` active day${days === 1 ? '' : 's'} in 12 months` }),
      consistencyStreak: (weeks: number) => ({ lead: '', value: `${weeks}-week`, tail: ' streak' }),
      since: (date: string) => `since ${date}`,
      distance: 'Distance',
      runsLabel: 'Runs',
      time: 'Time',
      hours: 'h',
      openYears: 'Kilometres by year',
    },
    hero: {
      namePlaceholder: 'Your name',
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
      firstActivityDetail: (km: string) => `Where it all began - ${km} km`,
      lifetimeDistance: (km: string) => `${km} km lifetime`,
      // Marathon equivalents, not races (G25).
      lifetimeDistanceDetail: (marathons: number) => `≈ ${marathons} marathon distances`,
      lifetimeDistanceWorldTour: '🌍 A full trip around the Earth',
      activityCount: (n: number) => `${ordinal(n)} run`,
      activityCountDetail: (km: string) => `${km} km covered so far`,
    },
    trainingZones: {
      title: 'Training zones',
      viewLabel: 'Time in zones over',
      week: 'Week',
      fourWeeks: '4 weeks',
      columnZone: 'Zone',
      columnPace: 'Pace /km',
      columnHr: 'Heart rate',
      columnHrShort: 'HR',
      columnTime: 'Time',
      inZonesWeek: (duration: string) => `${duration} in zones this week`,
      inZonesRecent: (duration: string) => `${duration} in zones over the last 4 weeks`,
      noSessionsThisWeek: 'No sessions logged yet.',
      noSessionsRecent: 'No sessions logged in these 4 weeks.',
      emptyWeekFallback: 'This week has no sessions yet - showing your last 4 weeks instead.',
      // The verdict is Analytics > Intensity's, word for word.
      hardShare: (pct: number, verdict: string) => `Hard (Z4–Z5) ${pct}% · ${verdict}`,
      soFar: 'this week so far',
    },
    athlete: {
      title: 'Athlete',
      lthr: 'LTHR',
      notSet: 'Not set',
      details: 'Details',
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
      // What a bar is, then the dates its first and last bars were run
      // (design review, Oct 2026): "taller = faster" alone named no axis.
      trailKey: 'One bar per run · taller = faster',
      trailSpan: (from: string, to: string) => `${from} → ${to}`,
    },
    milestones: {
      // The key to the gold dot (design review, Oct 2026).
      recordKey: 'Personal record',
    },
    noRecordYet: 'No record yet',
    cols: { distance: 'Distance', best: 'Best', predicted: 'Predicted' },
    sameAsBest: '= best',
    medalLegend: ['1st', '2nd', '3rd'] as [string, string, string],
    findRace: (distance: string) => `Find a ${distance.toLowerCase()} ›`,
  },

  pbAlerts: {
    off: (diff: string) => `${diff} off your PR`,
  },

  // The pushes the phone shows outside the app (src/app/api/internal/*).
  // Numbers arrive formatted, so the decimal follows the locale.
  notifications: {
    restDay: { title: 'Rest day', body: 'No session scheduled today - recovery day.' },
    todaySession: {
      title: "Today's session",
      body: (name: string, detail: string | null) => (detail ? `${name} (${detail})` : name),
    },
    newPr: {
      title: (label: string) => `New PR: ${label}`,
      body: (time: string) => `${time} - new personal best!`,
    },
    shoeWear: {
      title: (name: string) => `Shoe wear alert: ${name}`,
      body: (km: string, threshold: string) => `${km} km - past its ${threshold} km alert threshold`,
    },
    overreaching: {
      title: 'Overreaching risk detected',
      body: (tsb: string, acwr: string | null) => `Form (TSB) ${tsb}${acwr ? `, ACWR ${acwr}` : ''} - high training risk, consider recovery.`,
    },
    staleSync: {
      title: 'No data synced in a while',
      body: (hours: number) => `Your last Garmin sync was ${hours}h ago - check that sync is still running.`,
    },
    newActivity: { title: (name: string) => `New activity: ${name}` },
    weeklyGoal: {
      title: 'Weekly goal check-in',
      status: { ahead: 'ahead of pace', on_track: 'on track', behind: 'behind pace' },
      body: (status: string, rate: string, needed: string) => `You're ${status} at ${rate} km/week (need ${needed} km/week).`,
    },
    workflowFailed: {
      title: (workflow: string) => `${workflow} failed`,
      body: (runUrl: string) => `Open the run: ${runUrl}`,
    },
  },

  nextRace: {
    // A word joiner after the hyphen keeps "D-64" on one line (v4.3.2); the
    // font has no U+2011, which would draw from a fallback face.
    countdown: (days: number) => `D-\u2060${days}`,
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
      flagged: (count: number, total: number, band: string) => `${count} of ${total} in the ${band} band`,
    },
    acwr: {
      label: 'ACWR',
      description: 'Acute:chronic load ratio estimated from km · target 0.8–1.3',
      descriptionGarmin: 'Acute ÷ chronic load, from the loads the watch measured',
      inputs: (acute: number, chronic: number) => `acute ${acute} ÷ chronic ${chronic} =`,
    },
    monotony: { label: 'Monotony', description: 'Day-to-day load variety · alert above 2.0' },
    rampRate: { label: 'Ramp rate', description: 'Δ CTL over 7 days' },
    band: { low: 'low', safe: 'safe', caution: 'caution', risk: 'risk' },
  },

  plan: {
    today: 'Today',
    prevPeriod: 'Previous',
    nextPeriod: 'Next',
    summary: (sessions: number, ranKm: number, plannedKm: number) =>
      `${sessions} session${sessions !== 1 ? 's' : ''} · ${ranKm} km run · ${plannedKm} planned`,
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    switcher: { week: 'Week', month: 'Month' },
    // A month's week under its row: run against plan, or what it is without one.
    weekNoPlan: (km: string) => `${km} km · no plan`,
    noPlanYet: 'No plan yet',
    // A run on a day with nothing planned, in its cell and its name.
    extra: 'extra',
    extraRun: 'Extra run',
    // A planned session no run matched, on its sheet: the plan is read-only, so no reschedule.
    missedNoRun: 'Missed · no run matched',
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
    // One reading of a session for Today, Plan and the bar (workoutSummary).
    session: {
      stridesTitle: (bodyMin: number, reps: number, rep: string) => `Easy ${bodyMin} min + ${reps} × ${rep} strides`,
      seconds: (s: number) => `${s}s`,
      withRecovery: (reps: string, recovery: string) => `${reps} · ${recovery} rec`,
      repsOnly: (n: number) => `${n} reps`,
      // The coach's own range, which can be narrower than the Z2 zone on purpose (v5.5 #10).
      easyPace: (range: string) => `easy target ${range}`,
      stridesPace: (pace: string) => `strides ${pace}`,
      targetPace: (range: string) => `target ${range}`,
    },
    continuous: 'continuous',
    ranKm: (km: string) => `${km} km ran`,
    plannedKmLabel: (km: number) => `${km} km planned`,
    restCard: {
      title: 'Rest day',
      noSession: 'No session planned.',
      next: (weekday: string, title: string) => `No session planned. Next up: ${weekday}, ${title}.`,
    },
    // v4.17: the race the plan builds to, and how far off it is, under the title.
    header: {
      daysToGo: (n: number) => (n <= 0 ? 'race day' : n === 1 ? '1 day to go' : `${n} days to go`),
    },
    legend: {
      plannedByType: 'Planned',
    },
    // The week's three stats (v4.17).
    stats: {
      distance: 'Distance',
      sessions: 'Sessions',
      adherence: 'Plan adherence',
      adherenceAim: (pct: number) => `Aim for ${pct}% or more`,
      noPlan: 'No plan this week',
      ofKm: (km: string) => `/ ${km} km`,
      ofSessions: (n: number) => `of ${n}`,
      kmPlanned: 'km planned',
      planned: 'planned',
    },
    // A session row's target line: its zone, its paces, its recovery.
    row: {
      pace: (range: string) => `${range} /km`,
      easyPace: (range: string) => `easy ${range} /km`,
      stridesPace: (pace: string) => `strides ${pace} /km`,
      recovery: (clock: string) => `${clock} rec`,
    },
    weekSummary: {
      missed: (n: number) => `${n} missed`,
      unplanned: (n: number) => `${n} unplanned`,
      easyOfTarget: (easy: number, target: number) => `${easy}% easy · ${target}% target`,
      aboutLoad: 'About the week\'s load',
      loadOfPlan: (load: number, target: number) => `Load ${load} of ${target} pts planned`,
      loadPlannedLine: (load: number) => `Load ${load} pts planned`,
      loadDone: (load: number) => `Load ${load} pts`,
      loadDefinition: 'Training load in points, from heart rate and duration (TRIMP).',
      sessionsCount: (n: number) => `${n} session${n !== 1 ? 's' : ''}`,
      ranOfPlan: (ran: string, plan: string) => `${ran} / ${plan} km`,
      sessionsOfPlan: (ran: number, plan: number) => `${ran} of ${plan}`,
      planOnly: (km: string, sessions: number) => `Plan ${km} km · ${sessions} session${sessions !== 1 ? 's' : ''}`,
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
      weeks: (n: number) => `${n} wk`,
      raceWeek: (date: string) => `Race week ${date}`,
    },
    weekPurpose: {
      thisWeek: 'This week',
      upcoming: 'Upcoming week',
      prePlan: 'Pre-plan',
      planPhase: {
        base: 'Base',
        build: 'Build',
        peak: 'Peak',
        taper: 'Taper',
        raceDay: 'Race day',
      },
      weekOfTarget: (done: number, total: number) => `week ${done} of ${total}`,
      raceOn: (date: string) => `race ${date}`,
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
    // A step's note on the watch, beside its pace target.
    garminStep: {
      hr: (min: number, max: number) => `HR ${min}-${max} bpm`,
      hrZone: (zone: number) => `HR zone ${zone}`,
    },
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
