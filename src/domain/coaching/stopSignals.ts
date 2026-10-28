/** Typed text carries the curly apostrophe; a model may write either, and combining accents never match a literal é. */
function normalised(text: string): string {
  return text.normalize('NFC').replace(/[‘’ʼ]/g, "'")
}

const ASKS_NO_STOP_SIGNALS = /(?<!\p{L})(?:no\s+stop\s+signals?|(?:pas\s+de|aucun|sans)\s+signa(?:l|ux)\s+d'arr[êe]ts?)(?!\p{L})/iu

const STOP_SIGNAL = new RegExp([
  '(?<!\\p{L})(?:',
  [
    'stop\\s+signals?',
    'stop\\s+(?:if|on|and\\s+see|running|the\\s+(?:session|run|workout))',
    "signa(?:l|ux)\\s+d'arr[êe]ts?",
    '(?:arr[êe]te(?:-toi|r|z|z-vous)?|stoppe(?:r|z)?|interromp(?:s|re|ez))\\s+(?:si|de\\s+courir|(?:la|ta)\\s+(?:séance|sortie|course))',
    'en\\s+cas\\s+de\\s+(?:douleur|gêne|inconfort|sympt[ôo]mes?)',
    "fais(?:-la|-le)?\\s+(?:examiner|contrôler)",
    'douleurs?', 'douloureu(?:x|se|ses)', 'sympt[ôo]mes?', 'symptoms?', 'lourdeurs?',
    '(?<!(?:sans|sous)\\s)pressions?', '(?<!(?:en|au)\\s)bassins?', 'bas\\s+du\\s+dos', 'lower\\s+back',
    '(?<!(?:du|de|le|un|au|aux|ton|ce)\\s)pain(?:ful)?', 'hurts?', 'hurting',
    'kin[ée](?:s|sith[ée]rapeutes?)?', 'ost[ée]o(?:s|pathes?)?', 'm[ée]decins?', 'physio(?:s|therapists?)?', 'doctors?',
    'fuites?', 'pesanteur', 'leak(?:s|ing)?', 'heaviness', 'dragging', 'urgency', 'incontinence',
    'pelvi(?:c|en|enne|s)', 'p[ée]rin[ée]e', 'perineum', 'sage-femmes?', 'midwi(?:fe|ves)',
  ].join('|'),
  ')(?!\\p{L})',
].join(''), 'iu')

/** The guidance's own words, in either language the athlete may have written them in. */
export function asksNoStopSignals(guidance: string | undefined): boolean {
  return guidance !== undefined && ASKS_NO_STOP_SIGNALS.test(normalised(guidance))
}

export function carriesStopSignal(text: string): boolean {
  return STOP_SIGNAL.test(normalised(text))
}
