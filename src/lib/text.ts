/**
 * Splits a leading emoji off a name, as people often name their Savers ("🗾 Japan Trip").
 * Returns `emoji: null` when the name doesn't start with one.
 */
export function splitLeadingEmoji(name: string): { emoji: string | null; label: string } {
  const space = name.indexOf(' ');
  if (space <= 0) return { emoji: null, label: name };
  const first = name.slice(0, space);
  // An emoji is non-ASCII and contains no letters or digits.
  const isEmoji = /[^\u0000-\u007F]/.test(first) && !/[\p{L}\p{N}]/u.test(first);
  return isEmoji ? { emoji: first, label: name.slice(space + 1) } : { emoji: null, label: name };
}
