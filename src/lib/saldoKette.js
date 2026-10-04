// Bringt Kassenzeilen in die Buchungsreihenfolge (älteste zuerst).
// Innerhalb eines Tages entscheidet die Saldo-Kette: Saldo vorher + Einnahme − Ausgabe = Saldo der Zeile.
// Passt keine Zeile in die Kette, bleibt die Reihenfolge nach created_at.
export function nachSaldoKette(rows) {
  const all = [...rows].sort((a, b) =>
    a.datum < b.datum ? -1 : a.datum > b.datum ? 1
      : (a.created_at || '') < (b.created_at || '') ? -1 : (a.created_at || '') > (b.created_at || '') ? 1 : 0);
  const out = [];
  let prev = 0;
  let i = 0;
  while (i < all.length) {
    const day = [];
    const d0 = all[i].datum;
    while (i < all.length && all[i].datum === d0) day.push(all[i++]);
    while (day.length) {
      let k = day.findIndex((r) =>
        Math.abs(prev + Number(r.einnahme || 0) - Number(r.ausgabe || 0) - Number(r.saldo || 0)) < 1);
      if (k < 0) k = 0;
      const r = day.splice(k, 1)[0];
      out.push(r);
      prev = Number(r.saldo || 0);
    }
  }
  return out;
}
