/**
 * Case/accent-insensitive substring matcher shared by the app's list
 * search boxes (encomendas, requerimentos), so "producao" also finds
 * "Produção" and the filtering behaviour stays consistent across the
 * admin and client views.
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesSearch(
  query: string,
  ...fields: (string | undefined | null)[]
): boolean {
  const q = normalize(query);
  if (!q) return true;
  return fields.some((field) => !!field && normalize(field).includes(q));
}
