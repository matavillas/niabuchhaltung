// Formatiert ein Datum (ISO "YYYY-MM-DD" oder Date-Objekt) als "TT.MM.JJJJ"
export function formatDatum(d) {
  if (!d) return '';
  const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const [, yyyy, mm, dd] = m;
  return `${dd}.${mm}.${yyyy}`;
}
