// French UI strings. Mirrors the shape of `en.ts` (the reference locale) and is
// type-checked against it via `satisfies Strings`. Activated with
// NEXT_PUBLIC_LOCALE=fr (see `index.ts`).
//
// Conventions:
// - Plain strings for static copy.
// - Functions for interpolated / pluralized copy (French: 0 and 1 are singular).
// - Pure number/date formatting stays in `@/lib/formatters`; only human-readable
//   words and units live here.

import type { ActivityType, ScheduledTimeOfDay } from '@/domain/activity/types'
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
      dashboard: 'Aujourd’hui',
      activities: 'Activités',
      plan: 'Plan',
      analytics: 'Analyses',
      heatmap: 'Heatmap',
      profile: 'Progression',
      settings: 'Réglages',
    },
  },
  meta: {
    description: 'Votre tableau de bord d’entraînement running personnel - stats, cartes, tendances.',
  },

  theme: {
    toggle: 'Changer de thème',
  },

  chartWindow: {
    ranges: {
      '4w': '4s',
      '6m': '6m',
      '1y': '1a',
    },
    previous: 'Période précédente',
    next: 'Période suivante',
    empty: 'Aucune donnée enregistrée sur cette période.',
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
    min: 'min',
    yrs: 'ans',
    kg: 'kg',
    cm: 'cm',
    kmh: 'km/h',
    mlKgMin: 'ml/kg/min',
  },

  common: {
    viewAll: 'Tout voir',
    runs: (n: number) => `${n} sortie${n > 1 ? 's' : ''}`,
    close: 'Fermer',
  },

  pwa: {
    updateAvailable: 'Une nouvelle version de RunOmics est prête.',
    refresh: 'Actualiser',
  },

  pages: {
    dashboard: {
      greeting: {
        morning:   'Bonjour',
        afternoon: 'Bon après-midi',
        evening:   'Bonsoir',
        weekDate:  (week: number, date: string) => `Semaine ${week} · ${date}`,
      },
    },
    activities: {
      title: 'Activités',
    },
    plan: {
      title: 'Plan',
    },
    records: {
      title: 'Records',
      subtitle: 'Records personnels et prédictions de course',
      back: 'Progression',
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
      less: 'Rare',
      more: 'Fréquent',
      noRoutes: 'Aucun parcours pour ce filtre',
      mapUnavailable: 'Carte indisponible - aucune clé de carte configurée',
      territory: {
        // Camp de base de toujours, indépendant du sélecteur de zone plus bas -
        // le texte le dit clairement pour ne pas être lu comme la zone choisie.
        eyebrow: 'Camp de base · depuis toujours',
        headline: (percent: number, radius: number) => `${percent}% de toutes tes sorties tiennent dans un rayon de ${radius} km.`,
        aroundPlace: (place: string) => `Centré sur ${place}, là où tu cours le plus.`,
        routesStat: 'routes distinctes',
        radiusStat: 'rayon médian',
      },
    },
    shoes: {
      title: 'Chaussures',
      subtitle: 'Kilométrage et usure par paire',
      back: 'Progression',
    },
    athlete: {
      title: 'Athlète',
      subtitle: 'Seuils et zones de fréquence cardiaque',
      back: 'Progression',
      lastUpdated: (when: string) => `Mis à jour ${when}`,
    },
    notFound: {
      code: '404',
      heading: 'Cette page est partie courir et n’est jamais revenue.',
      sub: 'L’itinéraire que vous cherchez n’existe pas.',
      back: 'Retour à aujourd’hui',
    },
    error: {
      heading: 'Une foulée de travers.',
      sub: 'Une erreur inattendue est survenue au chargement de cette page.',
      retry: 'Réessayer',
      back: 'Retour à aujourd’hui',
    },
    settings: {
      title: 'Réglages',
      subtitle: 'Apparence, notifications et export de données.',
      back: 'Progression',
    },
  },

  settings: {
    sections: {
      appearance: 'Apparence',
      notificationsData: 'Notifications & données',
      account: 'Compte',
    },
    rowAction: {
      export: 'Exporter ›',
      clear: 'Vider ›',
    },
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
      preview: 'Aperçu',
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
      age: 'Âge',
      lthr: 'LTHR',
      lthrHint: 'Fréquence cardiaque au seuil lactique',
      thresholdPace: 'Allure seuil',
      thresholdPaceHint: 'min:ss par km, ex. 4:14',
      vma: 'VMA',
      vmaHint: 'Vitesse maximale aérobie',
      maxHr: 'FC max',
      restingHr: 'FC repos',
      vo2max: 'VO2max',
      weight: 'Poids',
      height: 'Taille',
      fitnessAge: 'Âge de forme',
      achievableFitnessAge: 'Potentiel',
      bmi: 'IMC',
      // Kept to a single short token - the tiles are a third of a phone wide.
      fitnessAgeBand: {
        younger: (years: number) => `−${years} ans`,
        onPar: 'à niveau',
        older: (years: number) => `+${years} ans`,
      },
      bmiBand: {
        underweight: 'maigreur',
        healthy: 'normal',
        overweight: 'surpoids',
        obese: 'obésité',
      },
      categories: {
        performance: 'Performance',
        cardio: 'Cardio',
        body: 'Morphologie',
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
      garmin: 'Garmin Connect',
      connected: (source: string) => `${source} connecté`,
      lastSync: 'Dernière synchro',
      since: (monthYear: string) => `appairée depuis ${monthYear}`,
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
          subtitle: 'Séance du jour à 10h, plus un point hebdomadaire sur votre objectif kilométrique.',
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
      title: 'Régularité',
      activeDays: (n: number) => `${n} jours actifs`,
      less: 'Moins',
      more: 'Plus',
      restDay: 'Repos',
      day: (km: number, runs: number) =>
        `${km} km · ${runs} sortie${runs > 1 ? 's' : ''}`,
      months: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
      weekdays: ['Lun', '', 'Mer', '', 'Ven', '', ''],
    },
    trainingLoad: {
      title: 'Charge d’entraînement',
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
      trendUp: (delta: number) => `+${delta}`,
      trendDown: (delta: number) => `${delta}`,
      trendSteady: '~0',
    },
    trainingStatusDays: {
      title: 'Statut d’entraînement',
      today: "Aujourd'hui",
      noReading: 'Pas de lecture',
    },
    vo2maxChart: {
      title: 'VO₂max',
      unit: 'ml/kg/min',
      footnote: 'Estimation VO₂max Garmin',
      ranges: { '4w': '4 sem.', '6m': '6 mois', '1y': '1 an' },
      reading: {
        up: (avg: number) => `En hausse, moyenne de ${avg} sur cette période.`,
        down: (avg: number) => `En baisse, moyenne de ${avg} sur cette période.`,
        flat: (avg: number) => `Stable autour de ${avg}.`,
      },
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
      newPr: (label: string, time: string) => `Nouveau record ${label} : ${time}`,
      statusFresh: (tsb: number) => `Zone fraîche (Forme +${tsb}) - bonne fenêtre pour une séance dure`,
      statusOverreaching: (tsb: number) => `Surcharge (Forme ${tsb}) - envisage de lever le pied`,
      acwrWatch: (acwr: number) => `Ratio charge aiguë/chronique à ${acwr.toFixed(2)} - hors de la zone sûre 0,8-1,3`,
      monotonyWatch: (monotony: number) => `Monotonie à ${monotony.toFixed(1)} - ta semaine manque de variété de charge`,
      hardShareWatch: (hardPct: number) => `${Math.round(hardPct)}% de ton temps en effort dur`,
    },
    weeklyReview: {
      eyebrow: 'Bilan de la semaine',
      fallbackTitle: (km: number, sessions: number) =>
        `${km} km en ${sessions} séance${sessions !== 1 ? 's' : ''} pour l’instant`,
    },
    syncStatus: {
      synced: (relative: string) => `Synchronisé ${relative}`,
      justNow: 'à l’instant',
      minutesAgo: (m: number) => `il y a ${m} min`,
      hoursAgo: (h: number) => `il y a ${h} h`,
      daysAgo: (d: number) => `il y a ${d} j`,
    },
    todayHero: {
      eyebrowByTone: {
        go: 'Feu vert',
        caution: 'Prudence',
        hold: 'Lever le pied',
      },
      readiness: {
        go: {
          headline: 'Tu es frais. Bon jour pour de la qualité.',
          body: () => `La fatigue baisse - la séance prévue est un feu vert.`,
        },
        caution: {
          headline: 'Journée neutre. Reste modéré.',
          body: (loadTrendLabel: string) => `La charge est en ${loadTrendLabel.toLowerCase()} et la forme est neutre - reste honnête sur les jours faciles.`,
        },
        hold: {
          headline: 'Lève le pied aujourd’hui.',
          body: () => `La fatigue est élevée - une journée facile ou du repos aiderait.`,
        },
      },
      sessionCta: 'Démarrer',
      viewCta: 'Voir',
      restDay: 'Jour de repos',
      restDaySubtitle: 'Aucune séance prévue',
      race: 'Course',
      daysToRace: (days: number) => `J-${days}`,
      chargeOptimal: 'Optimale',
      chargeHigh: 'Élevée',
      chargeLow: 'Faible',
    },
    weeklyStreak: {
      weeksInARow: (weeks: number) => `${weeks} semaines d’affilée`,
      kmRemaining: (km: number) => `Plus que ${km} km pour boucler la semaine`,
      goalReached: 'Objectif hebdomadaire atteint',
      freshWeek: 'Nouvelle semaine.',
      freshWeekGoal: (km: number) => `Objectif ${km} km - un premier run lance la série.`,
      streakSummary: (longest: number, current: number) => `Meilleure série : ${longest} semaines - en cours : ${current}`,
    },
    celebration: {
      eyebrow: 'Nouveau record personnel',
      later: 'Plus tard',
      viewAndShare: 'Voir et partager',
    },
    onboarding: {
      message: 'La décision du jour est dans la carte ci-dessus - ton verdict de forme et la séance à courir ensuite.',
    },
  },

  trainingStatus: {
    status: {
      productive: 'Productif',
      fresh: 'En forme',
      overreaching: 'Surmenage',
      recovery: 'Récupération',
      detraining: 'Désentraînement',
      maintaining: 'Maintien',
      unproductive: 'Non productif',
    },
    loadTrend: {
      building: 'En progression',
      maintaining: 'Maintien',
      tapering: 'Affûtage',
      detraining: 'En baisse',
    },
    metrics: {
      fitness: 'Condition',
      vo2maxBand: {
        building: 'En construction',
        solid: 'Solide',
        strong: 'Forte',
        elite: 'Élite',
      },
      topPercent: (pct: number) => `top ${pct}%`,
      fitnessBand: {
        peak: 'Pic de forme',
        nearPeak: 'Proche du pic',
        building: 'En construction',
      },
    },
  },

  analytics: {
    title: 'Analyses',
    readingLabel: 'Lecture :',
    season: (year: number) => `Saison ${year}`,
    allTimeChip: 'Tout',
    allTimeTitle: 'Historique complet',
    yearGroupLabel: 'Année',
    windowGroupLabel: 'Fenêtre',
    period: {
      chip: (n: number) => `${n} sem`,
      title: (n: number) => (n === 1 ? 'Cette semaine' : `${n} dernières semaines`),
      distancePct: (p: number) => `${p >= 0 ? '+' : ''}${p}% km`,
      sessionsPct: (p: number) => `${p >= 0 ? '+' : ''}${p}% sorties`,
      paceFaster: (s: number) => `allure facile -${s}s/km`,
      paceSlower: (s: number) => `allure facile +${s}s/km`,
    },
    tabs: {
      fitness: 'Forme',
      // Abbreviated so all four tabs fit the strip without scrolling; the
      // section heading above the race cards carries the full word.
      performance: 'Perf.',
      volume: 'Volume',
      health: 'Santé',
    },
    insightCards: {
      vo2max: 'VO₂max',
      easyPace: 'Allure facile',
      threshold: 'Seuil',
      consistency: 'Régularité',
      days: 'jours',
      holding: 'stable',
      excellent: 'excellent',
      topPercent: (p: number) => `top ${p}%`,
      faster: (s: number) => `↓ ${s} s`,
      slower: (s: number) => `↑ ${s} s`,
    },
    raceTimes: {
      title: 'Performance',
      trend: 'Chronos ↓',
      // Abbreviated to fit four cards across a phone.
      shortLabels: {
        '5k': '5K',
        '10k': '10K',
        half: 'Semi',
        marathon: 'Mara',
      } as Record<string, string>,
    },
    stats: {
      distance: 'Distance',
      time: 'Temps',
      sessions: 'Séances',
      elevation: 'Dénivelé',
      avgPerWeek: 'Moy. / semaine',
      yearsTracked: 'Années suivies',
      calories: 'Calories',
      elevationValue: (m: number) => `+${m} m`,
    },
    charts: {
      weeklyVolume: {
        title: 'Volume hebdo',
        sessions: 'Séances',
        weekOf: (label: string) => `Semaine du ${label}`,
        weekOfInProgress: (label: string) => `Semaine du ${label} (en cours)`,
        footnote: 'Chaque point est une semaine complète, du lundi au dimanche. La ligne pointillée horizontale est la moyenne de la période ; la verticale marque la semaine en cours, encore partielle et exclue de cette moyenne.',
        explains: {
          up: (km: number, avg: number) => `Dernière semaine ${km} km au-dessus de ta moyenne de ${avg} km`,
          down: (km: number, avg: number) => `Dernière semaine ${km} km sous ta moyenne de ${avg} km`,
          steady: (avg: number) => `Volume régulier autour de ${avg} km par semaine`,
        },
      },
      monthlyVolume: {
        title: 'Volume',
        reading: (topType: string, pct: number) => `${topType} représente la plus grosse part du volume mensuel (~${pct}%).`,
      },
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
        measured: 'Mesurée',
        adjusted: 'Corrigée chaleur',
        felt: (deg: number) => `${deg}°C ressentis`,
        footnote: 'Vitesse par battement sur les sorties faciles (m/min ÷ FC moy.). Plus haut = meilleure forme aérobie. La courbe corrigée retire le coût de la chaleur de chaque sortie : un épisode chaud ne se lit plus comme une perte de forme.',
        explains: {
          improving: (d: string) => `En progrès +${d} - vous produisez plus de vitesse par battement`,
          stable: 'Efficacité aérobie stable',
          declining: 'En baisse - ajoutez des sorties faciles ou surveillez une fatigue accumulée',
          heatGap: (d: string) => `la chaleur maintient la courbe mesurée ${d} sous votre forme réelle`,
        },
      },
      heatImpact: {
        title: 'Allure selon la température',
        unit: 's/km',
        bands: {
          cold: '< 5°C',
          cool: '5-15°C',
          mild: '15-20°C',
          warm: '20-25°C',
          hot: '25°C+',
        } as Record<string, string>,
        paceAtRefHr: (hr: number) => `Allure à ${hr} bpm`,
        cost: 'Coût',
        reference: 'Tes meilleures conditions',
        footnote: (hr: number) =>
          `Sorties faciles regroupées par température ressentie, chaque groupe ramené à l'allure qu'il tient à ${hr} bpm : les barres comparent donc à effort égal. Les tranches mélangent toutes les saisons, la plus froide porte aussi la forme de début de saison.`,
        reading: (band: string, sec: number) => `À ${band} ressentis, tu perds environ ${sec} s/km à fréquence cardiaque égale.`,
        readingFlat: 'La température ne change pas mesurablement ton allure facile à FC égale.',
      },
      zones: {
        title: 'Temps en zones',
        reading: (pct: number, zoneLabel: string) => `La majorité du temps (${pct}%) se passe en zone ${zoneLabel} - ton entraînement penche vers cette intensité.`,
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
        reading: {
          down: (bpm: number) => `La FC en sortie facile baisse - environ ${bpm} bpm de moins pour le même effort, signe d'une forme qui progresse.`,
          up: (bpm: number) => `La FC en sortie facile augmente - environ ${bpm} bpm de plus pour le même effort, à surveiller.`,
          flat: 'La FC en sortie facile et en séance de qualité reste stable.',
        },
      },
      runningForm: {
        title: 'Technique de course',
        metrics: {
          cadence: 'Cadence',
          groundContact: 'Contact au sol',
          verticalOscillation: 'Osc. verticale',
          verticalRatio: 'Rapport vertical',
          strideLength: 'Longueur de foulée',
        } as Record<string, string>,
        unit: {
          cadence: 'pas/min',
          groundContact: 'ms',
          verticalOscillation: 'mm',
          verticalRatio: '%',
          strideLength: 'm',
        } as Record<string, string>,
        footnote: {
          cadence: 'Cadence moyenne pondérée par la durée (pas/min).',
          groundContact: 'Temps de contact au sol moyen pondéré par la durée. Plus bas = foulée généralement plus efficace.',
          verticalOscillation: 'Oscillation verticale moyenne pondérée par la durée. Plus bas = moins de rebond par foulée.',
          verticalRatio: 'Oscillation verticale rapportée à la longueur de foulée. Plus bas = moins d’énergie perdue vers le haut à chaque mètre parcouru.',
          strideLength: 'Longueur de foulée moyenne pondérée par la durée.',
        } as Record<string, string>,
        // The axis already carries the range, so the reading carries the trend.
        reading: {
          up: (metric: string, delta: string, unit: string) => `${metric} en hausse, +${delta} ${unit} sur la période.`,
          down: (metric: string, delta: string, unit: string) => `${metric} en baisse, -${delta} ${unit} sur la période.`,
          flat: (metric: string) => `${metric} stable sur la période.`,
        },
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
        reading: (bracket: string, pct: number) => `La majorité des sorties (${pct}%) se situe dans la tranche ${bracket}.`,
      },
      rpe: {
        title: 'Tendance RPE',
        prefix: 'RPE',
        footnote: 'Effort perçu moyen (1–10).',
        reading: {
          down: (avg: string) => `L'effort perçu diminue, moyenne RPE ${avg}.`,
          up: (avg: string) => `L'effort perçu augmente, moyenne RPE ${avg}.`,
          flat: (avg: string) => `L'effort perçu est stable autour de RPE ${avg}.`,
        },
      },
      trainingEffect: {
        title: 'Effet d’entraînement',
        aerobic: 'Aérobie',
        anaerobic: 'Anaérobie',
        footnote: 'Training effect aérobie et anaérobie moyen (1–5).',
        reading: {
          aerobicLed: "Le training effect aérobie dépasse l'anaérobie - la plupart des séances construisent l'endurance plutôt que la haute intensité.",
          anaerobicLed: "Le training effect anaérobie dépasse l'aérobie - la plupart des séances penchent vers la haute intensité.",
          balanced: 'Le training effect aérobie et anaérobie sont à peu près équilibrés.',
        },
      },
      monthlyComparison: {
        title: 'Mois par mois',
        reading: (curYear: number, deltaPct: number) =>
          deltaPct >= 0
            ? `Le volume ${curYear} devance l'an dernier de ${deltaPct}%.`
            : `Le volume ${curYear} accuse un retard de ${Math.abs(deltaPct)}% sur l'an dernier.`,
      },
      efficiencyRolling: {
        title: 'Efficacité aérobie',
        ef7: '7 j',
        ef30: '30 j',
        unit: 'm/min·bpm',
        footnote: 'Efficacité aérobie glissante sur la fenêtre affichée. 7 j capture la forme récente, 30 j montre la tendance de fond.',
        reading: {
          up: (d: string) => `La tendance 30 j progresse, +${d} m/min·bpm - plus de vitesse par battement.`,
          down: 'La tendance 30 j baisse - ajoute des sorties faciles ou surveille une fatigue accumulée.',
          flat: 'La tendance 30 j reste stable.',
        },
      },
      threshold: {
        title: 'Seuil lactique de course',
        pace: 'Allure au seuil',
        lthr: 'FC au seuil',
        footnote: 'L’effort tenable avant l’accumulation de lactate, tel que mesuré par la montre. Garmin le révise toutes les quelques semaines : la courbe avance par paliers.',
        reading: {
          faster: (sec: number) => `L’allure au seuil a gagné ${sec}s/km depuis le premier relevé.`,
          slower: (sec: number) => `L’allure au seuil a perdu ${sec}s/km depuis le premier relevé.`,
          flat: 'L’allure au seuil est stable depuis le premier relevé.',
        },
      },
      racePredictor: {
        title: 'Prédicteur de course',
        emptyWindow: 'Aucune prédiction enregistrée sur cette période.',
        distances: {
          '5k': '5 km',
          '10k': '10 km',
          half: 'Semi',
          marathon: 'Marathon',
        } as Record<string, string>,
        footnote: 'Temps de passage prédits par la montre à partir de la VO₂max et de l’entraînement récent. Tracés en allure pour que les quatre distances tiennent sur une même échelle ; plus haut = plus rapide.',
        reading: {
          faster: (distance: string, gain: string, current: string) =>
            `Le potentiel sur ${distance} progresse de ${gain} sur la période, à ${current} aujourd’hui.`,
          slower: (distance: string, loss: string) =>
            `Le potentiel sur ${distance} recule de ${loss} sur la période.`,
          flat: 'Les temps prédits sont stables sur la période.',
        },
      },
      trainingStatusHistory: {
        title: 'Statut d’entraînement',
        status: 'Statut',
        chronic: 'Charge chronique',
        acute: 'Charge aiguë',
        daysUnit: 'j',
        footnote: 'Verdict quotidien de la montre, avec la charge aiguë et chronique mesurées par Firstbeat. La bande bleue est la plage de charge chronique que Garmin personnalise pour vous.',
        reading: (dominant: string, pct: number, latest: string | null) =>
          `${dominant} domine la période (${pct}% des jours notés)${latest ? `, avec un statut actuel « ${latest} »` : ''}.`,
      },
    },
    seasonHeadline: {
      eyebrow: 'Bilan de saison',
      titlePositive: 'Plus en forme et plus efficace qu\'en début de saison.',
      titleCaution: 'Un passage plus difficile qu\'en début de saison.',
      titleMixed: 'Une saison en demi-teinte - des progrès par endroits, des baisses ailleurs.',
      efficiency: (d: number) => `Efficacité aérobie ${d > 0 ? '+' : ''}${d} - ${d > 0 ? 'plus' : 'moins'} de vitesse par battement`,
      easyPace: (to: string, from: string, weeks: number) =>
        `Allure facile ${to}, contre ${from} en moyenne sur les ${weeks} premières semaines de saison`,
      volume: (pct: number, year: number) =>
        `Volume ${pct > 0 ? 'en hausse de' : 'en baisse de'} ${Math.abs(pct)}% vs ${year}${pct < 0 ? ' - attention à la régularité' : ''}`,
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
    all: 'Toutes',
    count: (n: number) => `${n} activité${n > 1 ? 's' : ''}`,
    empty: 'Aucune activité trouvée',
    emptyFiltered: 'Aucune séance de ce type',
    resetFilters: 'Réinitialiser les filtres',
    endOfList: 'C’est tout',
    thisWeek: 'Cette semaine',
    weekStat: {
      km: 'km',
      runs: 'sorties',
      easyHard: 'F/D',
    },
    weekGroupCompact: (runs: number, km: number) => `${runs} sortie${runs > 1 ? 's' : ''} · ${km} km`,
    sort: {
      label: 'Trier',
      date: 'Date',
      distance: 'Distance',
      duration: 'Durée',
      pace: 'Allure',
      avgHr: 'FC moy.',
    },
    row: {
      rpeValue: (n: number) => `RPE ${n}`,
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
      designLabels: {
        aurora: 'Aurore',
        pulse: 'Pulse',
        terrain: 'Terrain',
        prism: 'Prisme',
        route: 'Parcours',
        map: 'Carte',
        memory: 'Souvenir',
      },
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
      duration: 'Durée',
    },
    verdict: {
      title: 'Verdict de la sortie',
      headline: {
        positive: (type: string) => `Belle sortie ${type}`,
        neutral: (type: string) => `Sortie ${type} enregistrée`,
        caution: (type: string) => `Sortie ${type} exigeante`,
      },
      effortClause: (rpeLabel: string, rpe: number) => `Effort ressenti : ${rpeLabel} (RPE ${rpe}).`,
    },
    tabs: {
      groupLabel: 'Sections de la sortie',
      overview: 'Aperçu',
      splits: 'Intervalles',
      charts: 'Graphiques',
      dynamics: 'Dynamique',
    },
    bestEfforts: {
      title: 'Meilleurs efforts',
      prBadge: 'RP',
      rankBadge: (rank: number) => `#${rank}`,
    },
    achievements: {
      title: 'Exploits de cette sortie',
    },
    decoupling: {
      title: 'Découplage aérobie',
      stable: 'Tenu',
      drifting: 'Dérive',
      reading: {
        stable: "L'allure a coûté le même effort à la fin qu'au départ - la base aérobie a tenu la distance.",
        drifting: "La fréquence cardiaque est montée à allure constante - la base aérobie a lâché avant la distance.",
        negative: "La seconde moitié a été plus efficace que la première, en général un échauffement qui se met en place.",
      },
      footnote: 'Rapport allure/FC, seconde moitié contre première. Sous 5%, la sortie est tenue.',
    },
    dataQuality: {
      estimated: 'Estimé',
      noHr: 'Pas de fréquence cardiaque - zones et charge estimées depuis l’allure.',
    },
    similarRuns: {
      title: 'Sorties similaires',
      timesBadge: (n: number) => `${n} fois`,
      summary: (n: number, rank: number) =>
        `Tu as couru ce parcours ${n} fois. Cette sortie : ${rank === 1 ? 'ta meilleure allure' : `ta ${rank}ᵉ meilleure allure`}.`,
      thisRun: 'Cette sortie',
      record: 'record',
      paceDelta: (seconds: number) => `+${seconds} s/km`,
      chartSummary: (n: number, best: string) =>
        `Allure sur tes ${n} passages de ce parcours ; record ${best}.`,
    },
    notes: {
      title: 'Notes',
      notePlaceholder: 'Comment c’était ? Météo, terrain, sensations...',
      tagPlaceholder: 'Ajouter un tag (ex. pluie, trail, fatigué)... Entrée pour valider',
      removeTag: (tag: string) => `Supprimer le tag ${tag}`,
    },
    zones: {
      title: 'Temps en zones',
      noData: 'Pas de données de zones FC',
      labels: {
        1: 'Z1 · Échauffement',
        2: 'Z2 · Facile',
        3: 'Z3 · Aérobie',
        4: 'Z4 · Seuil',
        5: 'Z5 · Max',
      } as Record<number, string>,
    },
    trainingEffect: {
      aerobic: 'Effet aérobie',
      anaerobic: 'Effet anaérobie',
      levels: {
        noBenefit: 'Aucun bénéfice',
        minor: 'Mineur',
        maintaining: 'Maintien',
        improving: 'Amélioration',
        highlyImproving: 'Forte amélioration',
        overreaching: 'Surcharge',
      },
    },
    weather: {
      wind: 'Vent',
      conditions: {
        clear: 'Ciel dégagé',
        mainlyClear: 'Plutôt dégagé',
        partlyCloudy: 'Partiellement nuageux',
        overcast: 'Couvert',
        fog: 'Brouillard',
        drizzle: 'Bruine',
        freezingDrizzle: 'Bruine verglaçante',
        rain: 'Pluie',
        freezingRain: 'Pluie verglaçante',
        snow: 'Neige',
        showers: 'Averses',
        snowShowers: 'Averses de neige',
        thunderstorm: 'Orage',
      },
      compass: {
        n: 'N',
        ne: 'NE',
        e: 'E',
        se: 'SE',
        s: 'S',
        sw: 'SO',
        w: 'O',
        nw: 'NO',
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
      mapUnavailable: 'Carte indisponible',
      mapUnavailableHint: 'Aucune clé de carte configurée',
      routeMap: 'Carte du parcours de l’activité',
    },
    splits: {
      title: 'Intervalles',
      cols: {
        step: '#',
        type: 'Type',
        duration: 'Dur.',
        dist: 'Dist.',
        pace: 'Allure',
        hr: 'FC',
        total: 'Total',
      },
      intervalTypes: {
        interval_warmup:   'Échauffement',
        interval_active:   'Intervalle',
        interval_rest:     'Repos',
        interval_recovery: 'Récupération',
        interval_cooldown: 'Repos',
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
    back: 'Progression',
    annualGoal: 'Objectif annuel',
    kmRemaining: (km: number) => `${km} km restants`,
    goalReached: 'Objectif atteint !',
    seasonTimeline: 'Chronologie de la saison',
    target: 'Objectif',
    noTarget: '-',
    noTargetSet: 'Aucun objectif défini',
    noDateSet: 'date non définie',
    done: 'terminée',
    beatenBy: (gap: string) => `battu de ${gap}`,
    missedBy: (gap: string) => `manqué de ${gap}`,
    best: 'Record',
    predictedTag: 'prédit',
    findRace: 'Trouver une course ›',
    nextRaceHint: (name: string, date: string) => `prochaine : ${name} ${date}`,
    seasonRaces: 'Courses de la saison',
    raceAlt: (distance: string) => `course de ${distance}`,
    emptyPbs: (year: number) => `Pas encore de RP pour ${year} - ajoutez-les dans les Réglages.`,
    noPhoto: 'Pas de photo',
    daysUntil: (n: number) => n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : `${n}j`,
    registrationLink: 'Inscription',
    projection: {
      status: {
        ahead: 'En avance',
        on_track: 'Sur la bonne voie',
        behind: 'En retard',
      },
      rate: (current: number) => `rythme ${current} km/sem`,
      projected: (km: number) => `Projection ${km.toLocaleString()} km`,
    },
    monthlyVolume: {
      title: 'Volume mensuel',
      expand: 'Détailler',
      collapse: 'Réduire',
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
    neverUsed: 'Jamais utilisée',
    kmOf: (total: number, max: number) => `${total} / ${max} km`,
    retired: 'Retraitée',
    status: {
      ok: 'Bon état',
      watch: 'À remplacer bientôt',
      replace: 'À remplacer',
    },
    kmLeft: (km: number) => `~${km} km restants`,
    hero: {
      usage: (n: number, total: number) => `Utilisée sur ${n} de tes ${total} dernières séances tempo/seuil`,
      rotateBeforeRace: (date: string) => ` - fais tourner une autre paire avant ta course du ${date}.`,
      rotate: ' - fais tourner une autre paire.',
      restOfRotation: 'Reste de la rotation',
    },
    wearAlert: (name: string, totalKm: number, alertThresholdKm: number) => `${name} affiche ${totalKm} km - au-delà de son seuil d’alerte de ${alertThresholdKm} km`,
    comparison: {
      title: 'À quoi sert chaque paire',
      note: "Des paires portées à des saisons différentes ne se comparent pas à armes égales - la période sous chaque nom dit ce qui les sépare.",
      period: (from: string, to: string) => `${from} - ${to}`,
      metrics: {
        sessions: 'Sorties',
        distance: 'Distance',
        keyShare: 'Séances qualité',
        pace: 'Allure moy.',
        heartRate: 'FC moy.',
        cadence: 'Cadence',
        groundContact: 'Contact au sol',
        oscillation: 'Oscillation vert.',
      },
    },
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
        firstUsed: 'Depuis',
        kmPerWeek: 'km / sem.',
      },
      activitiesTitle: 'Activités suivies',
      empty: 'Aucune activité enregistrée avec cette paire pour le moment.',
      verdict: {
        eyebrow: (statusLabel: string) => `Verdict · ${statusLabel}`,
        weeksLeft: (weeks: number) => `Encore ~${weeks} semaines à ton rythme.`,
        planReplacement: 'Prévois la remplaçante ce mois-ci.',
        replaceNow: 'Prévois la remplaçante dès maintenant.',
        noPaceData: 'Pas assez de kilométrage récent pour projeter un horizon.',
      },
    },
  },

  profile: {
    hero: {
      lifetime: (runs: number, km: number) => `${runs} sorties · ${km.toLocaleString('fr')} km au total`,
      rankLine: (tier: string, pct: number) => `Rang ${tier} · top ${pct}% de VO₂max pour ton âge`,
      rankBadge: (tier: string) => `RANG ${tier}`,
      topPctLine: (pct: number) => `Top ${pct}% de VO₂max pour ton âge`,
      namePlaceholder: 'Votre nom',
    },
    ytd: {
      thisYearChip: 'Cette année',
      allTimeChip: 'Tout',
      distance: 'Distance',
      duration: 'Durée',
      sessions: 'Séances',
      elevation: 'Dénivelé',
      avgPerWeek: 'Moy. / semaine',
      calories: 'Calories',
    },
    records: {
      title: 'Records',
      notYet: 'Pas encore',
      viewAll: 'Voir les records',
      newBadge: 'NOUVEAU',
    },
    shoes: {
      title: 'Chaussures',
      pairs: (n: number) => `${n} paire${n !== 1 ? 's' : ''} active${n !== 1 ? 's' : ''}`,
      allGood: 'Tout va bien',
      needsReplacing: (n: number) => n === 1 ? '1 paire à remplacer' : `${n} paires à remplacer`,
      viewShoes: 'Voir les chaussures',
    },
    milestones: {
      distanceTier: (km: number) => `${km} km cette année`,
      distanceTierDetail: (year: number) => `Franchi en ${year}`,
      streak: (weeks: number) => `${weeks} semaines d’affilée`,
      streakDetail: 'Toujours en cours - une sortie chaque semaine depuis',
      record: (label: string) => `Record ${label}`,
      firstActivity: 'Premier pas',
      firstActivityDetail: (km: number) => `Le début de l’aventure - ${km.toFixed(1)} km`,
      lifetimeDistance: (km: number) => `${km.toLocaleString('fr-FR')} km au total`,
      lifetimeDistanceDetail: (marathons: number) => `≈ ${marathons.toLocaleString('fr-FR')} marathons courus`,
      lifetimeDistanceWorldTour: '🌍 Le tour du monde à l’équateur',
      activityCount: (n: number) => `${n}ᵉ sortie`,
      activityCountDetail: (km: number) => `${km.toLocaleString('fr-FR')} km parcourus au total`,
    },
    hrZones: {
      title: 'Zones cardiaques',
      lthr: 'LTHR',
      thisWeek: 'Cette semaine',
      recentWeeks: '4 dernières semaines',
      noSessionsThisWeek: 'Aucune séance enregistrée pour le moment.',
      emptyWeekFallback: 'Pas encore de séance cette semaine - affichage des 4 dernières semaines.',
      insight: {
        polarized: (pct: number, zoneLabel: string) =>
          `Très polarisé : ${pct}% en ${zoneLabel}, peu de travail au seuil. Cohérent avec une phase de base.`,
        dominant: (pct: number, zoneLabel: string) => `${pct}% du temps se passe en ${zoneLabel}.`,
      },
    },
    athlete: {
      title: 'Athlète',
      lthr: 'LTHR',
      notSet: 'Non défini',
      viewAthlete: 'Voir le profil athlète',
      details: 'Détails',
      zoneRows: {
        5: 'Z5 Max',
        4: 'Z4 Seuil',
        2: 'Z2 Facile',
      } as Record<number, string>,
      vo2maxShort: 'VO₂MAX',
      vmaShort: 'VMA',
      lthrShort: 'LTHR',
    },
    goal: {
      title: (year: number) => `Objectif ${year}`,
      progress: (total: number, target: number) => `${total} / ${target} km`,
      viewGoals: 'Voir les objectifs',
    },
  },

  records: {
    title: 'Meilleurs temps',
    // Display names for the fixed record distances (see @/domain/activity/effort).
    distances: {
      '1k': '1K',
      '1mile': '1 mile',
      '5k': '5K',
      '10k': '10K',
      half: 'Semi',
      marathon: 'Marathon',
      longest: 'Plus longue sortie',
    } as Record<string, string>,
    mostRecent: 'plus récent',
    raceTag: 'course',
    notYetRun: 'Pas encore couru',
    segmented: {
      prs: 'Records',
      milestones: 'Étapes',
      routes: 'Parcours',
    },
    recurring: {
      title: 'Les parcours où tu reviens',
      subtitle: 'Même terrain, mêmes bosses - le seul cas où l’allure brute se compare d’un mois à l’autre.',
      runCount: (n: number) => `${n} fois`,
      best: 'Record',
    },
    noRecordYet: 'Pas encore de record',
    predictedFromFitness: (time: string) => `Prédit à ${time}`,
    findRace: (distance: string) => `Trouver un ${distance.toLowerCase()} ›`,
  },

  pbAlerts: {
    off: (diff: string) => `à ${diff} de votre RP`,
  },

  nextRace: {
    countdown: (days: number) => `J-${days}`,
  },

  trainingZones: {
    title: 'Zones d’entraînement',
    thresholdLabel: (pace: string) => `Seuil ${pace}`,
    perKm: '/km',
    zones: {
      easy: {
        label: 'Facile',
        shortDesc: 'Base aérobie & récupération',
        example: 'Sorties longues, échauffement, retour au calme',
      },
      marathon: {
        label: 'Marathon',
        shortDesc: 'Puissance aérobie & allure course',
        example: 'Sorties longues en tempo, séances à allure marathon',
      },
      threshold: {
        label: 'Seuil',
        shortDesc: 'Confortablement dur - allure seuil',
        example: 'Intervalles cruise, tempo de 20 à 40 min',
      },
      vo2max: {
        label: 'VO2max',
        shortDesc: 'Effort course 5 km - allure I',
        example: 'Intervalles de 3 à 5 min, séances sur piste',
      },
    },
  },

  loadBalance: {
    title: 'Équilibre des charges',
    window: '4 dernières semaines',
    buckets: {
      aerobicLow: 'Aérobie basse',
      aerobicHigh: 'Aérobie haute',
      anaerobic: 'Anaérobie',
    },
    verdict: {
      below: 'Sous la cible',
      onTarget: 'Dans la cible',
      above: 'Au-dessus',
    },
    range: (min: number, max: number) => `Cible ${min}–${max}`,
    // Garmin's own phrases; anything it adds later falls back to the raw code.
    feedback: {
      BELOW_TARGETS: 'Sous les cibles',
      ABOVE_TARGETS: 'Au-dessus des cibles',
      ON_TARGET: 'Équilibre optimal',
      LACKING_HIGH_AEROBIC: 'Manque d’aérobie haute',
      LACKING_LOW_AEROBIC: 'Manque d’aérobie basse',
      LACKING_ANAEROBIC: 'Manque d’anaérobie',
      ANAEROBIC_SHORTAGE: 'Manque d’anaérobie',
      NO_DATA: 'Pas assez de données',
    } as Record<string, string | undefined>,
    footnote: 'Charge Firstbeat des 4 dernières semaines par intensité, face aux plages que Garmin personnalise à partir de votre historique. Le repère indique où vous vous situez ; la zone verte est la cible.',
  },

  loadRisk: {
    title: 'Risque de charge',
    insufficientData: 'Données insuffisantes',
    summary: {
      clear: (total: number) => `${total} marqueurs, aucun en alerte`,
      flagged: (count: number) => `${count} marqueur${count !== 1 ? 's' : ''} à surveiller`,
    },
    acwr: {
      label: 'ACWR',
      description: 'Charge aiguë/chronique estimée sur les km · cible 0,8–1,3',
      descriptionGarmin: 'Charge aiguë/chronique mesurée par la montre',
    },
    monotony: { label: 'Monotonie', description: 'Variété de charge au quotidien · alerte au-delà de 2,0' },
    rampRate: { label: 'Progression', description: 'Δ CTL sur 7 jours' },
  },

  plan: {
    today: 'Aujourd’hui',
    prevPeriod: 'Précédent',
    nextPeriod: 'Suivant',
    summary: (sessions: number, km: number) =>
      `${sessions} séance${sessions > 1 ? 's' : ''} · ${km} km`,
    weekdays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    switcher: { week: 'Semaine', month: 'Mois' },
    // Abbreviated: sits between the period chevrons, where the full word wraps.
    weekOf: (label: string) => `Sem. du ${label}`,
    // Abréviations calibrées pour une case de 44px : les noms complets y sont
    // tronqués en charabia.
    typeShort: {
      Sprint: 'Sprint',
      Anaerobic: 'Anaéro',
      VO2Max: 'VO2',
      Threshold: 'Seuil',
      Tempo: 'Tempo',
      Base: 'Base',
      Race: 'Course',
    } as Record<ActivityType, string>,
    restDay: 'Repos',
    planned: 'Prévu',
    // Shown in place of the raw "Easy" zone name on a planned Base run.
    easyEffortLabel: 'EF',
    structure: {
      title: 'Structure',
      warmup: 'Échauffement',
      cooldown: 'Repos',
      single: (min: number, zone: string) => `${min}' @ ${zone}`,
      reps: (n: number, effort: number, zone: string) => `${n} × ${effort}' @ ${zone}`,
      repsWithRecovery: (n: number, effort: number, recovery: number, zone: string) => `${n} × ${effort}' @ ${zone} / ${recovery}' facile`,
      easyZone: 'Z1-Z2',
      min: (m: number) => `${m}'`,
    },
    nextWeek: (n: number) => `Semaine prochaine - ${n} prévue${n > 1 ? 's' : ''}`,
    comingUp: 'À venir',
    timeOfDay: {
      Morning: 'Matin',
      Afternoon: 'Après-midi',
      Evening: 'Soir',
      Night: 'Nuit',
    } as Record<ScheduledTimeOfDay, string>,
    keyTag: 'clé',
    openPlanner: 'Ouvrir le planificateur',
    viewDetail: 'Voir le détail',
    type: 'Type',
    weekSummary: {
      load: 'Charge',
      vsTypical: (percent: number) => `${percent - 100 >= 0 ? '+' : ''}${percent - 100}% vs type`,
      easyHard: 'Facile / Dur',
      elevation: 'D+',
      climb: 'D+',
    },
    raceFooter: {
      inDays: (days: number) => (days === 0 ? "aujourd'hui" : days === 1 ? 'dans 1 jour' : `dans ${days} jours`),
      weeksIn: (done: number, total: number) => `${done}/${total}`,
      weeksInLabel: 'semaines',
    },
    phaseTrack: {
      base: 'Base',
      build: 'Dévelop.',
      peak: 'Pic',
      taper: 'Affûtage',
      raceDay: 'Course',
    },
    weekPurpose: {
      recovery: 'Semaine de récupération',
      steady: 'Semaine stable',
      build: 'Semaine de développement',
      thisWeek: 'Cette semaine',
      upcoming: 'Semaine à venir',
      planPhase: {
        base: 'Semaine de base',
        build: 'Semaine de développement',
        peak: 'Semaine de pic de forme',
        taper: 'Semaine d’affûtage',
        raceDay: 'Jour de course',
      },
      plannedSessions: (total: number, key: number) =>
        key > 0
          ? `${total} séance${total > 1 ? 's' : ''} · ${key} qualité`
          : `${total} séance${total > 1 ? 's' : ''}`,
      weekOfBlock: (done: number, total: number) => `semaine ${done} sur ${total}`,
      adherence: (done: number, due: number) => `${done} / ${due} faites`,
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
} satisfies Strings
