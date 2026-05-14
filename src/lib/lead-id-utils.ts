/**
 * Validates a uniqueLeadId string.
 * Must be non-empty, max 64 chars, no whitespace.
 */
export function validateUniqueLeadId(id: string): string | null {
  if (!id || id.trim().length === 0) return 'Lead ID cannot be empty';
  if (id.length > 64) return 'Lead ID must be 64 characters or fewer';
  if (/\s/.test(id)) return 'Lead ID cannot contain whitespace';
  return null;
}
