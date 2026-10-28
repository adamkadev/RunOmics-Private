import { describe, expect, it } from 'vitest'
import { asksNoStopSignals, carriesStopSignal } from '../stopSignals'

describe('asksNoStopSignals', () => {
  it.each([
    'Write no stop signals or symptom warnings in sessions, descriptions or focus.',
    'No stop signal.',
    "Pas de signaux d'arrêt dans le plan.",
    'Pas de signaux d’arrêt dans le plan.',
    'Aucun signal d’arrêt.',
    'Course/marche, sans signaux d’arret.',
  ])('switches on for %j', (guidance) => {
    expect(asksNoStopSignals(guidance)).toBe(true)
  })

  it.each([
    undefined,
    '',
    'Run/walk by time; stop on any pain.',
    'Signaux d’arrêt : douleur au mollet.',
  ])('stays off for %j', (guidance) => {
    expect(asksNoStopSignals(guidance)).toBe(false)
  })
})

describe('carriesStopSignal', () => {
  it.each([
    'Stop if it hurts.',
    'Stop on any leaking.',
    'Stop and see the physio on any pain at the injured site.',
    'Stop the session if your lower back aches.',
    'Any pain, walk home.',
    'It may hurt a little.',
    'Talk to your doctor first.',
    'Watch for symptoms of heaviness.',
    'Pelvic floor first.',
    'Arrête-toi si ça empire en route.',
    'Arrête de courir si ça tire.',
    'Arrête si fuite, pesanteur ou douleur.',
    'Stoppe la séance au moindre doute.',
    'Interromps la séance et marche.',
    'En cas de gêne, marche.',
    'En cas de douleur, marche.',
    'Une douleur au mollet.',
    'Des douleurs diffuses.',
    'Une jambe douloureuse.',
    'Une fois les symptômes passés.',
    'Une lourdeur dans le bas-ventre.',
    'Une pression vers le bas.',
    'Une gêne dans le bassin.',
    'Une gêne dans le bas du dos.',
    'Vois ta kiné avant de reprendre.',
    'Demande à ton kinésithérapeute.',
    'Parles-en à ton médecin.',
    'Ta sage-femme valide la reprise.',
    'Fais-la examiner dans quelques jours.',
    'Le périnée travaille aussi.',
    'Pas de signaux d’arrêt cette semaine.',
    'DOULEUR AU GENOU',
  ])('refuses %j', (text) => {
    expect(carriesStopSignal(text)).toBe(true)
  })

  it.each([
    'Course facile, marche si besoin.',
    'Course continue, marche si besoin.',
    'Cours en aisance et sans pression.',
    'Easy, walk when you need to.',
    'Run/walk: 1 min run, 2 min walk, 8 times.',
    'Le plan s’arrête le 12 nov.',
    'Renouvelle le jeton avant que la synchro s’arrête.',
    '3 à l’arrêt',
    'Les courbatures et les jambes lourdes passent avec une sortie facile.',
    'Un peu de fatigue : garde la journée facile.',
    'Cours au rythme où tu peux parler en phrases complètes.',
    'Prends du pain avant la sortie longue.',
    'Nage en bassin pour varier.',
    'Painting the fence counts as rest.',
    'Gêne 3 sur 10',
    'Aucune gêne en 4 semaines.',
    'Stopwatch ready.',
    'Saute la séance et reprends au prochain jour prévu.',
  ])('accepts %j', (text) => {
    expect(carriesStopSignal(text)).toBe(false)
  })
})
