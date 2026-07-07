// French UI strings. Mirrors the shape of `en.ts` (the reference locale) and is
// type-checked against it via `satisfies Strings`. Activated with
// NEXT_PUBLIC_LOCALE=fr (see `index.ts`).
//
// Conventions:
// - Plain strings for static copy.
// - Functions for interpolated / pluralized copy (French: 0 and 1 are singular).
// - Pure number/date formatting stays in `@/lib/formatters`; only human-readable
//   words and units live here.

import type { ActivityType } from '@/domain/activity/types'
import type { RankTier } from '@/domain/athlete/rank'
import type { Strings } from './index'

export const fr = {
  // Locale tag used by Intl-based formatters (dates, numbers).
  locale: 'fr-FR',

  brand: {
    namePrefix: 'Run',
    nameSuffix: 'Omics',
    // Version number is injected from package.json (see @/lib/version); only the
    // display format lives here so it isn't duplicated across translation files.
    version: (v: string) => `v${v}`,
  },

  nav: {
    items: {
      dashboard: 'Accueil',
      activities: 'Activités',
      calendar: 'Calendrier',
      analytics: 'Analyses',
      heatmap: 'Heatmap',
      profile: 'Profil',
      settings: 'Réglages',
    },
  },
  meta: {
    description: 'Votre tableau de bord d’entraînement running personnel - stats, cartes, tendances.',
  },

  theme: {
    toggle: 'Changer de thème',
  },

  units: {
    km: 'km',
    bpm: 'bpm',
    spm: 'pas/min',
    m: 'm',
    ms: 'ms',
    mm: 'mm',
    percent: '%',
    kcal: 'kcal',
    perKm: '/km',
    minPerKm: 'min/km',
    celsius: '°C',
    hour: 'h',
    day: 'j',
    elevation: 'm D+'
  },

  common: {
    viewAll: 'Tout voir',
    sessions: (n: number) => `${n} séance${n > 1 ? 's' : ''}`,
    runs: (n: number) => `${n} sortie${n > 1 ? 's' : ''}`,
    close: 'Fermer',
    refreshing: 'Actualisation...',
  },

  pwa: {
    updateAvailable: 'Une nouvelle version de RunOmics est prête.',
    refresh: 'Actualiser',
  },

  pages: {
    dashboard: {
      title: 'Tableau de bord',
      greeting: {
        morning:   'Bonjour',
        afternoon: 'Bon après-midi',
        evening:   'Bonsoir',
        weekDate:  (week: number, date: string) => `Semaine ${week} · ${date}`,
      },
      subtitle: (week: number, sessions: number, year?: number) =>
        `Semaine ${week}${year !== undefined ? ` ${year}` : ''} · ${sessions} séance${sessions > 1 ? 's' : ''}`,
      // Abbreviated: shares its header row with the week-load pill, which is
      // wider in French ("Semaine très légère") and would truncate the title.
      weekTitle: (week: number, year?: number) =>
        `Sem. ${week}${year !== undefined ? ` ${year}` : ''}`,
    },
    activities: {
      title: 'Activités',
    },
    calendar: {
      title: 'Calendrier',
    },
    records: {
      title: 'Records',
      subtitle: 'Records personnels et prédictions de course',
      back: 'Profil',
    },
    map: {
      title: 'Heatmap de course',
      back: 'Activités',
      routes: (n: number) => `${n} parcours`,
      zones: 'Zones',
      allYears: 'Toutes les années',
      allTypes: 'Tous les types',
      types: 'Types',
      fullscreen: 'Plein écran',
      exitFullscreen: 'Quitter le plein écran',
      worldView: 'Vue monde',
      exitWorldView: 'Quitter la vue monde',
      worldViewHint: 'Touchez une zone pour l’explorer',
      intensity: 'Intensité',
      less: 'Rare',
      more: 'Fréquent',
      passesOne: '1 passage',
      passes: (n: number) => `${n} passages`,
      noRoutes: 'Aucun parcours pour ce filtre',
      closeCard: 'Fermer',
    },
    shoes: {
      title: 'Chaussures',
      subtitle: 'Kilométrage et usure par paire',
      back: 'Profil',
    },
    milestones: {
      title: 'Jalons',
      subtitle: 'Paliers de distance, séries et records personnels dans le temps',
      back: 'Profil',
    },
    profile: {
      title: 'Profil',
    },
    notFound: {
      code: '404',
      heading: 'Cette page est partie courir et n’est jamais revenue.',
      sub: 'L’itinéraire que vous cherchez n’existe pas.',
      back: 'Retour à l’accueil',
    },
    error: {
      heading: 'Une foulée de travers.',
      sub: 'Une erreur inattendue est survenue au chargement de cette page.',
      retry: 'Réessayer',
      back: 'Retour à l’accueil',
    },
    settings: {
      title: 'Réglages',
      subtitle: 'Apparence, notifications et export de données.',
      back: 'Profil',
    },
  },

  settings: {
    appearance: {
      title: 'Apparence',
      themeLabel: 'Thème',
      light: 'Clair',
      auto: 'Auto',
      dark: 'Sombre',
      auroraNote: 'L’aurore s’adapte à l’accent sélectionné.',
    },
    accent: {
      title: 'Couleur d’accent',
      subtitle: 'Choisissez l’ambiance - appliqué instantanément, sans compte.',
      options: {
        nature:      { label: 'Nature', description: 'Vert sentier apaisant' },
        performance: { label: 'Performance', description: 'Bleu course électrique' },
        impact:      { label: 'Impact', description: 'Rouge ligne d’arrivée' },
        motivation:  { label: 'Motivation', description: 'Orange plein d’énergie' },
        endurance:   { label: 'Endurance', description: 'Violet ultra profond' },
        silver:      { label: 'Argent', description: 'Monochrome data pur' },
      },
    },
    auth: {
      signIn: 'Se connecter avec Google',
      signOut: 'Se déconnecter',
      switchAccount: 'Se déconnecter et essayer un autre compte',
      accessDenied: 'Accès refusé - cette page est réservée au propriétaire du site.',
      signingIn: 'Connexion...',
      error: 'Connexion impossible, veuillez réessayer.',
      notConfigured: "La connexion n'est pas disponible pour le moment.",
    },
    athlete: {
      title: 'Profil athlète',
      lthr: 'LTHR (bpm)',
      lthrHint: 'Fréquence cardiaque au seuil lactique',
      thresholdPace: 'Allure seuil',
      thresholdPaceHint: 'min:ss par km, ex. 4:14',
      thresholdPower: 'Puissance seuil (W)',
      thresholdPowerHint: 'Puissance seuil fonctionnelle',
      vma: 'VMA (km/h)',
      vmaHint: 'Vitesse maximale aérobie',
      placeholders: {
        lthr: '177',
        thresholdPace: '4:14',
        thresholdPower: '339',
        vma: '16',
      },
    },
    actions: {
      save: 'Enregistrer',
      saving: 'Enregistrement...',
      saved: 'Enregistré',
      error: 'Erreur à l’enregistrement, réessayez.',
      confirmQuestion: 'Sûr ?',
      confirmYes: 'Oui',
      confirmCancel: 'Annuler',
    },
    dataSource: {
      title: 'Source de données',
      garmin: 'Garmin Connect',
      syncMethod: 'Synchronisation automatique une fois par jour',
    },
    dataExport: {
      csv: 'Exporter les activités (.csv)',
      exporting: 'Export en cours...',
    },
    offlineCache: {
      clear: 'Vider le cache hors ligne',
      cleared: 'Cache hors ligne vidé.',
      failed: 'Impossible de vider le cache hors ligne.',
    },
    notifications: {
      title: 'Notifications push',
      denied: 'Les notifications sont bloquées - autorisez-les dans les réglages de votre navigateur.',
      unsupported: 'Les notifications push ne sont pas prises en charge par ce navigateur.',
      error: 'Impossible de mettre à jour les réglages de notification, réessayez.',
      types: {
        training: {
          title: 'Rappels d’entraînement',
          subtitle: 'Point hebdomadaire sur votre objectif kilométrique.',
        },
        shoes: {
          title: 'Alertes d’usure des chaussures',
          subtitle: 'Avertissement à 70 % et 90 % d’usure.',
        },
        races: {
          title: 'Prédictions de course',
          subtitle: 'Détection automatique de nouveaux RP potentiels.',
        },
      },
    },
  },

  dashboard: {
    recentActivities: {
      title: 'Activités récentes',
    },
    heatmap: {
      title: 'Activité',
      window: '· 12 mois',
      days: 'jours',
      less: 'Moins',
      more: 'Plus',
      restDay: 'Repos',
      day: (km: number, runs: number) =>
        `${km} km · ${runs} sortie${runs > 1 ? 's' : ''}`,
      months: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
      weekdays: ['Lun', '', 'Mer', '', 'Ven', '', ''],
    },
    weeklyVolume: {
      title: 'Volume hebdo',
    },
    trainingMix: {
      title: 'Mix d’entraînement',
      other: 'Autre',
    },
    trainingLoad: {
      title: 'Charge d’entraînement',
      window: '· 90 derniers jours',
      fitness: 'Condition',
      fatigue: 'Fatigue',
      form: 'Forme',
      status: {
        fresh: 'Frais',
        neutral: 'Neutre',
        building: 'Progression',
        overreaching: 'Surcharge',
      },
      footnote:
        'Condition = charge moyenne sur 42 j (CTL) · Fatigue = 7 j (ATL) · Forme = Condition - Fatigue (TSB).',
    },
    vo2maxChart: {
      title: 'VO₂max',
      unit: 'ml/kg/min',
      footnote: 'Estimation VO₂max Garmin',
    },
    raceCockpit: {
      title: 'Projection de forme',
      titleWithRace: (name: string) => `Projection de forme · ${name}`,
      daysToTarget: (days: number) => `J+${days}`,
      projectedForm: 'Forme projetée',
      today: 'Aujourd’hui',
      projected: 'Projeté',
      verdict: {
        'on-track': 'Sur les rails',
        'ease-off': 'Fatigue résiduelle - allège',
        'peak-ready': 'En bonne voie pour un pic de forme',
        'build-more': 'Risque de sous-affûtage - continue de construire',
      },
      footnote: 'Estimé à partir des séances planifiées - la forme réelle dépendra de ce que tu cours vraiment.',
    },
    weeklyDigest: {
      reviewTitle: 'Ta semaine en revue',
      newPr: (label: string, time: string) => `Nouveau record ${label} : ${time}`,
      statusFresh: (tsb: number) => `Zone fraîche (Forme +${tsb}) - bonne fenêtre pour une séance dure`,
      statusOverreaching: (tsb: number) => `Surcharge (Forme ${tsb}) - envisage de lever le pied`,
      acwrWatch: (acwr: number) => `Ratio charge aiguë/chronique à ${acwr.toFixed(2)} - hors de la zone sûre 0,8-1,3`,
      monotonyWatch: (monotony: number) => `Monotonie à ${monotony.toFixed(1)} - ta semaine manque de variété de charge`,
      hardShareWatch: (hardPct: number) => `${Math.round(hardPct)}% de ton temps en effort dur - au-dessus de la règle 80/20`,
    },
    syncStatus: {
      synced: (relative: string) => `Synchronisé ${relative}`,
      justNow: 'à l’instant',
      minutesAgo: (m: number) => `il y a ${m} min`,
      hoursAgo: (h: number) => `il y a ${h} h`,
      daysAgo: (d: number) => `il y a ${d} j`,
    },
    todayHero: {
      eyebrow: 'Aujourd’hui',
      plannedSession: 'Séance planifiée',
      race: 'Course',
      load: 'Charge',
      daysToRace: (days: number) => `J-${days}`,
    },
    weeklyStreak: {
      weeksInARow: (weeks: number) => `${weeks} semaines d’affilée`,
      longestStreak: (weeks: number) => `Plus longue série : ${weeks} semaines`,
      weeklyGoal: 'Objectif hebdomadaire',
      kmRemaining: (km: number) => `Plus que ${km} km pour boucler la semaine`,
      goalReached: 'Objectif hebdomadaire atteint',
    },
    celebration: {
      eyebrow: 'Nouveau record personnel',
      later: 'Plus tard',
      viewAndShare: 'Voir et partager',
    },
    onboarding: {
      message: 'Ta forme, ta séance planifiée et le compte à rebours course sont dans la carte ci-dessus - ta heatmap de course est plus bas sur la page.',
    },
  },

  trainingStatus: {
    title: 'Statut d’entraînement',
    status: {
      productive: 'Productif',
      fresh: 'Frais',
      overreaching: 'Surcharge',
      recovery: 'Récupération',
      detraining: 'Désentraînement',
    },
    risk: {
      low: 'Risque faible',
      moderate: 'Risque modéré',
      high: 'Risque élevé',
    },
    loadTrend: {
      building: 'En progression',
      maintaining: 'Maintien',
      tapering: 'Affûtage',
      detraining: 'En baisse',
    },
    metrics: {
      fitness: 'Condition',
      fatigue: 'Fatigue',
    },
  },

  analytics: {
    title: 'Analyses',
    season: (year: number) => `Saison ${year}`,
    allTimeChip: 'Tout',
    allTimeTitle: 'Historique complet',
    yearGroupLabel: 'Année',
    windowGroupLabel: 'Fenêtre',
    period: {
      chip: (n: number) => `${n} sem`,
      title: (n: number) => (n === 1 ? 'Cette semaine' : `${n} dernières semaines`),
      vsPrevious: (n: number) => (n === 1 ? 'vs la semaine précédente' : `vs les ${n} semaines précédentes`),
      distancePct: (p: number) => `${p >= 0 ? '+' : ''}${p}% km`,
      sessionsPct: (p: number) => `${p >= 0 ? '+' : ''}${p}% sorties`,
      paceFaster: (s: number) => `allure facile -${s}s/km`,
      paceSlower: (s: number) => `allure facile +${s}s/km`,
      lastWeek: 'Semaine dernière',
      weekOf: (date: string) => `Semaine du ${date}`,
      prevWeek: 'Semaine précédente',
      nextWeek: 'Semaine suivante',
      jumpToCurrentWeek: 'Cette semaine',
    },
    tabs: {
      volume: 'Volume',
      performance: 'Performance',
      physiology: 'Physiologie',
      seasons: 'Saisons',
    },
    stats: {
      distance: 'Distance',
      time: 'Temps',
      sessions: 'Séances',
      elevation: 'Dénivelé',
      avgPerWeek: 'Moy. / semaine',
      yearsTracked: 'Années suivies',
      calories: 'Calories',
      kcalPerWeek: 'Kcal / semaine',
      elevationValue: (m: number) => `+${m} m`,
      caloriesValue: (k: number) => `${k}k kcal`,
    },
    charts: {
      monthlyVolume: { title: 'Volume' },
      paceTrend: {
        title: 'Tendance d’allure',
        easy: 'Facile',
        workout: 'Qualité',
        footnote: 'Allure moyenne pondérée par la distance. Plus bas = plus rapide.',
        explains: {
          improving: (sec: number) => `Allure facile en progrès - ${sec}s/km plus rapide qu’en début de période`,
          stable: 'Allure facile stable sur la période',
          slowing: (sec: number) => `Allure facile en recul de ${sec}s/km - possible fatigue ou gros volume`,
        },
      },
      efficiency: {
        title: 'Efficacité aérobie',
        unit: 'm/min·bpm',
        footnote: 'Vitesse par battement sur les sorties faciles (m/min ÷ FC moy.). Plus haut = meilleure forme aérobie.',
        explains: {
          improving: (d: string) => `En progrès +${d} - vous produisez plus de vitesse par battement`,
          stable: 'Efficacité aérobie stable',
          declining: 'En baisse - ajoutez des sorties faciles ou surveillez une fatigue accumulée',
        },
      },
      zones: {
        title: 'Temps en zones',
        labels: {
          1: 'Échauffement',
          2: 'Facile',
          3: 'Aérobie',
          4: 'Seuil',
          5: 'Maximum',
        } as Record<number, string>,
      },
      hrTrend: {
        title: 'FC moyenne',
        footnote: 'FC moyenne pondérée par la durée, sorties faciles vs séances de qualité.',
      },
      cadence: {
        title: 'Cadence',
        unit: 'pas/min',
        footnote: 'Cadence moyenne pondérée par la durée (pas/min).',
      },
      runningForm: {
        title: 'Technique de course',
        metrics: {
          groundContact: 'Contact au sol',
          verticalOscillation: 'Osc. verticale',
          strideLength: 'Longueur de foulée',
        } as Record<string, string>,
        unit: {
          groundContact: 'ms',
          verticalOscillation: 'mm',
          strideLength: 'm',
        } as Record<string, string>,
        footnote: {
          groundContact: 'Temps de contact au sol moyen pondéré par la durée. Plus bas = foulée généralement plus efficace.',
          verticalOscillation: 'Oscillation verticale moyenne pondérée par la durée. Plus bas = moins de rebond par foulée.',
          strideLength: 'Longueur de foulée moyenne pondérée par la durée.',
        } as Record<string, string>,
      },
      longRuns: {
        title: 'Plus longue sortie par mois',
        kmLabel: (km: number) => `${km} km`,
        refLine: '15 km',
        explains: {
          good: (km: number) => `Sortie longue moy. ${km} km - bonne habitude de sortie longue`,
          low: (km: number) => `Sortie longue moy. ${km} km - visez 15+ km chaque mois`,
        },
      },
      easyHard: {
        title: 'Répartition facile / difficile',
        easy: (pct: number) => `Facile (Z1–Z2) : ${pct}%`,
        hard: (pct: number) => `Difficile (Z3+) : ${pct}%`,
        footnote: 'Part du temps en Z1–Z2 vs Z3+. Ligne pointillée = cible 80/20.',
        explains: {
          balanced: (pct: number) => `Bon équilibre 80/20 - ${pct}% facile en moyenne`,
          tooHard: (pct: number) => `Intensité trop élevée - ${pct}% facile sur la période (visez ~80%)`,
          tooEasy: (pct: number) => `Très prudent - ${pct}% facile, de la marge pour des séances de qualité`,
        },
      },
      distance: {
        title: 'Répartition des distances',
        runs: (n: number) => `${n} sorties`,
        kmTotal: (km: number) => `${km} km au total`,
      },
      rpe: {
        title: 'Tendance RPE',
        prefix: 'RPE',
        footnote: 'Effort perçu moyen (1–10).',
      },
      trainingEffect: {
        title: 'Training Effect',
        aerobic: 'Aérobie',
        anaerobic: 'Anaérobie',
        footnote: 'Training effect aérobie et anaérobie moyen (1–5).',
      },
      temperatureCorrelation: {
        title: 'Température vs allure',
        footnote: 'Chaque point est une sortie (>= 3 km). La ligne pointillée montre la tendance globale.',
        tooltip: { temp: 'Temp', pace: 'Allure', distance: 'Distance' },
        explains: {
          slowing: (sec: number) => `L’allure ralentit d’environ ${sec}s/km par 10°C - la chaleur a un impact net`,
          stable: 'La température a peu d’impact sur votre allure',
        },
      },
      rpeLoadCorrelation: {
        title: 'Forme vs effort relatif',
        footnote: 'Chaque point est une sortie (>= 3 km), comparée à votre RPE habituel pour ce type de séance - un sprint et un footing sont ainsi jugés équitablement. La couleur indique la température quand elle est connue. La ligne pointillée montre la tendance globale.',
        tooltip: { form: 'Forme (TSB)', rpe: 'RPE', delta: 'vs habituel', temp: 'Temp' },
        explains: {
          harder: (delta: number) => `Les sorties semblent ~${delta} RPE plus dures que d’habitude par baisse de 10 points de forme - la fatigue pèse clairement sur l’effort perçu`,
          stable: 'Votre forme influe peu sur la difficulté ressentie des sorties',
        },
      },
      monthlyComparison: { title: 'Mois par mois' },
      efficiencyRolling: {
        title: 'Efficacité aérobie - tendance glissante',
        ef7: '7 j',
        ef30: '30 j',
        unit: 'm/min·bpm',
        footnote: 'Efficacité aérobie glissante sur les 90 derniers jours. 7 j capture la forme récente, 30 j montre la tendance de fond.',
      },
      runningDynamicsRolling: {
        title: 'Dynamique de course - tendance glissante',
        d7: '7 j',
        d30: '30 j',
        metrics: {
          cadence: 'Cadence',
          groundContact: 'Contact au sol',
          verticalOscillation: 'Osc. verticale',
        } as Record<string, string>,
        unit: {
          cadence: 'pas/min',
          groundContact: 'ms',
          verticalOscillation: 'mm',
        } as Record<string, string>,
        footnote: {
          cadence: 'Cadence moyenne glissante sur les 90 derniers jours. 7 j capture la forme récente, 30 j montre la tendance de fond.',
          groundContact: 'Temps de contact au sol moyen glissant sur les 90 derniers jours. Plus bas = foulée généralement plus efficace.',
          verticalOscillation: 'Oscillation verticale moyenne glissante sur les 90 derniers jours. Plus bas = moins de rebond par foulée.',
        } as Record<string, string>,
      },
    },
    yearOverYear: {
      title: 'Année sur année',
      vs: 'vs',
      rows: {
        distance: 'Distance',
        sessions: 'Séances',
        time: 'Temps',
        avgPerWeek: 'Moy. / semaine',
        avgPace: 'Allure moy.',
        avgHr: 'FC moy.',
        elevation: 'Dénivelé',
      },
    },
  },

  activities: {
    searchPlaceholder: 'Rechercher...',
    searchToggle: 'Rechercher',
    all: 'Toutes',
    count: (n: number) => `${n} activité${n > 1 ? 's' : ''}`,
    page: (current: number, total: number) => ` · page ${current}/${total}`,
    empty: 'Aucune activité trouvée',
    emptyFiltered: 'Aucune séance de ce type',
    resetFilters: 'Réinitialiser les filtres',
    endOfList: 'C’est tout',
    monthGroup: (count: number, km: number) => `${count} séance${count > 1 ? 's' : ''} · ${km} km`,
    sort: {
      label: 'Trier',
      date: 'Date',
      distance: 'Distance',
      duration: 'Durée',
      pace: 'Allure',
      avgHr: 'FC moy.',
    },
    row: {
      distance: 'distance',
      duration: 'durée',
      pace: 'allure',
      avgHr: 'FC moy.',
      rpe: 'RPE',
      rpeValue: (n: number) => `RPE ${n}`,
      na: 'N/A',
    },
  },

  activity: {
    back: 'Activités',
    runTitle: (day: string) => `Sortie du ${day}`,
    metaFallbackTitle: 'Activité',
    share: 'Partager',
    shareMenu: {
      share: 'Partager',
      download: 'Télécharger',
      copy: 'Copier',
      copied: 'Copié !',
    },
    shareCard: {
      distance: 'DISTANCE',
      time: 'TEMPS',
      pace: 'ALLURE',
      avgHr: 'FC MOY',
      close: 'Fermer',
      choosePhoto: 'Choisir une photo',
      designLabel: 'Thème',
      designLabels: {
        aurora: 'Aurore',
        pulse: 'Pulse',
        terrain: 'Terrain',
        prism: 'Prisme',
        cadence: 'Cadence',
        map: 'Carte',
        memory: 'Souvenir',
      },
      statsToggle: 'Stats de l’activité',
      mapRouteToggle: 'Afficher le tracé',
      mapRouteSubtitle: 'Force le thème Carte',
      lightModeToggle: 'Mode clair',
      lightModeSubtitle: 'Fond clair pour l’impression',
      accentTitle: 'Accent',
      accentSubtitle: 'Couleur des unités',
      galleryPlaceholder: 'Choisir une photo',
      orUsePhoto: 'Ou utilisez votre photo',
      changePhoto: 'Modifier',
      browsePhoto: 'Parcourir...',
    },
    stats: {
      distance: 'Distance',
      duration: 'Durée',
      avgPace: 'Allure moy.',
      avgHr: 'FC moy.',
      elevation: 'Dénivelé',
      calories: 'Calories',
      rpe: 'RPE',
      rpeValue: (n: number) => `RPE ${n}`,
      na: 'N/A',
      elevationValue: (m: number) => `+${m}m`,
      caloriesValue: (kcal: number) => `${kcal} kcal`,
      cadence: 'Cadence',
    },
    heatNote: (temperature: number, adjustSeconds: number) =>
      `Sortie par forte chaleur (${temperature}°C) - l’allure paraît ~${adjustSeconds}s/km plus lente qu’un effort identique par temps clément.`,
    loadNote: (atlContribution: number) => `Contribue ~${atlContribution} à la fatigue de la semaine (ATL).`,
    bestEfforts: {
      title: 'Meilleurs efforts',
      prBadge: 'RP',
      rankBadge: (rank: number) => `#${rank}`,
    },
    achievements: {
      title: 'Exploits de cette sortie',
    },
    similarRuns: {
      title: 'Sorties similaires',
      timesBadge: (n: number) => `${n} fois`,
      summary: (n: number, rank: number) =>
        `Tu as couru ce parcours ${n} fois. Cette sortie : ${rank === 1 ? 'ta meilleure allure' : `ta ${rank}ᵉ meilleure allure`}.`,
      thisRun: 'Cette sortie',
      record: 'record',
      recordLine: (pace: string) => `record ${pace}/km`,
      paceDelta: (seconds: number) => `+${seconds} s/km`,
      chartSummary: (n: number, best: string) =>
        `Allure sur tes ${n} passages de ce parcours ; record ${best}/km.`,
    },
    notes: {
      title: 'Notes',
      notePlaceholder: 'Comment c’était ? Météo, terrain, sensations...',
      tagPlaceholder: 'Ajouter un tag (ex. pluie, trail, fatigué)... Entrée pour valider',
      removeTag: (tag: string) => `Supprimer le tag ${tag}`,
    },
    zones: {
      title: 'Zones de fréquence cardiaque',
      noData: 'Pas de données de zones FC',
      labels: {
        1: 'Z1 · Échauffement',
        2: 'Z2 · Facile',
        3: 'Z3 · Aérobie',
        4: 'Z4 · Seuil',
        5: 'Z5 · Max',
      } as Record<number, string>,
      range: (min: number, max: number) => `${min}–${max} bpm`,
      rangeOpen: (min: number) => `>${min} bpm`,
    },
    trainingEffect: {
      title: 'Training Effect',
      aerobic: 'Aérobie',
      anaerobic: 'Anaérobie',
      levels: {
        noBenefit: 'Aucun bénéfice',
        minor: 'Mineur',
        maintaining: 'Maintien',
        improving: 'Amélioration',
        highlyImproving: 'Forte amélioration',
        overreaching: 'Surcharge',
      },
    },
    dynamics: {
      title: 'Dynamique de course',
      cadence: 'Cadence',
      strideLength: 'Longueur de foulée',
      groundContact: 'Contact au sol',
      vertOscillation: 'Oscillation vert.',
      vertRatio: 'Ratio vertical',
    },
    charts: {
      heartRate: 'Fréquence cardiaque',
      hr: 'FC',
      avg: 'moy',
      max: 'max',
      pace: 'Allure',
      altitude: 'Altitude',
      elevation: 'Dénivelé',
      gain: (m: number) => `+${m} m D+`,
      cadence: 'Cadence',
      sectionPhysiology: 'Physiologie',
      sectionPerformance: 'Allure & cadence',
    },
    map: {
      fullscreen: 'Plein écran',
      exitFullscreen: 'Quitter le plein écran',
      escToExit: 'Échap pour quitter',
      noTrace: 'Tracé GPS indisponible',
      noTraceHint: 'Disponible après synchronisation Garmin',
      routeMap: 'Carte du parcours de l’activité',
    },
    splits: {
      title: 'Intervalles',
      cols: {
        step: '#',
        type: 'Type',
        duration: 'Durée',
        dist: 'Distance',
        pace: 'Allure',
        hr: 'FC',
        total: 'Total',
      },
      intervalTypes: {
        interval_warmup:   'Échauffement',
        interval_active:   'Intervalle',
        interval_rest:     'Repos',
        interval_recovery: 'Récupération',
        interval_cooldown: 'Retour au calme',
      } as Record<string, string>,
    },
    nav: {
      previous: 'Précédente',
      next: 'Suivante',
    },
  },

  goals: {
    title: 'Objectifs',
    empty: 'Aucun objectif configuré pour le moment.',
    back: 'Profil',
    annualGoal: 'Objectif annuel',
    kmRemaining: (km: number) => `${km} km restants`,
    goalReached: 'Objectif atteint !',
    raceTargets: 'Objectifs de course',
    noTarget: 'Pas d’objectif',
    targetDone: (ahead: string) => `✓ Réussi (${ahead} d’avance)`,
    targetToGo: (time: string) => `${time} à gagner`,
    seasonRaces: 'Courses de la saison',
    raceAlt: (distance: string) => `course de ${distance}`,
    emptyPbs: (year: number) => `Pas encore de RP pour ${year} - ajoutez-les dans les Réglages.`,
    noPhoto: 'Pas de photo',
    upcomingRaces: 'Courses à venir',
    daysUntil: (n: number) => n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : `${n}j`,
    pastRace: 'Passée',
    registrationLink: 'Inscription',
    projection: {
      status: {
        ahead: 'En avance',
        on_track: 'Sur la bonne voie',
        behind: 'En retard',
      },
      rate: (current: number, needed: number) => `rythme ${current} km/sem · ${needed} km/sem nécessaires`,
    },
    monthlyGoal: {
      title: 'Objectifs mensuels',
      status: {
        ahead: 'En avance',
        on_track: 'Sur la bonne voie',
        behind: 'En retard',
        pending: 'À venir',
      },
      km: (actual: number, target: number) => `${actual} / ${target}`,
    },
    history: {
      title: 'Années passées',
      achieved: 'Atteint',
      missed: 'Manqué',
      annualKm: (actual: number, target: number) => `${actual} / ${target} km`,
      targetsCount: (achieved: number, total: number) => `${achieved}/${total} objectifs de course`,
    },
  },

  shoes: {
    lastRun: (date: string) => `Dernière sortie ${date}`,
    neverUsed: 'Jamais utilisée',
    kmOf: (total: number, max: number) => `${total} / ${max} km`,
    retired: 'Retraitée',
    alertBadge: 'Alerte',
    criticalBadge: 'Critique',
    wearAlert: (name: string, totalKm: number, alertThresholdKm: number) => `${name} affiche ${totalKm} km - au-delà de son seuil d’alerte de ${alertThresholdKm} km`,
    summary: {
      totalDistance: 'Km totaux',
      activePairs: 'Actives',
      sessions: 'Séances',
    },
    detail: {
      back: 'Chaussures',
      stats: {
        distance: 'Distance',
        activities: 'Activités',
        firstUsed: 'Première sortie',
      },
      activitiesTitle: 'Activités suivies',
      empty: 'Aucune activité enregistrée avec cette paire pour le moment.',
    },
  },

  profile: {
    hero: {
      since: (date: string) => `Athlète depuis ${date}`,
      summary: (activities: number, km: number) => `${activities} activités · ${km} km`,
      editName: 'Modifier le nom',
      namePlaceholder: 'Votre nom',
      rankExplain: 'Rang de forme basé sur la VO₂max et l’allure de course.',
      rankSource: (vo2maxGarmin: number | null, vdot: number | null) => {
        const parts = []
        if (vo2maxGarmin !== null) parts.push(`VO₂max ${vo2maxGarmin}`)
        if (vdot !== null) parts.push(`VDOT ${vdot}`)
        return `D’après ${parts.join(' · ')}`
      },
    },
    ytd: {
      title: 'Cette année',
      distance: 'Distance',
      duration: 'Durée',
      sessions: 'Séances',
      elevation: 'Dénivelé',
    },
    records: {
      title: 'Records personnels',
      notYet: 'Pas encore',
      viewAll: 'Voir tous les records',
      newBadge: 'NOUVEAU',
      legend: 'NOUVEAU = établi dans les 90 derniers jours',
    },
    shoes: {
      title: 'Chaussures',
      line: (totalKm: number, remainingKm: number) => `${totalKm} km · ~${remainingKm} km restants`,
      viewShoes: 'Voir les chaussures',
    },
    milestones: {
      title: 'Jalons',
      distanceTier: (km: number) => `${km} km cette année`,
      distanceTierDetail: (year: number) => `Franchi en ${year}`,
      streak: (weeks: number) => `${weeks} semaines d’affilée`,
      streakDetail: 'Toujours en cours - une sortie chaque semaine depuis',
      record: (label: string) => `Record ${label}`,
      viewAll: 'Voir tous les jalons',
    },
    hrZones: {
      title: 'Zones cardiaques',
      lthr: 'LTHR',
      recalculate: 'Recalculer depuis la LTHR',
    },
    goal: {
      title: (year: number) => `Objectif ${year}`,
      pace: (km: number) => `À ce rythme : ${km} km en fin d’année`,
      viewGoals: 'Voir les objectifs',
    },
  },

  records: {
    title: 'Meilleurs temps',
    all: 'Tous',
    longest: 'Plus longue sortie',
    mostRecent: 'Plus récent',
    footnote: '★ temps officiel en course · les autres sont détectés automatiquement dans les activités',
    notYetRun: 'Pas encore couru',
    leaderboard: {
      title: 'Meilleurs temps',
      rank: '#',
      time: 'Temps',
      dist: 'Distance',
      pace: 'Allure',
      date: 'Date',
    },
  },

  pbAlerts: {
    off: (diff: string) => `à ${diff} de votre RP`,
  },

  nextRace: {
    line: (name: string, distance: string, daysUntil: string) => `${name} (${distance}) - ${daysUntil}`,
    countdown: (days: number) => `J-${days}`,
  },

  racePredictions: {
    title: 'Prédictions de course',
    formulaLabel: '(formule de Riegel)',
    formulaExplainer: 'Formule de Peter Riegel (1977) : T2 = T1 × (D2/D1)^1,06. Le standard utilisé par la plupart des applis de running.',
    efforts: {
      '1k': '1K',
      '1mile': '1M',
      '5k': '5K',
      '10k': '10K',
      half: 'Semi',
      marathon: 'Marathon',
    } as Record<string, string>,
    from: (source: string) => `d’après ${source}`,
    beatBy: (time: string) => `✓ Battu de ${time}`,
    pbUpside: (time: string) => `RP -${time}`,
    trendFaster: (time: string, weeks: number) => `${time} plus rapide en ${weeks} sem.`,
    trendSlower: (time: string, weeks: number) => `${time} plus lent en ${weeks} sem.`,
    trendFlat: 'Stable',
  },

  trainingZones: {
    title: 'Zones d’entraînement',
    thresholdLabel: (pace: string) => `Seuil ${pace}`,
    perKm: '/km',
  },

  loadRisk: {
    title: 'Risque de charge',
    insufficientData: 'Données insuffisantes',
    zone: {
      low: 'Sous-charge',
      safe: 'Zone sûre',
      caution: 'Prudence',
      risk: 'Risque élevé',
    },
    acwr: { label: 'ACWR', description: 'Charge aiguë/chronique · cible 0,8–1,3' },
    monotony: { label: 'Monotonie', description: 'Variété de charge au quotidien · alerte au-delà de 2,0' },
    strain: { label: 'Strain', description: 'Charge hebdo × monotonie (Foster)' },
    rampRate: { label: 'Ramp rate', description: 'Δ CTL sur 7 jours' },
  },

  consistencyScore: {
    title: 'Régularité',
    weeks: 'semaines',
    gradeExplain: 'Note vos 12 dernières semaines selon les semaines actives (60 %) et la stabilité du volume hebdo (40 %).',
  },

  calendar: {
    today: 'Aujourd’hui',
    prevPeriod: 'Précédent',
    nextPeriod: 'Suivant',
    summary: (sessions: number, km: number) =>
      `${sessions} séance${sessions > 1 ? 's' : ''} · ${km} km`,
    weekdays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    readiness: (tsb: number) => `Forme ${tsb >= 0 ? '+' : ''}${tsb}`,
    switcher: { week: 'Semaine', month: 'Mois' },
    // Abbreviated: sits between the period chevrons, where the full word wraps.
    weekOf: (label: string) => `Sem. du ${label}`,
    restDay: 'Repos',
    planned: 'Prévu',
    nextWeek: (n: number) => `Semaine prochaine - ${n} prévue${n > 1 ? 's' : ''}`,
    viewDetail: 'Voir le détail',
    type: 'Type',
    weekSummary: {
      load: 'Charge',
      vsTypical: (percent: number) => `${percent - 100 >= 0 ? '+' : ''}${percent - 100}% vs type`,
      easyHard: 'Facile / Dur',
      elevation: 'D+',
      keySessions: 'Séances clés',
    },
  },

  // Display labels for domain enums. Styling (colors, badge classes) stays in
  // the domain config; only the human-readable text lives here.
  activityTypes: {
    Sprint: 'Sprint',
    Anaerobic: 'Anaérobie',
    VO2Max: 'VO₂ Max',
    Threshold: 'Seuil',
    Tempo: 'Tempo',
    Base: 'Base',
    Race: 'Course',
  } as Record<ActivityType, string>,

  rpeLabels: {
    1: 'Très léger',
    2: 'Très facile',
    3: 'Facile',
    4: 'Confortable',
    5: 'Modéré',
    6: 'Soutenu',
    7: 'Difficile',
    8: 'Très difficile',
    9: 'Quasi maximal',
    10: 'Maximal',
  } as Record<number, string>,

  // Shared by the consistency grade ring and the profile rank badge, both of which
  // place a value on the same 9-tier percentile ladder (see domain/athlete/rank.ts).
  rankTierLabels: {
    D: 'Sous la moyenne',
    C: 'Dans la moyenne',
    B: 'Au-dessus de la moyenne',
    A: 'Excellent',
    S: 'Élite',
  } as Record<RankTier, string>,
} satisfies Strings
