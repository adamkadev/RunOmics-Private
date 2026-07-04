# RunOmics — Todolist d'amélioration produit

Audit exhaustif du dépôt (v3.1, ~20 200 lignes TS/TSX, App Router Next.js 16, SSG,
Firestore pour les données éditables, pipeline Python de sync Garmin). Regroupé
par thème, avec une estimation d'impact/effort à titre indicatif (🔴 haute
priorité, 🟡 moyenne, 🟢 confort/nice-to-have).

---

## 1. Fiabilité & robustesse

- [x] 🔴 **Pas de `error.tsx` global ni par section** (`src/app/error.tsx`,
      `src/app/global-error.tsx`). Aucune erreur runtime dans un composant serveur
      n'est actuellement rattrapée proprement — l'utilisateur tombe sur l'écran
      d'erreur Next.js générique. Ajouter un `error.tsx` par route principale
      (dashboard, activities, analytics, calendar…) avec un message + bouton
      "réessayer" cohérent avec le design system. *(✅ fait en 3.2 : `error.tsx` racine + `global-error.tsx`, fallback partagé `ErrorFallback`.)*
- [x] 🟡 Auditer les endpoints `/api/internal/*` : bonne pratique déjà en place
      (`timingSafeEqual` dans `internalAuth.ts`), mais aucun rate limiting —
      un secret qui fuite permet un flood illimité de push notifications.
      Ajouter une limite basique (par IP ou par fenêtre de temps) même en mémoire. *(✅ fait en 3.2 : garde `handleInternalRoute` avec fenêtre fixe 20 req/min/IP appliquée avant le check du secret.)*
- [x] 🟡 `scripts/sync.py` / `sync_workouts.py` : vérifier la stratégie de retry
      réseau (Garmin Connect a des rate limits connus) — documenter/ajouter un
      backoff exponentiel s'il n'existe pas déjà, pour fiabiliser le cron GitHub
      Actions. *(✅ fait en 3.2 : `garmin/retry.py`, backoff exponentiel 429/5xx/erreurs réseau, corps de boucle isolé par activité.)*
- [x] 🟢 Ajouter une page de fallback offline dédiée (actuellement le SW retombe
      sur le dashboard en cache — vérifier le comportement quand *aucune* page
      n'a encore été mise en cache, ex. premier accès sans réseau). *(✅ vérifié
      en 3.2 : `SHELL_URLS` précache `/` dès l'installation du SW, donc même un
      premier deep link hors ligne obtient le shell du dashboard.)*

## 2. Sécurité

- [x] 🔴 **Règles de sécurité Firestore absentes du dépôt** (`firestore.rules`
      introuvable). Les écritures (notes d'activité, settings, goals/pbs/athlete)
      passent par le SDK client Firebase et reposent donc entièrement sur les
      security rules côté Firebase — non versionnées, non revues, non testées.
      Ajouter le fichier de règles au repo (source de vérité), avec des tests
      via l'émulateur Firestore si possible. *(✅ fait en 3.2 : `firestore.rules` versionné ; tests émulateur toujours ouverts.)*
- [x] 🟡 Le contrôle d'accès "propriétaire" (`NEXT_PUBLIC_OWNER_EMAIL`) n'est
      qu'un gate d'affichage côté client (`ActivityNotes.tsx`,
      `SettingsClient.tsx`) — normal pour l'UX, mais **la vraie autorisation
      doit être garantie par les Firestore rules** (cf. point ci-dessus), pas
      par ce composant. À documenter clairement dans le README pour éviter une
      fausse impression de sécurité. *(✅ documenté en 3.2 dans le README + en-tête de `firestore.rules`.)*
- [x] 🟡 Ajouter une **Content-Security-Policy** dans `next.config.ts` (headers
      actuels couvrent X-Frame-Options/HSTS/Permissions-Policy mais pas de CSP).
      Utile vu l'intégration MapLibre/MapTiler + Firebase + service worker. *(✅ fait en 3.2 dans `next.config.ts`.)*
- [x] 🟢 `npm audit` / `pip-audit` (ou Dependabot) pas visibles dans la CI —
      ajouter un job de scan de dépendances régulier (déjà partiellement couvert
      si Dependabot est activé côté GitHub, à vérifier). *(✅ partiellement fait en 3.2 : step `npm audit --omit=dev --audit-level=high` bloquant en CI ; pip-audit/Dependabot toujours ouverts.)*

## 3. Performance

- [x] 🟡 **Liste des activités** (`ActivityListClient.tsx` + pagination
      serveur) : le backlog v3 mentionne déjà la virtualisation "si la liste
      dépasse quelques centaines de lignes" — au rythme d'un coureur régulier
      (300-500 activités/an), c'est probablement déjà pertinent après 2-3 ans
      d'historique. Ajouter `react-window` ou équivalent sur la vue liste. *(✅ fait en 3.2 via `content-visibility: auto` sur les cartes — les cartes hors écran ne coûtent plus ni layout ni paint ; react-window reste une option si le DOM lui-même devient trop gros.)*
- [x] 🟡 Vérifier la taille des JSON par année sous `public/data/activities/` —
      avec les traces GPS complètes, ces fichiers peuvent grossir vite. Mesurer
      le poids réel et envisager un split "métadonnées légères" (dashboard/liste)
      vs "détail complet avec trace GPS" (page activité), pour ne charger la
      polyline que sur la page qui en a besoin. *(✅ vérifié en 3.2 : 6-7 MB/an mais lus uniquement côté serveur (fs) ; les résumés envoyés au client excluent déjà polylines et échantillons. Rien à faire côté client.)*
- [x] 🟢 Pas de bundle analyzer configuré (`@next/bundle-analyzer` absent).
      L'ajouter en devDependency pour surveiller la taille du bundle client au
      fil des ajouts de features (Recharts + MapLibre pèsent déjà lourd). *(✅ fait en 3.2 : `npm run analyze`.)*
- [x] 🟢 Vérifier le lazy-loading de MapLibre GL (import dynamique déjà probable
      vu `next/dynamic` utilisé ailleurs) — confirmer qu'il n'est jamais chargé
      sur les pages sans carte (dashboard, analytics). *(✅ vérifié en 3.2 : import dynamique dans `ActivityMap` uniquement.)*

## 4. Tests & qualité

- [x] 🔴 **Aucun test de composant React** — seulement des tests unitaires sur
      `application/usecases` et `src/lib` (15 fichiers `.test.ts`). Zéro
      couverture sur les composants UI (cards, modals, formulaires Settings,
      ShareCardModal récemment refactorisé). Ajouter React Testing Library sur
      les composants les plus critiques : `ActivityNotes`, `SettingsClient`
      (contrôle d'accès), `ShareCardModal`, `useFocusTrap`. *(✅ première couche posée en 3.2 : `useFocusTrap`, `ActivityNotes` (gate propriétaire), `ErrorFallback` ; `SettingsClient`/`ShareCardModal` restent à couvrir.)*
- [x] 🟡 **Aucun test end-to-end** (Playwright déjà pré-installé dans
      l'environnement d'exécution mais pas utilisé dans le projet). Un parcours
      e2e minimal (dashboard → activité → partage, calendrier → séance planifiée)
      sécuriserait les refontes visuelles fréquentes (déjà 2 redesigns majeurs
      en v2/v3). *(✅ fait en 3.3 : Playwright branché sur un projet Firebase
      dédié `runomics-dev` (pas de mock), fixtures versionnées + script de seed
      idempotent, job CI dédié gated sur les secrets `DEV_FIREBASE_*`. Premier
      lot = parcours lecture seule (dashboard, activités → détail, calendrier,
      records, goals) ; les flux gated par connexion (Settings, notes) restent
      à couvrir, nécessitent un bypass d'auth dédié aux tests.)*
- [x] 🟡 Pas de rapport de couverture configuré dans `vitest.config.ts`
      (`test.coverage`). Ajouter `@vitest/coverage-v8` et un seuil minimal en CI. *(✅ fait en 3.2 : `npm run test:coverage` (v8, text+lcov), sans seuil bloquant pour l'instant.)*
- [ ] 🟢 Scripts Python (`scripts/`) explicitement exclus du lint ESLint (normal,
      ce n'est pas du JS) mais aucun test Python visible (`pytest`, etc.) pour
      `sync.py`/`reprocess.py`/parsing FIT — au moins un test sur le parsing des
      splits/records serait rassurant vu leur rôle central dans les PRs/records.

## 5. Accessibilité

- [x] 🟡 Bon travail déjà fait (focus trap, `inert`, `role="dialog"`, tablist
      ARIA) — mais **pas de test automatisé** (`axe-core`/`jest-axe`) pour
      empêcher les régressions sur les prochains refontes de composants.
      Ajouter un smoke test a11y sur les pages principales. *(✅ amorcé en 3.2 : smoke axe-core sur `ErrorFallback` ; à étendre aux autres composants.)*
- [x] 🟢 Vérifier le contraste des couleurs d'accent personnalisables (le
      color-picker permet un accent libre — un accent trop clair/foncé peut
      casser le contraste WCAG AA sur certains éléments). Ajouter une validation
      ou un avertissement dans le picker. *(✅ fait en 3.2 : la palette est fixe, un test verrouille un ratio ≥ 3:1 (WCAG 1.4.11) pour les 6 accents sur les deux thèmes.)*
- [ ] 🟢 Graphiques Recharts : vérifier la présence de résumés textuels
      (`aria-label`/`<caption>` équivalent) pour les lecteurs d'écran — les
      charts SVG sont rarement accessibles nativement.

## 6. Internationalisation

- [ ] 🟡 Le switch de langue est **build-time uniquement**
      (`NEXT_PUBLIC_LOCALE`), documenté comme limitation connue dans le
      changelog. Passer `t` derrière un contexte React (déjà identifié comme
      piste) pour permettre un vrai sélecteur de langue en Settings sans
      redeploy — cohérent avec le fait que Settings gère déjà les préférences
      utilisateur (thème, accent…). *(⏸ non fait en 3.2 : `t` est importé au
      niveau module dans ~100 fichiers, y compris des composants serveur SSG —
      un contexte React ne couvrirait que le client et produirait une UI
      mi-anglaise mi-française. Un vrai switch runtime exige soit un segment
      `[locale]` (deux arbres statiques), soit du rendu par requête via cookie.
      Chantier structurel à part entière.)*
- [ ] 🟢 N'ajouter d'autres locales (ex. `es.ts`, `de.ts`) que si un besoin
      utilisateur réel apparaît — le pattern `satisfies Strings` facilite déjà
      l'ajout.

## 7. PWA / offline

- [x] 🟡 Le SW gère bien le cache-first/network-first, mais pas de **stratégie
      de mise à jour visible** (bandeau "nouvelle version disponible" quand un
      nouveau SW est en attente) — actuellement l'utilisateur doit fermer/rouvrir
      l'app pour récupérer la nouvelle version après un déploiement. *(✅ fait en 3.2 : bandeau « nouvelle version » + SKIP_WAITING + reload sur controllerchange.)*
- [x] 🟢 Ajouter un écran/action "Effacer le cache offline" dans Settings pour
      débugger les soucis de contenu périmé sans devoir vider le cache navigateur
      manuellement. *(✅ fait en 3.2 : bouton dans Réglages > Données.)*
- [x] 🟢 Icônes PWA : un seul icône PNG (`apple-touch-icon.png` 180×180) — ajouter
      les tailles maskable/192/512 recommandées pour un meilleur rendu sur
      Android/Chrome install prompt. *(✅ fait en 3.2 : maskable 192/512 générées depuis le SVG de marque.)*

## 8. Observabilité

- [x] 🟡 Vercel Analytics + Speed Insights sont présents, mais **aucun tracking
      d'erreurs runtime** (pas de Sentry ni équivalent). Pour une app perso, un
      simple logging serveur des erreurs des routes `/api/internal/*` (échecs de
      push, échecs Firestore) éviterait de découvrir un cron cassé des semaines
      plus tard. *(✅ fait en 3.2 : logs structurés `[internal:<route>]` + 500 remontés aux workflows ; un tracker type Sentry reste une option.)*
- [x] 🟢 Ajouter un endpoint `/api/internal/health` (ou un log structuré) pour
      vérifier que le dernier sync Garmin a bien tourné — actuellement le seul
      signal est l'historique GitHub Actions. *(✅ fait en 3.2.)*

## 9. Data pipeline (Python / Garmin sync)

- [x] 🟡 Documenter/vérifier le comportement en cas d'échec partiel de
      `sync.py` (ex. FIT file corrompu, timeout Garmin en cours de sync) —
      s'assurer qu'un échec sur une activité n'interrompt pas tout le run et
      que les activités déjà traitées sont bien committées.
      Confirmé bypass IP via Cloudflare WARP. *(✅ fait en 3.2 : isolation complète par activité — un FIT corrompu ou une erreur inattendue compte comme échec sans avorter le run.)*
- [x] 🟢 `scripts/backfill_gear.py` et `scripts/reprocess.py` : ajouter un mode
      `--dry-run` s'il n'existe pas, pour prévisualiser l'impact avant d'écraser
      les JSON committés. *(✅ fait en 3.2 : `--dry-run` ajouté à `reprocess.py` ; `backfill_gear.py` et `sync.py` l'avaient déjà.)*

## 10. CI/CD

- [ ] 🟢 Le job CI skip le `build` complet sur les forks/PRs externes sans
      secrets Firebase — acceptable pour un projet perso, mais si des
      contributions externes sont envisagées, prévoir un mode "build sans
      Firestore" (données goals/pbs/athlete mockées) pour que les PRs externes
      valident quand même le build.
- [x] 🟢 Ajouter un job `npm audit --audit-level=high` (ou Dependabot déjà actif
      à vérifier) et un cache Python pip dans `sync.yml` si pas déjà présent. *(✅ fait en 3.2 pour npm audit ; cache pip déjà présent dans `sync.yml` (setup-python).)*

## 11. Fonctionnalités produit (au-delà du technique)

- [ ] 🟢 **Comparaison d'activités** a été supprimée en v2.0 au profit de la
      pagination — si le besoin revient, la réintroduire sous une forme plus
      légère (sélection multi-activités dans la liste + vue comparative) plutôt
      que la modal dédiée d'origine.
- [ ] 🟢 **Export GPX** en plus du CSV/JSON existant (`/api/activities/export`)
      — utile pour réimporter une trace dans un autre outil (Strava, Komoot…).
- [ ] 🟢 **Widget météo/altitude prévisionnelle** pour les courses à venir
      (le calendrier a déjà les séances planifiées Garmin) — utile pour la
      préparation de course.
- [ ] 🟢 **Partage public en lecture seule** d'un profil (au-delà du share card
      PNG) — un lien "vue publique" avec un sous-ensemble de stats, pour montrer
      sa progression sans donner l'accès complet aux notes/tags privés.
- [ ] 🟢 **Import manuel d'activité** (hors Garmin) pour les séances non trackées
      (piscine, home-trainer) — actuellement 100% dépendant de Garmin Connect.

## 12. Documentation / DX

- [x] 🟢 Le README est déjà très complet ; ajouter une section "Architecture
      des tests" (où sont les tests, comment les lancer, ce qui manque) et un
      lien vers ce document de todolist pour centraliser le suivi. *(✅ fait en 3.2 : section « Tests & quality » + lien vers ce document.)*
- [ ] 🟢 Ajouter un `CONTRIBUTING.md` minimal si des contributions externes sont
      envisagées (conventions de commit déjà lisibles dans l'historique/CHANGELOG,
      juste à formaliser).

---

### Priorisation suggérée (top 5 à traiter en premier)

1. 🔴 `error.tsx` global + par route (fiabilité perçue, effort faible)
2. 🔴 Versionner et tester les Firestore security rules (sécurité, effort moyen)
3. 🟡 Rate limiting basique sur `/api/internal/*` (sécurité, effort faible)
4. 🟡 Virtualisation de la liste d'activités (perf, effort faible-moyen)
5. 🟡 Tests de composants React sur les surfaces d'écriture (Notes, Settings,
   ShareCardModal) (qualité, effort moyen)
