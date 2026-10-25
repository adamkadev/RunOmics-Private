import type { ActivityType } from '@/domain/activity/types'

function ordinal(n: number): string {
  const rem10 = n % 10
  const rem100 = n % 100
  if (rem10 === 1 && rem100 !== 11) return `${n}st`
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`
  return `${n}th`
}

/** "+6" as "up 6", "−23" as "down 23", "0" as level. */
function moveWords(delta: string, up: string, down: string, level: string): string {
  const sign = delta.charAt(0)
  const n = delta.replace(/^[+−-]/, '')
  if (sign === '+') return `${up} ${n}`
  if (sign === '−' || sign === '-') return `${down} ${n}`
  return n === '0' ? level : delta
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
    // The compact bar's back chevron, named for the page it goes to.
    backTo: (page: string) => `Back to ${page}`,
    // The tab bar shrunk to its active tab: the button that brings it back.
    showTabs: (page: string) => `${page} - show tabs`,
  },
  meta: {
    description: 'Your personal running training dashboard - stats, maps, trends.',
  },

  theme: {
    toggle: 'Toggle theme',
  },

  dates: {
    monthShortYear: (month: string, year2: string) => `${month} ’${year2}`,
  },

  formBand: {
    tired: 'Tired',
    neutral: 'Neutral',
    fresh: 'Fresh',
    veryFresh: 'Very fresh',
  },

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
    // The card's value, "57.0 VO₂ max", and its percentile in its band.
    valueLabel: 'VO₂ max',
    topInBand: (n: number, sex: 'male' | 'female', bracket: string) => `Top ${n}% · ${sex === 'male' ? 'men' : 'women'} ${bracket.replace('-', '–')}`,
    in30d: 'in 30 days',
    toNext: (gap: string, grade: string) => `${gap} to ${grade}.`,
    newGrade: 'New grade',
    // A grade held until recently, lost in a dip and back: not new.
    regainedGrade: 'Grade regained',
    upFrom: (grade: string) => `up from ${grade}`,
    downFrom: (grade: string, daysOff: number | null) => (daysOff ? `From ${grade} after ${daysOff} days off` : `From ${grade}`),
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
    coachTop: 'Hold it with one VO₂ interval session a week and your current easy volume.',
    todayUp: (grade: string) => `VO₂max grade up to ${grade}`,
    todayBack: (grade: string) => `VO₂max grade back to ${grade}`,
    dismiss: 'Dismiss',
    todayFrom: (grade: string) => `↑ from ${grade}`,
    todayRest: (value: string, top: number) => ` · ${value} · top ${top}%`,
  },
  glossary: {
    about: (term: string) => `What is ${term}?`,
    form: {
      term: 'Form',
      definition: (tired: number, fresh: number, veryFresh: number) =>
        `Form (TSB) is Fitness minus Fatigue. Below ${tired} you are tired, up to +${fresh} neutral, above that fresh, and above +${veryFresh} very fresh.`,
    },
    fitness: { term: 'Fitness', definition: 'Fitness (CTL) is your 42-day average training load: the work your body has absorbed.' },
    fatigue: { term: 'Fatigue', definition: 'Fatigue (ATL) is your 7-day average training load: what the last week has cost you.' },
    vma: { term: 'VMA', definition: 'Maximal aerobic speed: the speed you reach at VO₂max, held for about six minutes.' },
    vo2Grade: { term: 'Men / Women and age', definition: 'Your VO₂max against people of your sex and age decade, from the age and sex norms your watch uses (ACSM / Cooper Institute percentiles). A+ is the top 5%, C below the 45th percentile. The grade changes only once your VO₂max has stayed past the edge for 7 days.' },
    vo2max: { term: 'VO₂max', definition: 'The most oxygen your body can use per kilo each minute, as your watch estimates it from your runs.' },
    lthr: { term: 'Threshold HR', definition: 'Lactate-threshold heart rate (LTHR): about the heart rate you could hold for an hour-long race.' },
    thresholdPace: { term: 'Threshold pace', definition: 'The pace at your lactate threshold: about what you could race for an hour.' },
    rpe: { term: 'RPE', definition: 'Rate of perceived exertion, 1 to 10, as logged on the watch after the run.' },
    aerobicEffect: { term: 'Aerobic effect', definition: 'Your watch’s 0–5 score of how much the run built your aerobic fitness.' },
    anaerobicEffect: { term: 'Anaerobic effect', definition: 'Your watch’s 0–5 score of how much the run built your capacity for short, hard efforts.' },
    strideLength: { term: 'Stride length', definition: 'How far you travel with each step, averaged over the run.' },
    groundContact: { term: 'Ground contact', definition: 'How long each foot stays on the ground per step. Shorter usually means a springier stride.' },
    verticalOscillation: { term: 'Vertical oscillation', definition: 'How far your body rises and falls with each step: the bounce.' },
    verticalRatio: { term: 'Vertical ratio', definition: 'Bounce as a share of stride length. Lower means less effort spent going up for each metre forward.' },
    decoupling: { term: 'Decoupling', definition: 'How much heart rate drifted against pace from the first half to the second. Under 5% is a steady run.' },
  },

  consistency: {
    ranges: { '3m': '3M', '6m': '6M', '1y': '1Y' },
    // What a screen reader says for each range.
    rangesSpoken: { '3m': '3 months', '6m': '6 months', '1y': '1 year' },
    rangeLabel: 'Window',
    streakEyebrow: 'Weekly streak',
    weeks: (weeks: number): string => (weeks === 1 ? 'week' : 'weeks'),
    streakRule: (target: number, best: number) => `${target}+ runs a week · best ${best}`,
    thisWeek: 'This week',
    thisWeekRuns: (runs: number, target: number) => `${runs} of ${target}`,
    planned: (sessions: number) => `${sessions} planned`,
    thisWeekLabel: (runs: number, target: number) => `This week: ${runs} of ${target} runs`,
    weeksOnTarget: 'weeks on target',
    runsPerWeek: 'runs / week',
    runs: (runs: number): string => (runs === 1 ? 'run' : 'runs'),
    perWeek: 'Runs per week',
    target: (runs: number) => `target ${runs}`,
    legend: { onTarget: (runs: number) => `${runs}+ runs`, under: 'under', planned: 'planned', streak: 'streak' },
    weekLabel: (week: string, runs: number) => `Week of ${week}: ${runs} run${runs === 1 ? '' : 's'}`,
    runningWeek: 'Your running week',
    weeksRan: (weeks: number) => `weeks you ran, of ${weeks}`,
    weekdayLabel: (day: string, weeks: number) => `${day}: ${weeks} week${weeks === 1 ? '' : 's'}`,
    anchor: (day: string) => `${day} is your anchor`,
    anchorWeeks: (weeks: number, of: number) => `, ${weeks} of ${of} weeks.`,
    restDay: (day: string) => `${day} stays a rest day.`,
    sheet: {
      title: (week: string) => `Week of ${week}`,
      summary: (runs: number, km: string, time: string) => `${runs} run${runs === 1 ? '' : 's'} · ${km} km · ${time}`,
      hit: 'Target hit',
      under: 'Under target',
      current: 'In progress',
      runsColumn: 'runs',
      seeRuns: (runs: number) => (runs === 1 ? 'See the run in Activities' : `See the ${runs} runs in Activities`),
      close: 'Close',
    },
    empty: 'No runs yet.',
  },

  paceAxis: {
    caption: 'up = faster',
  },

  sessionState: {
    done: 'Done',
    planned: 'Planned',
    missed: 'Missed',
    rest: 'Rest',
    today: 'Today',
    dayLabel: (day: string, state: string) => `${day}: ${state}`,
  },
  sessionCard: {
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
    kb: 'KB',
    mb: 'MB',
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
      back: 'Progress',
    },
    map: {
      title: 'Heatmap',
      area: 'Area',
      areas: 'Areas',
      areasSummary: (areas: number, runs: number) =>
        `${areas} area${areas === 1 ? '' : 's'} · ${runs} run${runs === 1 ? '' : 's'}`,
      moreAreas: (n: number) => `${n} more area${n === 1 ? '' : 's'}`,
      including: (name: string) => `incl. ${name}`,
      shareNote: '% = share of km, the same basis the card uses.',
      allYears: 'All years',
      allTypes: 'All types',
      // The filters sheet's sections.
      year: 'Year',
      type: 'Type',
      filters: {
        button: 'Filters',
        buttonActive: (n: number) => `Filters, ${n} on`,
        title: 'Filters',
        reset: 'Reset',
        all: 'All',
        show: (n: number) => `Show ${n} run${n === 1 ? '' : 's'}`,
        // The card's eyebrow, with more than one type ticked.
        types: (n: number) => `${n} types`,
      },
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      less: 'Rare',
      more: 'Frequent',
      noRoutes: 'No routes for this filter',
      loadFailed: 'The map couldn’t load.',
      mapUnavailable: 'Map unavailable - no map token configured',
      attribution: '© MapTiler · © OpenStreetMap contributors',
      // The ⓘ that opens the credits on every map.
      credits: 'Map credits',
      territory: {
        // The place is the eyebrow's; the ring is the map's.
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
      // Explore's Districts layer: the quartiers of the home city, and the communes
      // around it, by how much of each the runs have covered.
      districts: {
        // The layers button: a toggle, pressed while the layer shows.
        layersButton: 'Show quartiers',
        legend: 'Quartier coverage',
        fog: 'Fog',
        partly: 'Partly',
        complete: 'Complete',
        // The insight card. `distance` is "1.9 km", or null without a home.
        headline: (done: number, total: number, next: string, distance: string | null) => ({
          lead: `${done} of ${total} quartier${total === 1 ? '' : 's'} complete. `,
          accent: next,
          tail: distance ? ` is next, ${distance} from home.` : ' is next.',
        }),
        allComplete: (total: number) => ({
          lead: total === 1 ? 'Your quartier is complete.' : `All ${total} quartiers complete.`,
          accent: '',
          tail: '',
        }),
        loading: { lead: 'Counting the quartiers you’ve run…', accent: '', tail: '' },
        failed: { lead: 'Your quartiers couldn’t be counted just now.', accent: '', tail: '' },
        completeStat: 'Complete',
        ofTotal: (total: number) => `of ${total}`,
        exploredStat: 'Explored',
        nextStat: 'Next quartier',
        planRunIn: (name: string) => `Plan a run in ${name}`,
        // The expanded map's card. `pct` is "8%"; `distance` "1.9 km", or null without a home.
        nextToExplore: 'Next to explore',
        nextMeta: (pct: string, distance: string | null) => (distance ? `${pct} explored · ${distance} from home` : `${pct} explored`),
        // The same, when it can't show whole beside the Plan a run button (a long name, two digits).
        nextMetaShort: (pct: string, distance: string | null) => (distance ? `${pct} explored · ${distance} away` : `${pct} explored`),
        planRun: 'Plan a run',
        // A quartier's sheet, opened by a tap on it.
        sheet: {
          quartierOf: (commune: string) => `Quartier · ${commune}`,
          commune: 'Commune',
          explored: (pct: string) => `${pct} explored`,
          // `n` formats a count for the reader's locale.
          cells: (visited: number, total: number, n: (count: number) => string) => `${n(visited)} of ${n(total)} cell${total === 1 ? '' : 's'}`,
          completeAt: (pct: string) => `Complete at ${pct}`,
          completeSince: (date: string) => `Complete since ${date}`,
          runHere: 'Run here',
          lastRun: 'Last run',
          fromHome: 'From home',
          planRunHere: 'Plan a run here',
        },
      },
      // Explore's route generator: a loop in one quartier, sized to today's plan, out as a GPX file.
      explore: {
        back: 'Back',
        title: (name: string) => `Run in ${name}`,
        loop: 'Loop',
        // The title pill's tail: `pct` is "94%".
        newShare: (pct: string) => `${pct} new`,
        todaysPlan: 'Today’s plan',
        // The row for another day's session, from Plan's "Find a route". `day` is "Sat 24".
        planFor: (day: string) => `Plan for ${day}`,
        // The plan row as a button: back to the plan's distance. `km` is "9.5 km".
        usePlanDistance: (km: string) => `Use the plan’s distance, ${km}`,
        start: {
          label: 'Start',
          modes: { pick: 'Map point', quartier: 'Quartier' },
          modesFull: { pick: 'Start from a point I tap on the map', quartier: 'Start inside the quartier' },
          pickPrompt: 'Tap the map where you’ll start.',
        },
        // The button that takes the shortest distance reaching the quartier. `km` is "12.5 km".
        useDistance: (km: string) => `Use ${km}`,
        distance: 'Distance',
        shorter: 'Shorter',
        longer: 'Longer',
        options: 'Route options',
        avoidBusyRoads: 'Avoid busy roads',
        newStreetsFirst: 'New streets first',
        // On by itself on a reps or tempo day: flat ground, on paths and cycleways rather than across streets.
        flatForReps: 'Flat for the reps',
        // The options row's summary, "Loop · Avoid busy roads · New streets first": one line on a 393 pt phone.
        summary: { avoidBusyRoads: 'Avoid busy roads', newStreetsFirst: 'New streets first', flatForReps: 'Flat' },
        distanceStat: 'Distance',
        timeStat: 'Time',
        // Under the time: the pace it is worked out at, "5:50".
        atPace: (pace: string) => `At ${pace}`,
        climbStat: 'Climb',
        newStat: 'New',
        regenerate: 'Regenerate',
        download: 'Download GPX',
        saved: 'Saved',
        share: 'Share GPX',
        footnote: 'GPX file · import into Garmin Connect, Coros or Suunto',
        generating: 'Finding loops…',
        retry: 'Try again',
        errors: {
          notConfigured: 'Route generation isn’t set up on this deployment.',
          auth: 'Sign in as the owner to plan routes.',
          rateLimited: 'Too many requests. Try again in a minute.',
          dailyQuota: 'Today’s route quota is used up.',
          noRoute: 'No loop found here. Try another distance.',
          upstream: 'The routing service didn’t answer. Try again.',
          tooFar: (km: string) => `Too far for this distance: from here, a loop through this quartier needs ${km}.`,
          tooFarToRun: 'Too far to run there and back. Start in the quartier instead.',
        },
        // The GPX's name and description. `km` is "8.1".
        gpxName: (name: string, km: string) => `RunOmics · ${name} · ${km} km`,
        gpxDescription: (name: string) => `A loop in ${name}, planned with RunOmics.`,
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
      fromGarmin: 'From your watch',
      syncedAgo: (when: string) => `From your watch · synced ${when}`,
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
      back: 'Progress',
    },
  },

  settings: {
    about: (version: string, commit: string) => `RunOmics ${version} · ${commit}`,
    buildCopied: 'Build info copied',
    sections: {
      profile: 'Profile · from your watch',
      appearance: 'Appearance',
      data: 'Data',
      account: 'Account',
      notifications: 'Notifications',
      diagnostics: 'Diagnostics',
    },
    // What failed on a phone, sent by the app itself (never a location): the last fifty, newest first.
    diagnostics: {
      recentErrors: 'Recent errors',
      loading: 'Loading…',
      none: 'No errors recorded.',
      loadFailed: 'The errors couldn’t be loaded.',
    },
    sync: {
      subtitle: 'Pull in today’s runs without waiting for tonight.',
      action: 'Sync',
      // The button while the chain runs; the device line says which step.
      running: 'Syncing…',
      starting: 'Starting the workflow…',
      fetching: 'Fetching from your watch, then rebuilding the app…',
      writing: 'New data is live. Writing the verdict…',
      upToDate: 'Already up to date — no new run to fetch.',
      stillRunning: 'Still running. The verdict will appear on its own.',
      failed: 'Could not start the sync.',
      // The server's limits on manual syncs.
      cooldown: (min: number) => `Up to date — next sync in ${min} min.`,
      dailyCap: 'Daily sync limit reached. Auto-sync continues tonight.',
      viewRun: 'View run ›',
    },
    rowAction: {
      signIn: 'Sign in ›',
    },
    appearance: {
      title: 'Appearance',
      themeLabel: 'Theme',
      light: 'Light',
      auto: 'Auto',
      dark: 'Dark',
      // Light mode's background.
      glowLabel: 'Background glow',
      glowHint: 'Colour behind the top of each page',
      reducedTransparencyNote: ' · off while Reduce Transparency is on',
    },
    accent: {
      title: 'Accent',
      caption: 'charts & highlights',
      options: {
        teal:     { label: 'Teal' },
        cyan: { label: 'Cyan' },
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
      thresholdPace: 'Threshold',
      thresholdHr: 'Threshold HR',
      details: 'Heart & body',
      vma: 'VMA',
      maxHr: 'Max HR',
      // The watch's setting the zones and the load are computed from, not a
      // reading of today (Analytics > Recovery has that, "Daily resting HR").
      restingHr: 'Resting HR',
      vo2max: 'VO₂max',
      weight: 'Weight',
      height: 'Height',
      fitnessAge: 'Fitness age',
      // Fitness age against the real age: "18 vs 29".
      ofAge: (age: number) => `vs ${age}`,
      achievableFitnessAge: 'Potential',
      fitnessAgeBand: {
        younger: (years: number) => `−${years} yrs`,
        onPar: 'on par',
        older: (years: number) => `+${years} yrs`,
      },
    },
    actions: {
      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved',
      error: 'Error saving, please retry.',
      confirmCancel: 'Cancel',
    },
    dataSource: {
      garmin: 'your watch’s app',
      connected: (source: string) => `${source} connected`,
      readOnly: 'Runs are read-only here',
      readOnlySynced: (when: string, runs: string) => `last synced ${when} · ${runs} · read-only here`,
      lastSync: 'Last synced',
      since: (monthYear: string) => `paired ${monthYear}`,
      // The device row's line after its dot: "Synced 2h ago · 315 runs".
      connectedNow: 'Connected',
      lastSyncedAgo: (when: string) => `Synced ${when}`,
    },
    dataExport: {
      workbook: 'Export training data (.xlsx)',
      title: 'Export activities',
      exporting: 'Exporting...',
      failed: 'Could not export the training data.',
      sheetTitle: 'Export my activities',
      workbookTitle: 'Full workbook',
      workbookHint: 'All your runs, ready to open in a spreadsheet.',
      csvTitle: 'Raw data',
      csvHint: 'A light file that any tool can read.',
      notesUnavailable: 'Exported without your notes and tags: the notes store did not answer. Try again.',
    },
    profile: {
      // Under the read-only height and weight. No brand in the words: the data is
      // imported JSON, and the brand can change.
      readOnly: 'From your watch - edit in your watch app.',
      // The Athlete & zones row's value: "LTHR 179 · Max 200".
      lthr: (bpm: number) => `LTHR ${bpm}`,
      maxHr: (bpm: number) => `Max ${bpm}`,
    },
    offlineCache: {
      clear: 'Clear offline cache',
      confirm: 'Clear it?',
      confirmAction: 'Clear',
      cleared: 'Offline cache cleared.',
      failed: 'Could not clear the offline cache.',
    },
    notifications: {
      title: 'Notifications',
      error: 'Could not update notification settings, please retry.',
      // The daily reminder's time beside its switch: "08:00".
      at: (hour: number, minute: string) => `${String(hour).padStart(2, '0')}:${minute}`,
      types: {
        training: { title: 'Training reminders' },
        shoes: { title: 'Shoe wear alerts' },
        records: { title: 'Records and explored areas' },
      },
    },
  },

  dashboard: {
    // Today's page header: the date over the title.
    headerDate: (weekday: string, date: string) => `${weekday}, ${date}`,
    readiness: {
      open: 'Open Load in Analytics',
      // Everyday words, not acronyms.
      formLabel: 'Form',
      // Over yesterday's verdict, shown until the night's sync writes today's.
      yesterday: 'Yesterday',
      formOnDial: (form: string, band: string) => `Form ${form}: ${band}`,
      eyebrowByTone: {
        go: 'Green light',
        build: 'Building',
        caution: 'Caution',
        hold: 'Hold back',
      },
      lineByTone: {
        go: 'Fatigue has come down',
        build: 'Load in range',
        caution: 'Fatigue building up',
        hold: 'Fatigue ahead of fitness',
      },
      // The seven-day load against its safe range, in the words Analytics' Load card uses.
      loadState: {
        below: 'Load below range',
        in: 'Load in range',
        above: 'Load above range',
      },
      ctl: 'Fitness',
      atl: 'Fatigue',
      // This week's load against the usual: "×0.90".
      acwr: 'Load',
      acwrValue: (ratio: string) => `×${ratio}`,
      // Read out after a tile's delta; on screen the sign says it.
      deltaIn: (days: number) => `in ${days} days`,
      // "↘ 2 this week" under a tile.
      deltaWeek: (n: number, days: number) => (days === 7 ? `${n} this week` : `${n} in ${days} days`),
      // The card's words when no written verdict is in yet, from the load itself.
      fallback: {
        // The headline follows the form state the status line names: "fresh" only when form is above +5.
        below: (acute: number, lo: number, hi: number, fresh = false) => ({
          headline: fresh ? 'You\u2019re fresh. Time to build again.' : 'Load is below range. Time to build again.',
          body: `Load ${acute} has dipped below your ${lo}–${hi} safe range. Run today\u2019s session in full to bring it back up.`,
        }),
        in: (acute: number, lo: number, hi: number) => ({
          headline: 'Load is right where it should be.',
          body: `Load ${acute} sits inside your ${lo}–${hi} safe range. Keep to the plan.`,
        }),
        above: (acute: number, lo: number, hi: number) => ({
          headline: 'Load is running above your safe range.',
          body: `Load ${acute} is over your ${lo}–${hi} safe range. Keep today easy and let fatigue come down.`,
        }),
      },
      noValue: '—',
    },
    stale: {
      title: (hours: number) => `Watch data ${hours} h old`,
      line: (when: string) => `Last sync ${when} · a run may be missing`,
      sync: 'Sync',
    },
    syncStatus: {
      tapToSync: 'tap to sync',
      syncing: 'Syncing…',
      failed: 'Sync failed · tap to retry',
      // The header's sync line, which is the sync control.
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
      // The next-workout card: when, then the day.
      today: 'Today',
      tomorrow: 'Tomorrow',
      openInPlan: 'Open in Plan',
      hrCap: (bpm: number) => `≤ ${bpm}`,
    },
    weeklyStreak: {
      title: 'This week',
      weeksInARow: (weeks: number) => `${weeks} week streak`,
      // "0 / 54 km · 0 / 5 runs".
      kmOf: (ran: string, target: string) => `${ran} / ${target} km`,
      // Planned sessions only: an extra run fills a day too.
      runsOf: (done: number, planned: number) => `${done} / ${planned} run${planned !== 1 ? 's' : ''}`,
      // Each day's session by the coach's type, in the day's accessible name.
      kinds: {
        easy: 'Easy',
        easyStrides: 'Easy + strides',
        recovery: 'Recovery',
        long_run: 'Long run',
        tempo: 'Tempo',
        threshold: 'Threshold',
        vo2max: 'VO₂ max',
        anaerobic: 'Anaerobic',
        sprint: 'Sprint',
        race: 'Race',
        rest: 'Rest',
      },
    },
    thisWeek: {
      title: 'This week',
      // "load 456 · safe 462–750".
      load: (acute: number, lo: number, hi: number) => `load ${acute} · safe ${lo}–${hi}`,
      runsLeft: (n: number) => `${n} run${n !== 1 ? 's' : ''} left`,
      missed: 'missed',
      missedCount: (n: number) => `${n} missed`,
    },
    loadStrip: {
      title: 'Load · 7 days',
      band: (lo: number, hi: number) => `target ${lo}–${hi}`,
      safe: (lo: number, hi: number) => `· safe ${lo}–${hi}`,
      day: (date: string, load: number) => `${date} · load ${load}`,
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
    model: { garmin: 'Your watch', runomics: 'RunOmics' },
    title: 'Analytics',

    aboutChart: 'What this chart measures',
    season: (year: number) => `${year} season`,
    allTimeChip: 'All',
    // Named for what each tab holds, in whole words.
    tabs: {
      fitness: 'Load',
      performance: 'Performance',
      volume: 'Volume',
      health: 'Intensity',
    },
    cards: {
      period: {
        label: 'Period',
        short: { '4w': '4W', '12w': '12W', '1y': '1Y' } as Record<string, string>,
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
        // Each tab reads its own period and says which.
        eyebrow: (span: string, tab: string) => `Coach read · ${span} · ${tab}`,
        why: 'Why',
        // Only a way to the plan: it is generated by the coach, never edited here.
        openPlan: 'Open plan',
        openPlanButton: 'Open plan',
        last: { '4w': 'the last 4 weeks', '12w': 'the last 12 weeks', '1y': 'the last year' } as Record<string, string>,
        ago: { '4w': '4 weeks ago', '12w': '12 weeks ago', '1y': 'a year ago' } as Record<string, string>,
        within: { '4w': 'in 4 weeks', '12w': 'in 12 weeks', '1y': 'in a year' } as Record<string, string>,
        headline: {
          positive: 'Your load is turning into speed.',
          positiveSteadyLoad: (last: string) => `Speed has improved over ${last}.`,
          // Names only the reads that slipped.
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
        // "Fitness 52, up 6 in 4 weeks.": the move in words, the arrow beside it.
        fitness: (value: number, delta: string, within: string) => `Fitness ${value}, ${moveWords(delta, 'up', 'down', 'level')} ${within}.`,
        fatigue: (value: number, delta: string, within: string) => `Fatigue ${value}, ${moveWords(delta, 'up', 'down', 'level')} ${within}.`,
        // The Load tab's Why rows: Load, Fitness, Fatigue, Resting HR, each a lead and what it means.
        loadRow: (state: 'below' | 'in' | 'above', acute: number, lo: number, hi: number) =>
          state === 'below' ? `Load ${acute}, under the ${lo}–${hi} safe range.` : state === 'above' ? `Load ${acute}, over the ${lo}–${hi} safe range.` : `Load ${acute}, inside the ${lo}–${hi} safe range.`,
        fitnessNow: (perWeek: number, n: string) => (perWeek < 0 ? ` Slipping ${n} a week now.` : perWeek > 0 ? ` Building ${n} a week now.` : ' Holding steady now.'),
        fatigueNow: { fresh: ' You\u2019re well recovered.', veryFresh: ' You\u2019re well recovered.', neutral: ' Recovery is on track.', tired: ' You\u2019re carrying fatigue.' } as Record<string, string>,
        restingHrRow: (side: 'low' | 'high' | null, value: number, lo: number, hi: number) =>
          side === 'high' ? `Resting HR ${value}, above your ${lo}–${hi} baseline.` : side === 'low' ? `Resting HR ${value}, below your ${lo}–${hi} baseline.` : `Resting HR ${value}, inside your ${lo}–${hi} baseline.`,
        thresholdFaster: (pace: string, s: number, ago: string) => `Threshold ${pace} /km, ${s} s faster than ${ago}.`,
        thresholdSlower: (pace: string, s: number, ago: string) => `Threshold ${pace} /km, ${s} s slower than ${ago}.`,
        thresholdLevel: (pace: string, ago: string) => `Threshold ${pace} /km, level with ${ago}.`,
        easyFaster: (pace: string, s: number, ago: string) => `Easy pace averaged ${pace} /km, ${s} s faster than ${ago}.`,
        easySlower: (pace: string, s: number, ago: string) => `Easy pace averaged ${pace} /km, ${s} s slower than ${ago}.`,
        easyLevel: (pace: string, ago: string) => `Easy pace averaged ${pace} /km, level with ${ago}.`,
        predictionsSlower: (n: number, of: number, ago: string) => `${n} of ${of} race predictions slower than ${ago}.`,
        predictionsFaster: (n: number, of: number, ago: string) => `${n} of ${of} race predictions faster than ${ago}.`,
        predictionsHeld: (last: string) => `Race predictions held over ${last}.`,
        // The unit and what it means, not a bare "1.15".
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
          // Missed sessions that came together, 3 or more in 7 days.
          missedRow: (n: number, from: string, to: string) => `${n} planned sessions missed between ${from} and ${to}.`,
          missedRows: (n: number, stretches: number, from: string, to: string) =>
            `${n} planned sessions missed in ${stretches} stretches, the last between ${from} and ${to}.`,
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
      // The Load tab's compact cards.
      loadCompact: {
        title: 'Load',
        caption: '7-day vs 28-day',
        safe: (lo: number, hi: number) => `safe ${lo}–${hi}`,
        fitnessWeek: 'fitness / week',
        restingHr: 'Resting HR',
        baseline: (side: 'low' | 'high' | null, lo: number, hi: number) =>
          side === 'high' ? `above ${lo}–${hi} baseline` : side === 'low' ? `below ${lo}–${hi} baseline` : `inside ${lo}–${hi} baseline`,
        ok: 'OK',
        check: 'Check',
      },
      loadTrend: {
        about: 'Your acute load: the last 7 days of training load from your watch, day by day (weekly averages on a year). The band is your safe range, 0.8–1.3 × your chronic 28-day load; days outside it are marked. The Load ratio under Injury risk is the last point divided by its chronic load.',
        ratioSafe: (lo: number, hi: number) => `ratio · safe ${lo}–${hi}`,
        span: (days: number) => (days < 14 ? (days === 1 ? '1 day' : `${days} days`) : Math.round(days / 7) === 1 ? '1 week' : `${Math.round(days / 7)} weeks`),
        // Today, or the period's last day once it is swiped back.
        today: 'today',
        onDay: (date: string) => `on ${date}`,
        upIn: (pct: number, span: string, when: string) => ['Load up ', `${pct}% in ${span}`, `, inside your safe range ${when}.`] as [string, string, string],
        downIn: (pct: number, span: string, when: string) => ['Load down ', `${pct}% in ${span}`, `, inside your safe range ${when}.`] as [string, string, string],
        inRange: (when: string) => ['Load is ', 'inside your safe range', ` ${when}.`] as [string, string, string],
        steady: (when: string) => ['Load ', 'steady', `, inside your safe range ${when}.`] as [string, string, string],
        jumped: (pct: number, span: string) => ['Load jumped ', `${pct}% in ${span}`, ', above your safe range. Ease off for 3–4 days.'] as [string, string, string],
        above: ['Load is ', 'above your safe range', '. Ease off for 3–4 days.'] as [string, string, string],
        below: ['Load is ', 'below your safe range', '. Fitness will start to slip.'] as [string, string, string],
        // The days before it that were above the range: history, said as such.
        wentOver: (days: number, last: string) =>
          days === 1 ? ` Earlier in this period, one day was above it, on ${last}.` : ` Earlier in this period, ${days} days were above it, the last on ${last}.`,
      },
      status: {
        title: 'Training status',
        caption: (span: string) => `Your watch · ${span}`,
        span: { days28: '28 days', weeks12: '12 weeks', months12: '12 months' },
        spanLive: { days28: 'last 28 days', weeks12: 'last 12 weeks', months12: 'last 12 months' },
        about: "Your watch's training status: how your recent load compares with what your body is used to. Each cell is one day (one week on longer periods).",
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
        slower: (s: string) => `${s} slower`,
        faster: (s: string) => `${s} faster`,
        same: 'No change',
        flat: (signed: string) => `${signed} · flat`,
        secs: (n: number) => `${n} s`,
      },
      predictions: {
        title: 'Race predictions',
        caption: (period: string) => `change in ${period}`,
        about: "The race times your watch predicts. The line under each is the period's trend, faster up.",
        count: (n: number): string => (n === 4 ? 'All four' : n === 3 ? 'All three' : n === 2 ? 'Both' : 'It'),
        slipped: (who: string, range: string, period: string) => `${who} slipped ${range} over ${period}.`,
        improved: (who: string, range: string, period: string) => `${who} improved by ${range} over ${period}.`,
        held: (who: string, period: string) => `${who} held over ${period}.`,
        // Some moved, the others held: the held ones are grey on their rows.
        someSlipped: (n: number, of: number, range: string, period: string) => `${n} of ${of} slipped ${range} over ${period}.`,
        someImproved: (n: number, of: number, range: string, period: string) => `${n} of ${of} improved by ${range} over ${period}.`,
        mixed: (faster: number, of: number, period: string) => `${faster} of ${of} got faster over ${period}.`,
        // The gap to the goal race's target, its figure in bold.
        offTarget: (distance: string, gap: string, target: string) => [`The ${distance} is `, gap, ` off your ${target} target.`] as [string, string, string],
        onTarget: (distance: string, gap: string, target: string) => [`The ${distance} is `, gap, ` inside your ${target} target.`] as [string, string, string],
        range: (lo: string, hi: string) => (lo === hi ? lo : `${lo}–${hi}`),
        race: (distance: string) => `${distance} race: `,
        inDays: (n: number) => (n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `${n} days`),
      },
      paceTrend: {
        title: 'Pace trend',
        caption: 'weekly average · higher is faster',
        about: 'The weekly average pace of your easy runs, and of the hard reps inside your workouts - the warm-up, the recoveries and the cool-down are left out. Faster is up.',
        easyFaster: (s: string) => ['Easy runs got ', `${s}/km faster`, '.'] as [string, string, string],
        easySlower: (s: string) => ['Easy runs got ', `${s}/km slower`, '.'] as [string, string, string],
        easyHeld: ['Easy pace ', 'held', '.'] as [string, string, string],
        // The reps alone, not the session around them.
        workoutFaster: (s: string) => [' Rep pace got ', `${s}/km faster`, '.'] as [string, string, string],
        workoutSlower: (s: string) => [' Rep pace got ', `${s}/km slower`, '.'] as [string, string, string],
        workoutHeld: [' Rep pace ', 'held', '.'] as [string, string, string],
        easy: 'Easy',
        workout: 'Rep pace',
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
      paceCurve: {
        title: 'Pace curve',
        caption: 'best pace for each duration',
        about: "Your best pace for every duration from 30 seconds to 2 hours, in these weeks and in the weeks before, read from each run's full recording. Critical speed (CS) is fitted to the 3 to 20 minute bests as distance = CS x time + D': the fastest pace you can hold without tiring towards a stop, roughly what you could race for 30 to 40 minutes, usually a little faster than your threshold pace. D' is the distance you can run above it before you tire. It is only as good as your hardest efforts of 3 to 20 minutes: easy weeks read low.",
        cs: 'Critical speed',
        dPrime: (m: number) => `D' ${m} m`,
        noThreshold: 'Fitted to your 3-20 min bests: roughly the pace you could hold for 30 to 40 minutes.',
        level: (pace: string) => ['Level with your threshold pace of ', pace, '.'] as [string, string, string],
        faster: (s: number, pace: string) => [`${s} s/km faster than your threshold pace of `, pace, ', where critical speed usually sits.'] as [string, string, string],
        slower: (s: number, pace: string) => [`${s} s/km slower than your threshold pace of `, pace, ': these 3-20 min bests were not all-out.'] as [string, string, string],
        changed: (amount: string, faster: boolean, span: string) => [' ', `${amount} ${faster ? 'faster' : 'slower'}`, ` than the ${span} before.`] as [string, string, string],
        held: (span: string) => [' ', 'Same', ` as the ${span} before.`] as [string, string, string],
        noFit: 'Not enough all-out efforts between 3 and 20 minutes here to fit a critical speed.',
        now: { '4w': 'These 4 weeks', '12w': 'These 12 weeks', '1y': 'These 12 months' } as Record<string, string>,
        before: { '4w': 'The 4 weeks before', '12w': 'The 12 weeks before', '1y': 'The 12 months before' } as Record<string, string>,
        span: { '4w': '4 weeks', '12w': '12 weeks', '1y': '12 months' } as Record<string, string>,
        duration: (seconds: number) => (seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${seconds / 60} min` : `${seconds / 3600} h`),
        prior: (pace: string) => `before ${pace}`,
      },
      heatCost: {
        // Both ends of the thermometer: the cold costs pace too.
        title: 'Temperature cost',
        caption: (hr: number) => `Pace at ${hr} bpm vs your best band`,
        about: 'Your easy-run pace at the same heart rate, by the temperature it felt like. Each bar is the seconds per km you lose against your best temperature band.',
        lose: (range: string) => ['Above 20 °C you lose ', `${range} s/km`, ' at the same heart rate.'] as [string, string, string],
        cold: (cost: number) => ['Below 5 °C you lose ', `${cost} s/km`, ' at the same heart rate.'] as [string, string, string],
        little: 'Temperature has cost you little so far: under 5 s/km at the same heart rate.',
        noWarm: 'No easy runs above 20 °C yet to measure what heat costs you.',
        best: 'best',
        noRuns: 'no runs',
        plus: (s: number) => `+${s} s`,
        barKey: 'Longer bar: more s/km lost against your best band.',
        // "You're fastest at 15–20 °C. Below 5 °C costs 16 s/km, above 20 °C 14–15 s/km."
        fastest: (band: string) => `You're fastest at ${band}.`,
        coldCosts: (s: string) => [' Below 5 °C costs ', `${s} s/km`, ''] as [string, string, string],
        warmCosts: (s: string, afterCold: boolean) => [afterCold ? ', above 20 °C ' : ' Above 20 °C costs ', `${s} s/km`, ''] as [string, string, string],
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
        onOrAbove: 'On plan',
        // The week under way, its plan as a dashed outline.
        planned: 'Planned',
        belowPlan: 'Below plan',
        unplanned: 'Unplanned',
        // A week the plan asked for with nothing run against it.
        missed: 'Missed',
        // The unit, name and what the number is measured against read as one line
        // under it: "12.1" over "of 53 km this week", never "12.1 / 53".
        underWeek: (when: string) => `km ${when.toLocaleLowerCase('en')}`,
        underWeekOfPlan: (km: string, when: string) => `of ${km} km ${when.toLocaleLowerCase('en')}`,
        // A non-breaking hyphen and space: the label is two words, and
        // "12-" on one line over "wk avg" on the next is neither.
        underAvg: (n: number) => (n >= 52 ? 'km · 1\u2011year\u00a0avg' : `km · ${n}\u2011week\u00a0avg`),
        underOnPlan: 'weeks on plan',
        underOnPlanOf: (n: number) => `of ${n} week${n === 1 ? '' : 's'} on plan`,
        done: 'Done',
        plan: 'Plan',
      },
      ytd: {
        // Its home is Goals: Volume keeps a row that opens it, in Goals' own words (goals.projection).
        title: 'Year to date',
        shortOf: (km: string, goal: string) => `${km} km short of ${goal} at this pace`,
        overOf: (km: string, goal: string) => `${km} km over ${goal} at this pace`,
      },
      longRun: {
        title: 'Long run share',
        caption: 'share of weekly distance',
        // Across from the title: "3 of 11 weeks over".
        overOf: (n: number, of: number) => `${n} of ${of} week${of === 1 ? '' : 's'} over`,
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
        // What changed, in order: the hours, how weekly time moved, then hard time.
        summaryHours: (h: string) => `${h} h in all.`,
        summaryTotal: { grew: ' Weekly time grew.', dropped: ' Weekly time dropped.', held: ' Weekly time held steady.' } as Record<string, string>,
        summaryRecovered: (when: string, back: string) => ` Weekly time dropped ${when}, then climbed back from ${back}.`,
        summaryHardUnder: (min: number) => ` Hard time stayed under ${min} min a week.`,
        summaryHardRange: (range: string) => ` Hard time ranged ${range} min a week.`,
        // "mid-August": a week placed in its month.
        partOfMonth: (day: number, month: string) => `${day <= 10 ? 'early' : day <= 20 ? 'mid-' : 'late'}${day <= 10 || day > 20 ? ' ' : ''}${month}`,
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
        // The dots say whether the plan was kept, not which kind of session it was.
        done: 'Done',
        doneNoPlan: 'done',
        // The three read as one sum: done = on plan + extra.
        onPlan: (done: number, planned: number) => `${done} of ${planned} planned`,
        extra: (n: number) => `${n} extra`,
        plannedLegend: 'Planned',
        missedCount: (n: number) => `${n} missed`,
        missed: 'Missed',
        // "of 10 planned · 1 extra", grey beside "11 done".
        ofPlanned: (n: number) => `of ${n} planned`,
      },
      zoneRanges: {
        title: 'Zone ranges',
        subtitle: 'In Athlete & zones',
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
        footnote: 'Distance-weighted average pace, up = faster.',
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
        footnote: 'The effort you can hold before lactate builds up, as the watch measures it. The watch revises it every few weeks, so the line steps rather than drifts.',
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
        footnote: 'Finish times the watch predicts from VO₂max and recent training. Plotted as pace so all four distances share one scale, up = faster.',
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
        footnote: 'The watch\'s daily verdict, with the acute and chronic load it measured. The blue band is the chronic load range the watch personalises for you.',
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
    // The long run as its own filter row: a Base run the long-run rule picks out.
    longRun: 'Long run',
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
      runs: (n: number): string => (n === 1 ? '1 run' : `${n} runs`),
      easy: (pct: number) => `${pct}% easy`,
      // Under a filter, the week's matching runs against all of its runs.
      ofRuns: (n: number, total: number) => `${n} of ${total} run${total === 1 ? '' : 's'}`,
    },
    // The page's two views, under the title.
    view: { label: 'View', list: 'List', map: 'Map' },
    groups: { easy: 'Easy', workouts: 'Workouts', races: 'Races' },
    filter: {
      title: 'Filter & sort',
      reset: 'Reset',
      clearTypes: (types: string) => `Clear the filter: ${types}`,
      show: (n: number) => `Show ${n} run${n === 1 ? '' : 's'}`,
      // With nothing picked the button says so, rather than a bare count.
      showAll: (n: number) => `Show all ${n} runs`,
      // The bar over a filtered list: what the totals count.
      showing: 'Showing',
      totalsCount: ' · totals count these only',
      // A group chip alone names what is counted: "90 workouts · totals count workouts only".
      groupCount: {
        easy: (n: number) => `${n} easy run${n === 1 ? '' : 's'}`,
        workouts: (n: number) => `${n} workout${n === 1 ? '' : 's'}`,
        races: (n: number) => `${n} race${n === 1 ? '' : 's'}`,
      },
      groupTotals: {
        easy: ' · totals count easy runs only',
        workouts: ' · totals count workouts only',
        races: ' · totals count races only',
      },
      clear: 'Clear',
      // A sort other than newest, in the filter bar.
      sortedBy: { oldest: 'oldest first', longest: 'longest first', fastest: 'fastest first' } as Record<string, string>,
    },
    sort: {
      label: 'Sort',
      newest: 'Newest',
      oldest: 'Oldest',
      longest: 'Longest',
      fastest: 'Fastest',
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
      copy: 'Copy image',
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
      inZone: (zone: number) => `in Z${zone}`,
      // The headline of an easy run's zones, on a run without a written verdict: "100% easy · Z1–Z2".
      easyZones: (from: number, to: number) => `easy · Z${from}–Z${to}`,
      noZones: 'No heart-rate zones for this run',
      // An interval session's headline, drawn in capitals: "REP PACE · 3 × 8′".
      repPace: (count: number, length: string) => `Rep pace · ${count} × ${length}`,
      target: (pace: string) => `target ${pace}`,
      structure: (set: string, pace: string) => `${set} @ ${pace}`,
      rep: (n: number) => `Rep ${n}`,
      repRange: (fastest: string, slowest: string) => `Fastest ${fastest} · Slowest ${slowest}`,
      // The route's legend on an interval session: the reps are what it marks.
      repsLegend: 'Reps',
      // The switch on an interval session: off, the card is an easy run's.
      showReps: 'Rep pace',
      photo: 'Photo',
      choosePhoto: 'Choose photo',
      photoHint: 'This frame is the exact crop',
      replacePhoto: 'Replace photo',
    },
    stats: {
      distance: 'Distance',
      duration: 'Time',
      pace: 'Avg pace',
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
      // The insight's eyebrow, in the verdict's status colour.
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
      // The tile's name: the distance with its unit.
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
    // The home area's quartiers this run reached into first.
    newGround: {
      title: 'New ground',
      cells: (n: number) => `${n} new cell${n === 1 ? '' : 's'}`,
      complete: 'Complete',
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
    pacePreview: {
      title: 'Pace & heart rate',
      openCharts: 'Charts',
      pace: 'Pace',
      hr: 'HR',
      // Under the lines' left end; the right end is the run's distance.
      start: 'Start',
    },
    dataQuality: {
      estimated: 'Estimated',
    },
    similarRuns: {
      summary: (n: number, rank: number) =>
        `You've run this route ${n} times. This run: ${rank === 1 ? 'your best pace' : `your ${ordinal(rank)}-best pace`}.`,
      thisRun: 'This run',
      record: 'record',
      // Read out for the medal beside the fastest of them.
      fastest: 'Fastest on this route',
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
      wind: (reading: string) => `wind ${reading}`,
    },
    shoe: {
      add: 'Add shoe',
      // One way out to the watch's own app; the brand lives in the URL alone.
      changeInGarmin: (name: string) => `${name} - edit in your watch app`,
      addInGarmin: 'Set the shoe in your watch app',
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
      // The range scale: the pill is the usual range, the tick this run.
      vsUsual: 'vs your usual',
      // Which way is better for the metric. "Shorter" would read as a length, which
      // a bounce in centimetres and a ratio in points are not; lower is the word for all three.
      better: { higher: 'longer is better', lower: 'lower is better' },
      level: 'Right on your usual',
      ratioUnit: 'pt',
      usualRange: (weeks: number) => `Your usual range, last ${weeks} weeks`,
      thisRun: 'This run',
    },
    charts: {
      heartRate: 'Heart rate',
      avg: 'avg',
      max: 'max',
      bestSmoothed: 'best 30 s',
      pace: 'Pace',
      paceUnitHint: '/km, up = faster',
      elevation: 'Elevation',
      cadence: 'Cadence',
      elevationGain: (m: string) => `+${m} m gain`,
      // "At 7.2 km · 41:28 elapsed", the distance in bold.
      scrubAt: { lead: 'At ', km: (km: string) => `${km} km`, elapsed: (elapsed: string) => ` · ${elapsed} elapsed` },
      // The map is Overview's: no dot on it to follow.
      scrubHint: 'Drag across the charts to scrub',
      lineLabel: 'Chart line',
      smoothed: 'Smoothed',
      raw: 'Raw',
    },
    map: {
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      noTrace: 'GPS trace unavailable',
      noTraceHint: 'Available after the next sync',
      mapUnavailable: 'Map unavailable',
      mapUnavailableHint: 'No map token configured',
      routeMap: 'Activity route map',
      // Fullscreen: fit the route again, and the basemap it shows.
      recenter: 'Recenter on the route',
      style: (name: string) => `Map style: ${name}`,
      styles: { dark: 'Dark', light: 'Light' },
      // The floating card's four numbers.
      stats: { distance: 'Distance', time: 'Time', pace: 'Pace', elevation: 'Elev.' },
    },
    splits: {
      title: 'Intervals',
      lapTitle: 'Laps',
      // A run the watch kept as one lap: no laps were pressed, so it is named for what
      // it is and sends the reader to the kilometres.
      wholeRun: 'Whole run',
      // A single lap that does not cover the run is just its first lap.
      lapNumber: (n: number) => `Lap ${n}`,
      noLapsPressed: 'No laps pressed on this run. Km splits show how your pace changed.',
      seeKmSplits: 'See km splits',
      // The footer under the kilometres: the fastest km, and the second half against the first.
      fastest: 'Fastest',
      fastestKm: (km: number, pace: string) => `km ${km} · ${pace}`,
      negativeSplit: (gap: string) => `Negative split ${gap}`,
      positiveSplit: (gap: string) => `Positive split ${gap}`,
      evenSplit: 'Even split',
      viewLabel: 'Splits by',
      partialKm: (km: string) => `final ${km}`,
      repSetLabel: (reps: number, duration: string) => `${reps} × ${duration}`,
      bandLabel: (range: string) => `band ${range}`,
      recoveryAvg: 'Recovery avg',
      // The run's own lap, when the watch typed it as a rep: an easy run before its strides.
      bodyLap: 'Run',
      stridesLabel: 'Strides',
      average: 'Average',
      // The set's summary at the top of its card: three numbers, no sentence.
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
        elev: 'Elev',
        hr: 'HR',
        total: 'Total',
        // The one-lap table's headers.
        lap: 'Lap',
        time: 'Time',
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
    // The compact top bar's, short enough to sit beside the ‹ 2026 › stepper.
    barTitle: 'Goals',
    empty: 'No goals configured yet.',
    back: 'Progress',
    // The ‹ 2026 › stepper's arrows.
    prevYear: 'Previous year',
    nextYear: 'Next year',
    // The stepper as a group, as the compact top bar names it.
    yearStepper: 'Season year',
    // The year's card is "Distance goal"; the year stepper says which year.
    distanceGoal: 'Distance goal',
    ofKm: (goal: string) => `of ${goal} km`,
    reached: (over: string) => `Reached · +${over} km`,
    half: 'Half',
    kmRemaining: (km: number) => `${km} km remaining`,
    goalReached: 'Goal reached!',
    doneHeading: 'Done',
    targetTime: (time: string) => `target ${time}`,
    finish: 'finish',
    noDateSet: 'no date set',
    beatenBy: (gap: string) => `beat by ${gap}`,
    missedBy: (gap: string) => `missed by ${gap}`,
    best: 'Best',
    predictedTag: 'predicted',
    seasonRaces: 'Season Races',
    emptyPbs: (year: number) => `No PBs for ${year} yet.`,
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
      // Under the bar, then the verdict and what the goal needs.
      projectedMark: (km: string) => `Projected ${km}`,
      shortAtPace: (km: string) => `${km} km short at this pace.`,
      overAtPace: (km: string) => `${km} km over at this pace.`,
      onPace: 'On pace for the goal.',
      needs: (needed: string, current: string) => `The goal needs ${needed} km a week; you’re averaging ${current}.`,
      // What closes a shortfall; under the bar, what is left, or what a year over missed by.
      closes: (needed: string, current: string) => `${needed} km a week closes it; you average ${current}.`,
      toGo: (km: string) => `${km} km to go`,
      finalShort: (km: string) => `${km} km short`,
    },
    monthlyVolume: {
      title: 'Monthly volume',
      // The card's caption, its legend and the running month's pace.
      target: (km: string) => `target ${km} km`,
      // Where the plan sets each month's own target.
      targetFromPlan: 'target from your plan',
      hit: 'hit',
      short: 'short',
      running: (month: string, km: string, pace: string) => `${month} · ${km}, ${pace}`,
      pace: {
        ahead: 'ahead of pace',
        on_track: 'on pace',
        behind: 'behind pace',
      },
      km: (actual: string, target: string) => `${actual} / ${target}`,
    },
    season: {
      title: 'Season',
      today: 'Today',
      todayOn: (date: string) => `TODAY · ${date}`,
      blockWeek: (race: string, week: number, weeks: number) => `${race} block wk ${week} of ${weeks}`,
      // A race row: "NOV 29 · IN 62 DAYS", "Target 40:00 · plan week 4 of 12".
      inDays: (days: number) => (days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`),
      target: (time: string) => `Target ${time}`,
      planWeek: (week: number, weeks: number) => `plan week ${week} of ${weeks}`,
      predictedOff: (gap: string) => `predicted · ${gap} off`,
      predictedUnder: (gap: string) => `predicted · ${gap} under`,
      underTarget: (gap: string) => `${gap} under`,
      overTarget: (gap: string) => `${gap} over`,
      targetsHit: (hit: number, total: number) => `${hit} of ${total} race target${total === 1 ? '' : 's'} hit`,
    },
    history: {
      title: 'Past seasons',
      achieved: 'Achieved',
      missed: 'Missed',
      annualKm: (actual: string, target: string) => `${actual} of ${target} km`,
      targetsCount: (achieved: number, total: number) => `${achieved} of ${total} race targets`,
    },
  },

  allTime: {
    title: 'All time',
    back: 'Progress',
    subtitle: (since: string, months: number) => `Since ${since} · ${months} month${months === 1 ? '' : 's'}`,
    km: 'km',
    runs: 'runs',
    hours: 'hours',
    // Years compared by km a month, which is fair to a first year that started late.
    byYear: 'By year',
    perMonth: 'avg km / month',
    yearTotals: (km: string, runs: number) => `${km} km · ${runs} run${runs === 1 ? '' : 's'}`,
    // A first year that started after January.
    fromMonth: (month: string) => `from ${month}`,
    yearLabel: (year: number, perMonth: string) => `${year}: ${perMonth} km a month`,
    monthly: 'Monthly km',
    best: (km: string, month: string) => `best ${km} · ${month}`,
    soFar: (month: string, km: string) => `${month} ${km} so far`,
    longestRun: 'Longest run',
    biggestWeek: 'Biggest week',
    // The label over each total, its unit inline.
    distance: 'Distance',
    time: 'Time',
    hoursUnit: 'h',
    weekOf: (date: string) => `Week of ${date}`,
    // More than three years: the latest three, then the rest behind this row.
    allYears: 'All years',
  },

  shoes: {
    tracked: (km: string) => `${km} km tracked`,
    addLabel: 'Add a pair in your watch app',
    edit: 'Edit shoe',
    editLabel: 'Edit in your watch app',
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
    // One row of four in the km card: short labels.
    heroStats: { runs: 'Runs', avgDistance: 'Avg', avgPace: 'Pace', avgHr: 'HR' },
    lastRuns: 'Last runs',
    neverUsed: 'Never used',
    // Both numbers arrive formatted (formatKm), so 1,375 has its separator.
    kmOf: (total: string, max: string) => `${total} / ${max} km`,
    retired: 'Retired',
    rotationSummary: (activePairs: number, retiredPairs: number, km: string) =>
      `${activePairs} in rotation · ${retiredPairs} retired · ${km} km tracked`,
    // Both keys take an already-formatted date because i18n can never import the formatters.
    lastRunSentence: (date: string) => `Last run ${date}.`,
    limitLine: (km: string, limit: string, runs: number) => `${km} km · limit ${limit} km · ${runs} run${runs === 1 ? '' : 's'}`,
    retiredTitle: (name: string) => `Retired · ${name}`,
    status: {
      ok: 'Good',
      watch: 'Replace soon',
      replace: 'Replace',
    },
    kmLeft: (km: string) => `~${km} km left`,
    // No "~" on the detail hero, where the number is the headline; the list row keeps it.
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
      // Shown only beside an averages claim: what's real, then why it is not a fair fight.
      note: 'Both ran in different blocks – read the difference as the season, not the shoe.',
      delta: 'Δ',
      same: 'same',
      beyondNoise: (metrics: string) => `${metrics} differ beyond measurement noise; the rest is the same runner.`,
      noneBeyondNoise: 'Nothing here differs beyond measurement noise - the rest is the same runner.',
      // Names which pair falls short: "too few runs" alone leaves the reader guessing which column.
      tooFewRunsShoe: (name: string, count: number) => `${name} has ${count} run${count === 1 ? '' : 's'}`,
      tooFewRuns: (shoes: string, minRuns: number) => `${shoes} – form averages need about ${minRuns}.`,
      groups: {
        howMuch: 'How much',
        howItRan: 'How it ran',
      },
      // The unit lives in the label: a 78px label column has no room for "km"/"bpm" per row.
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
      // A pair's page is under Progress, which lists the pairs.
      back: 'Progress',
      retireFromWorkouts: (km: string) => `${km} km · retire from workouts`,
      limitTick: (km: string) => `${km} km limit`,
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
      // One line: "1,000 km ≈ Jan ’27 · 11 wk at 25 km/wk".
      projectedRunOut: (weeklyKm: number, maxKm: string, targetDate: string, weeksRemaining: number) =>
        `${maxKm} km ≈ ${targetDate} · ${weeksRemaining} wk at ${weeklyKm} km/wk`,
      // Past a year out, a forecast off a few runs is noise: the sentence drops the date.
      projectedRunOutFar: (weeklyKm: number, maxKm: string) => `${maxKm} km in over a year at ${weeklyKm} km/wk`,
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
      // Says what each bucket holds, or a shoe's Race or Anaerobic runs never show those words.
      typeShareGrouped: 'Tempo groups threshold; Intervals groups sprint, anaerobic, VO2max and races.',
      whatYouRunIn: {
        title: 'What you run in it',
        summary: (pace: string, hr: number) => `${pace} · ${hr} bpm`,
      },
      whatItWasFor: {
        title: 'What it was for',
        // No pace here: a retired pair's stat row already has "Avg pace".
        summary: (hr: number) => `${hr} bpm avg`,
        // No "your key-session pair": the possessive reads as a superlative, and two
        // retired pairs can land on the same side of this 50% line.
        keySessionPair: (percent: number) => `${percent}% of its distance was tempo, threshold or intervals.`,
        easyPair: (percent: number) => `${percent}% of its distance was base running.`,
      },
      retiredHero: {
        // "Ran out" only for a pair that reached the end of its life; one swapped out early gets its percentage.
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
      // The race, the year card, the records, then a row for each Progress page.
      yearTitle: (year: number) => `${year} distance`,
      // The year card is the way into Goals, not a second copy of its chart.
      goalsSeason: 'Goals & season',
      streakOf: (target: number) => `week streak · ${target}+ runs`,
      runsThisWeek: (runs: number, target: number) => `${runs} of ${target} this week`,
      records: 'Records',
      recordLabels: { '1k': '1 km', '5k': '5 km', '10k': '10 km', half: 'Half' } as Record<string, string>,
      // The record set most recently, tagged while it is new.
      newRecord: 'NEW',
      newRecordLabel: 'new record',
      shoes: 'Shoes',
      consistency: 'Consistency',
      settings: 'Settings',
      allTime: 'All time',
      vsYear: (delta: string, year: number) => `${delta} km vs ${year} to date`,
      // The same dates in both years, from where the history starts.
      vsYearSince: (delta: string, year: number, since: string) => `${delta} km vs ${year} since ${since}`,
      ofGoal: (km: string) => `of ${km} km`,
      // "in 201 days" across from the race's eyebrow.
      inDays: (days: number): string => (days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`),
      // The Target · Predicted · Gap row, then the gap per km under its bar.
      target: 'Target',
      predicted: 'Predicted',
      // Under the race card's time.
      predictedShort: 'predicted',
      targetShort: 'target',
      // The Goals card's verdict, across from the km.
      shortAtPace: (km: string) => `${km} km short at this pace`,
      overAtPace: (km: string) => `${km} km over at this pace`,
      gap: 'Gap',
      perKmToFind: (seconds: number) => `${seconds} s/km to find.`,
      perKmInHand: (seconds: number) => `${seconds} s/km in hand.`,
      onTarget: 'On target.',
      // The bar: where the predicted pace is when the target clock stops.
      reached: (percent: number) => `${percent}% of the course at the target time`,
      noRace: 'No race planned',
      noRecords: 'No records yet',
      // "69 km short at this pace. Needs 41 km/wk, you average 35."
      shortBy: (km: string) => `${km} km short`,
      overBy: (km: string) => `${km} km over`,
      atPace: 'at this pace.',
      onPace: 'On pace for the goal.',
      needs: (needed: string, average: string) => `Needs ${needed} km/wk, you average ${average}.`,
      // The year chart's goal: its end labelled, its dotted line named in the caption.
      goalLabel: (km: string) => `goal ${km}`,
      goalLine: 'Dotted: the steady pace to the goal.',
      // The tiles under the records.
      vo2max: 'VO₂ max',
      vo2Delta: (delta: string) => `${delta} in 12 wk`,
      // The footers as segments, each kept whole on the line.
      thresholdParts: (pace: string | null, lthr: number | null) =>
        [pace ? `Threshold ${pace} /km` : null, lthr ? `LTHR ${lthr} bpm` : null].filter((part): part is string => part !== null),
      // "Last 12 weeks · 203 active days in 12 months · 4-week streak", the figures in ink.
      consistencyWindow: 'Last 12 weeks',
      consistencyDays: (days: number) => ({ lead: '', value: String(days), tail: ` active day${days === 1 ? '' : 's'} in 12 months` }),
      consistencyStreak: (weeks: number) => ({ lead: '', value: `${weeks}-week`, tail: ' streak' }),
      allPairs: 'All pairs',
      since: (date: string) => `since ${date}`,
      distance: 'Distance',
      runsLabel: 'Runs',
      time: 'Time',
      hours: 'h',
      openYears: 'Kilometres by year',
      // The Explored card: how much of the home area has been run, and the next quartier to run.
      explored: 'Explored',
      exploredComplete: (done: number, total: number) => `${done} of ${total} quartier${total === 1 ? '' : 's'} complete`,
      // "Next: Borny · 12%", the name in ink. `pct` is formatted ("12%").
      exploredNext: (name: string, pct: string) => ({ lead: 'Next: ', name, tail: ` · ${pct}` }),
      exploredAllComplete: (total: number) => (total === 1 ? 'Your quartier is complete' : `All ${total} quartiers complete`),
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
      streakDetail: 'Still going · a run logged every week since',
      record: (label: string) => `${label} record`,
      firstActivity: 'First step',
      firstActivityDetail: (km: string) => `Where it all began · ${km} km`,
      lifetimeDistance: (km: string) => `${km} km lifetime`,
      // Marathon equivalents, not races.
      lifetimeDistanceDetail: (marathons: number) => `≈ ${marathons} marathon distances`,
      // No globe glyph: the row's own icon says it.
      lifetimeDistanceWorldTour: 'A full trip around the Earth',
      activityCount: (n: number) => `${ordinal(n)} run`,
      activityCountDetail: (km: string) => `${km} km lifetime`,
    },
    trainingZones: {
      title: 'Training zones',
      viewLabel: 'Time in zones over',
      week: '1W',
      fourWeeks: '4W',
      weekSpoken: 'This week',
      fourWeeksSpoken: 'Last 4 weeks',
      columnZone: 'Zone',
      columnPace: 'Pace /km',
      columnHr: 'Heart rate',
      columnHrShort: 'HR',
      columnTime: 'Time',
      inZonesWeek: (duration: string) => `${duration} in zones this week`,
      inZonesRecent: (duration: string) => `${duration} in zones over the last 4 weeks`,
      noSessionsThisWeek: 'No sessions logged yet.',
      noSessionsRecent: 'No sessions logged in these 4 weeks.',
      // The headline, "Hard 4% · in range": Analytics > Intensity's verdict, lower case after the dot.
      hard: (pct: string) => `Hard ${pct}`,
      verdict: { inRange: 'in range', tooModerate: 'too much moderate', tooHard: 'too much hard' },
      // The verdict's own target, Analytics' 80/20 (see intensityMix).
      totalLine: (duration: string) => `${duration} total · aim for 80 / 20`,
      soFar: 'this week so far',
      estimatedPaces: (effort: string, date: string) => `Paces estimated by VDOT from your ${effort} on ${date}: the watch gives no threshold pace.`,
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
    distances: {
      '1k': '1K',
      '1mile': '1 Mile',
      '5k': '5K',
      '10k': '10K',
      half: 'Half',
      marathon: 'Marathon',
      longest: 'Longest Run',
    } as Record<string, string>,
    /** A shorter name for a record on a run's row badge, where the run's own name must fit beside it. */
    badgeLabels: { longest: 'Longest Run' } as Record<string, string>,
    raceTag: 'race',
    trainingTag: 'training',
    notYetRun: 'Not yet run',
    segmented: {
      best: 'Best times',
      milestones: 'Milestones',
      routes: 'Routes',
    },
    recurring: {
      showAll: (n: number) => `Show all ${n} routes`,
      runCount: (n: number) => `${n} run${n === 1 ? '' : 's'}`,
      best: 'Best',
      // What a bar is: one bar per run, the last six.
      trailKey: 'Pace per run · taller = faster',
      legendBest: 'best',
      legendLatest: 'latest',
      bestPace: (pace: string) => `best ${pace}`,
      lastPace: (pace: string) => `last ${pace}`,
      newBest: 'new best',
      // A route whose destination no place name came back for.
      unnamed: (n: number) => `Route ${n}`,
      // Named by where it goes, not the start street every run shares.
      named: {
        loop: (place: string) => `${place} loop`,
        'out-back': (place: string) => `${place} out & back`,
        point: (place: string) => `To ${place}`,
      },
      rename: 'Rename this route',
    },
    milestones: {
      nextUp: 'Next up',
      // Runs or km, the unit the milestone's own title already names.
      toGo: (n: string) => `${n} to go`,
    },
    noRecordYet: 'No record yet',
    cols: { distance: 'Distance', best: 'Best', predicted: 'Predicted' },
    // A gap under a minute: "5s".
    gapSeconds: (s: number) => `${s}s`,
    faster: (gap: string) => `${gap} faster`,
    slower: (gap: string) => `${gap} slower`,
    // The prediction is the best to the second: run already at potential.
    atPotential: 'at potential',
    allEfforts: (distance: string) => `All ${distance} efforts ›`,
    topEfforts: (n: number, distance: string) => `Top ${n} ${distance} efforts ›`,
    findRace: (distance: string) => `Find a ${distance.toLowerCase()} ›`,
  },

  pbAlerts: {
    off: (diff: string) => `${diff} off your PR`,
  },

  // The pushes the phone shows outside the app. Numbers arrive formatted, so the
  // decimal follows the locale.
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
      body: (hours: number) => `Your last sync was ${hours}h ago - check that sync is still running.`,
    },
    newActivity: { title: (name: string) => `New activity: ${name}` },
    // Monday's look back, two short lines: what fits an iPhone notification unexpanded.
    weeklyDigest: {
      title: 'Last week',
      km: (ran: string) => `${ran} km`,
      kmOfPlan: (ran: string, plan: string) => `${ran} of ${plan} km`,
      quality: (done: number) => `${done} quality session${done === 1 ? '' : 's'}`,
      qualityOfPlan: (done: number, planned: number) => `${done} of ${planned} quality sessions`,
      restingHr: (bpm: number, change: string) => `Resting HR ${bpm} (${change})`,
      focus: (focus: string) => `This week: ${focus}`,
    },
    weeklyGoal: {
      title: 'Weekly goal check-in',
      status: { ahead: 'ahead of pace', on_track: 'on track', behind: 'behind pace' },
      body: (status: string, rate: string, needed: string) => `You're ${status} at ${rate} km/week (need ${needed} km/week).`,
    },
    workflowFailed: {
      title: (workflow: string) => `${workflow} failed`,
      body: (runUrl: string) => `Open the run: ${runUrl}`,
    },
    // The nightly digest of what failed on a phone, never one push per error: anyone may post an error.
    clientErrors: {
      title: (count: number) => `${count} error${count === 1 ? '' : 's'} on your phone`,
      body: (message: string) => `Latest: ${message}. Settings → Diagnostics has them all.`,
    },
    exploreComplete: {
      title: (name: string) => `${name} explored`,
      body: (pct: string, done: number, total: number) => `${pct} of its streets run. ${done} of ${total} quartiers complete.`,
    },
    tokenExpiring: {
      names: { dataActions: 'the data token (GitHub Actions)', dataVercel: 'the data token (Vercel)', syncVercel: 'the Sync button token (Vercel)' },
      title: (days: number) => (days <= 0 ? 'A GitHub token expires today' : `A GitHub token expires in ${days} day${days === 1 ? '' : 's'}`),
      body: (names: string) => `Renew ${names} before the sync stops: GitHub → Settings → Developer settings → Fine-grained tokens.`,
    },
  },

  race: {
    back: 'Progress',
    predicted: 'Predicted',
    target: 'Target',
    best: 'Best',
    standTitle: 'Where you stand',
    toFind: (gap: string) => `${gap} to find.`,
    inHand: (gap: string) => `${gap} in hand.`,
    perWeek: (seconds: number, weeks: number) => (weeks === 1 ? `About ${seconds} s in the week left.` : `About ${seconds} s a week over the ${weeks} weeks left.`),
    trendTitle: 'Prediction, last 12 weeks',
    trendChange: (change: string, weeks: number, perWeek: string | null) =>
      `${change} in ${weeks} week${weeks === 1 ? '' : 's'}${perWeek ? `, ${perWeek} a week` : ''}.`,
    trendFlat: (weeks: number) => `Unchanged in ${weeks} week${weeks === 1 ? '' : 's'}.`,
    pacingTitle: 'Pacing',
    pacingCaption: 'Even pace: the clock at each split if you hold one pace.',
    split: 'Split',
    pace: 'Pace',
    finish: 'Finish',
    none: 'No race coming up. Add one in Garmin Connect and it shows here after the next sync.',
  },

  nextRace: {
    // A word joiner after the hyphen keeps "D-64" on one line; the font has no
    // U+2011, which would draw from a fallback face.
    countdown: (days: number) => `D-\u2060${days}`,
    today: 'Today',
    tomorrow: 'Tomorrow',
  },

  // The 12-week checkpoint: one cycle set against the 12 weeks before it.
  checkpoint: {
    title: '12-week checkpoint',
    cycle: (n: number) => `Cycle ${n}`,
    lastWeeks: 'Last 12 weeks',
    against: (current: string, previous: string) => `${current} vs ${previous}`,
    weekOf: (week: number) => `Week ${week} of 12`,
    complete: (n: number) => `Cycle ${n} complete`,
    dueIn: (date: string, days: number) =>
      days <= 0 ? 'Checkpoint today' : days === 1 ? 'Checkpoint tomorrow' : days < 14 ? `Checkpoint ${date} · in ${days} days` : `Checkpoint ${date} · in ${Math.round(days / 7)} weeks`,
    reached: (date: string) => `Checkpoint ${date}`,
    nextBegan: (n: number, date: string) => `Cycle ${n} began ${date}; it takes over here next week.`,
    rolling: 'No coach plan to count cycles from, so this sets your last 12 full weeks against the 12 before them.',
    tooEarly: 'No week of this cycle is over yet: the weekly figures start on Monday.',
    better: (n: number) => `${n} better`,
    worse: (n: number) => `${n} worse`,
    level: (n: number) => `${n} level`,
    perWeekSoFar: (weeks: number) => (weeks === 1 ? 'per week · 1 full week so far' : `per week · ${weeks} full weeks so far`),
    perWeek: 'per week',
    vs: (value: string) => `vs ${value}`,
    notEnough: 'Not enough data',
    nothingBefore: 'None before',
    lastReading: (date: string) => `Last reading ${date}`,
    soFar: (minutes: number, sessions: number) => `${minutes} min in ${sessions} session${sessions === 1 ? '' : 's'} so far`,
    noCheck: 'No check this cycle',
    vdot: (value: string) => `VDOT ${value}`,
    sections: {
      volume: {
        title: 'Volume',
        about: 'Kilometres and runs a week. While a cycle runs, only its weeks already over count, so a week under way never reads as a light one.',
      },
      threshold: {
        title: 'Controlled threshold',
        about: 'Time in the repetitions of your controlled threshold sessions, read from each run’s laps, and the pace guide each repetition length was run to. The heart-rate ceiling stays put, so a faster guide under it is the progress.',
      },
      efficiency: {
        title: 'Aerobic efficiency',
        about: 'Efficiency is the distance you cover per heartbeat on easy runs. Easy HR is the median heart rate of easy runs within 10 s/km of the pace named. Both take the heat cost of warm days back out, as Analytics does: lower heart rate, higher efficiency is fitter.',
      },
      markers: {
        title: 'Fitness markers',
        about: 'The latest 5K check of each cycle, a 5K race or a time trial, with the VDOT it implies, and Garmin’s VO₂max and threshold estimates as they stood at the end of each cycle. Threshold HR has no better direction, so it is shown but not scored.',
      },
      recovery: {
        title: 'Recovery and load',
        about: 'Resting HR is the mean of the cycle’s daily readings, leaving out days the watch was only worn to run. Fitness is your 42-day training load at the end of the cycle, or today while it runs.',
      },
    },
    metrics: {
      distance: 'Distance per week',
      runs: 'Runs per week',
      thresholdTime: 'Time in reps per week',
      guide: { long: 'Pace guide · long reps', medium: 'Pace guide · medium reps', short: 'Pace guide · short reps' },
      efficiency: 'Efficiency, heat-adjusted',
      easyHr: (pace: string) => `Easy HR at ${pace} /km`,
      easyHrNoPace: 'Easy HR at a set pace',
      fiveK: '5K check',
      vo2max: 'VO₂max',
      thresholdPace: 'Threshold pace',
      lthr: 'Threshold HR',
      restingHr: 'Resting HR',
      fitnessEnd: 'Fitness at cycle end',
      fitnessToday: 'Fitness today',
    },
    units: { runs: 'runs', perBeat: 'm/beat' },
    tile: {
      inProgress: (week: number, date: string) => `Week ${week} of 12 · checkpoint ${date}`,
      complete: (n: number) => `Cycle ${n} complete: time to review it`,
      rolling: 'Your last 12 weeks against the 12 before',
    },
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
    footnote: 'Training load over the last 4 weeks split by intensity, against the ranges your watch personalises from your history. The marker is where you sit; the green zone is the target.',
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
    // Under the day card.
    nextKeySession: 'Next key session',
    prevPeriod: 'Previous',
    nextPeriod: 'Next',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    switcher: { week: 'Week', month: 'Month' },
    planned: 'Planned',
    easyEffortLabel: 'Z2 easy',
    openPlanner: 'Open the weekly planner',
    type: 'Type',
    races: 'Races',
    targetPace: (pace: string) => `target ${pace}`,
    // One reading of a session for Today, Plan and the bar (workoutSummary).
    session: {
      stridesTitle: (bodyMin: number, reps: number, rep: string) => `Easy ${bodyMin} min + ${reps} × ${rep} strides`,
      seconds: (s: number) => `${s}s`,
      withRecovery: (reps: string, recovery: string) => `${reps} · ${recovery} rec`,
      repsOnly: (n: number) => `${n} reps`,
      // The coach's own range, which can be narrower than the Z2 zone on purpose.
      easyPace: (range: string) => `easy target ${range}`,
      stridesPace: (pace: string) => `strides ${pace}`,
      targetPace: (range: string) => `target ${range}`,
      // A one-step session's targets, listed rather than drawn.
      paceTarget: 'Pace',
      hrTarget: 'Heart rate',
      hrTargetZone: (zone: number) => `Heart rate · Z${zone}`,
      hrCap: (bpm: number) => `≤ ${bpm}`,
      // Opens the map's route generator with the session's distance.
      findRoute: 'Find a route',
    },
    // The rest day on one line, then the week's sessions still to come.
    restCard: {
      eyebrow: 'Rest',
      title: 'Rest day',
      next: (weekday: string) => `Next: ${weekday}`,
    },
    comingUp: {
      title: 'Coming up',
      hint: 'tap to open',
    },
    // Plan's week: the phase card, the week row, the selected day.
    kinds: { easy: 'Easy', long: 'Long run' },
    typeLetters: {
      easy: 'E',
      long: 'L',
      Sprint: 'S',
      Anaerobic: 'A',
      VO2Max: 'V',
      Threshold: 'T',
      Tempo: 'Tm',
      Base: 'E',
      Race: 'R',
    } as Record<string, string>,
    phase: {
      weekOf: (total: number) => ({ before: 'Week', after: `of ${total}` }),
      generalShort: 'General prep',
      raceInWeeks: (race: string, weeks: number) => `${race} in ${weeks} wk`,
      raceInDays: (race: string, days: number) => (days === 0 ? `${race} today` : days === 1 ? `${race} tomorrow` : `${race} in ${days} days`),
    },
    weekRow: {
      kmOf: (km: string) => `/ ${km} km`,
    },
    // Plan's month: the phase labels, the key and the summary card.
    month: {
      phaseEnds: (phase: string, date: string) => `${phase} · ends ${date}`,
      phaseWeeks: (phase: string, n: number) => `${phase} · ${n} week${n !== 1 ? 's' : ''}`,
      // The legend's one blue entry.
      easyLong: 'Easy / Long',
      phaseWeek: (phase: string, n: number, total: number) => `${phase} · week ${n} of ${total}`,
      kmOf: (ran: string, plan: string) => `${ran} of ${plan} km`,
      // Where the plan starts partway through the month, the comparison is over the
      // days it covers, and the month's own total is said beside it.
      planCovers: (from: string, to: string) => `plan covers ${from} – ${to}`,
      monthTotal: (km: string) => `${km} km this month`,
      nextKey: 'Next key session',
      weekLabel: (monday: string, km: string) => `Week of ${monday} · ${km}`,
    },
    daySelector: 'Days of the week',
    steps: {
      warmup: 'Warm-up',
      cooldown: 'Cool-down',
      easy: 'easy',
      minutes: (m: number) => `${m}′`,
      reps: (n: number, rep: string, kind: string) => `${n} × ${rep} ${kind}`,
      strides: (n: number, rep: string) => `${n} × ${rep} strides`,
      repsShort: (n: number, rep: string) => `${n}×${rep}`,
    },
    dayCard: {
      // Today › missed day: a miss marked as skipped on purpose.
      skipped: 'Skipped',
      markSkipped: 'Skipped (sick / rest)',
      undoSkip: 'Undo',
      planned: 'Planned',
      done: 'Done',
      notPlanned: 'Nothing planned',
      asPlanned: 'As planned',
      viewActivity: 'View activity',
      viewNamed: (name: string) => `View ${name}`,
    },
    // A session row's target line: its zone, its paces, its recovery.
    row: {
      pace: (range: string) => `${range} /km`,
      recovery: (clock: string) => `${clock} rec`,
    },
    raceFooter: {
      weeksIn: (done: number, total: number) => `${done}/${total}`,
      targetTime: (clock: string) => `target ${clock}`,
      primaryTarget: 'primary',
      tuneUp: 'tune-up',
      blockEndsHere: 'block end',
      weeksInLabel: 'weeks in',
    },
    weekPurpose: {
      prePlan: 'Pre-plan',
      planPhase: {
        base: 'Base',
        build: 'Build',
        peak: 'Peak',
        taper: 'Taper',
        raceDay: 'Race day',
      },
      weekOfTarget: (done: number, total: number) => `week ${done} of ${total}`,
      generalPreparation: 'General preparation',
      weekN: (n: number) => `week ${n}`,
    },
  },

  coaching: {
    garminOutOfDate: 'Watch data out of date',
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
    controlledRun: {
      title: 'Controlled threshold',
      repClass: { long: 'Long reps', medium: 'Medium reps', short: 'Short reps' },
      verdicts: {
        under: 'Well under target',
        on_target: 'On target',
        over: 'Over target',
        off_guide: 'Off the pace guide',
        unreadable: 'Not read',
      },
      verdictDetail: {
        under: 'Every rep settled well under target at the pace guide.',
        on_target: 'Every rep settled at or under target, clear of the ceiling.',
        over: 'A rep settled above target or touched the ceiling.',
        off_guide: 'The reps ran away from the pace guide, so they say nothing about it.',
        unreadable: 'No laps or heart rate to read the reps from.',
      },
      band: (target: number, ceiling: number) => `Target ${target} · ceiling ${ceiling}`,
      cols: { rep: '#', pace: 'Pace', hr: 'HR', peak: 'Peak' },
      footnote: (minute: number, guide: string) => `Heart rate lags, so each rep is read from minute ${minute}. Pace guide ${guide} /km.`,
    },
    readout: {
      title: 'Coach',
      triggers: { bootstrap: 'new block', post_activity: 'after a run', weekly_review: 'weekly review', autoregulation: 'autoregulation' },
      lastRun: 'Last run',
      threshold: 'Threshold',
      paceGuide: 'Pace guide',
      guideChange: (from: string, to: string) => `${from} → ${to} /km`,
      proposed: (reps: string) => `${reps} · proposed, not applied.`,
      easyRuns: 'Easy runs',
      fatigue: (bpm: number) => `Heart rate ${bpm} bpm above your normal: a lighter week is proposed.`,
      fitnessCheck: '5K check',
      check: (date: string, pace: string, threshold: string) => `${date} · ${pace} · threshold ${threshold}`,
      checkGuides: 'The next block’s guides come from it.',
      nextKey: 'Next key',
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
