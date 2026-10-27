export function isEmptyNote(note: { note: string; tags: readonly string[]; hrUnreliable?: true }): boolean {
  return note.note === '' && note.tags.length === 0 && !note.hrUnreliable
}
