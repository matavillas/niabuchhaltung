import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Umsatz-Balkendiagramme nach Check-in-Monat.
// Zimmer: hotel_buchungen_gesamt (Booking.com, Agoda, Direkt) nach Check-in, inkl. künftiger Buchungen.
// Restaurant: Einnahmen Konto 402 aus Bankbuch und Kassenbuch nach Zahlungsmonat.

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const FARBEN = { zimmer: '#1f4e79', restaurant: '#e0912f', vorjahr: '#9db7d1' };

async function alleZeilen(baueQuery) {
  const SEITE = 1000;
  let alle = [];
  for (let von = 0; ; von += SEITE) {
    const { data, error } = await baueQuery().range(von, von + SEITE - 1);
    if (error) throw error;
    alle = alle.concat(data || []);
    if (!data || data.length < SEITE) break;
  }
  return alle;
}

function leer() {
  return Array(12).fill(0);
}

function mio(v) {
  return (v / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function Diagramm({ titel, reihen }) {
  const max = Math.max(1, ...reihen.flatMap((r) => r.werte));
  const summe = (r) => r.werte.reduce((a, b) => a + b, 0);
  return (
    <div style={styles.karte}>
      <div style={styles.titel}>{titel}</div>
      <div style={styles.legende}>
        {reihen.map((r) => (
          <span key={r.name} style={styles.legendeEintrag}>
            <span style={{ ...styles.punkt, background: r.farbe }} />
            {r.name}: {mio(summe(r))} Mio.
          </span>
        ))}
      </div>
      <div style={styles.flaeche}>
        {MONATE.map((m, i) => (
          <div key={m} style={styles.spalte}>
            <div style={styles.balkenGruppe}>
              {reihen.map((r) => (
                <div
                  key={r.name}
                  title={`${r.name} ${m}: Rp ${Math.round(r.werte[i]).toLocaleString('de-DE')}`}
                  style={{
                    ...styles.balken,
                    background: r.farbe,
                    height: `${(r.werte[i] / max) * 100}%`,
                  }}
                >
                  {r.werte[i] > 0 && reihen.length === 1 && (
                    <span style={styles.wert}>{mio(r.werte[i])}</span>
                  )}
                </div>
              ))}
            </div>
            <div style={styles.monat}>{m}</div>
          </div>
        ))}
      </div>
      <div style={styles.einheit}>in Mio. Rp</div>
    </div>
  );
}

export default function UmsatzDiagramme() {
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState('');
  const aktuellesJahr = new Date().getFullYear();

  useEffect(() => {
    (async () => {
      try {
        const [zimmer, bank, kasse] = await Promise.all([
          alleZeilen(() => supabase.from('hotel_buchungen_gesamt').select('checkin,betrag_brutto')),
          alleZeilen(() => supabase.from('bankbuch').select('datum,credit').eq('konto_neu', '402')),
          alleZeilen(() => supabase.from('kassenbuch').select('datum,einnahme').eq('konto', '402')),
        ]);
        const zimmerJahr = {};
        const restoJahr = {};
        const add = (ziel, datum, betrag) => {
          if (!datum || !betrag) return;
          const j = Number(datum.slice(0, 4));
          const m = Number(datum.slice(5, 7)) - 1;
          if (!ziel[j]) ziel[j] = leer();
          ziel[j][m] += Number(betrag);
        };
        zimmer.forEach((z) => add(zimmerJahr, z.checkin, z.betrag_brutto));
        bank.forEach((b) => add(restoJahr, b.datum, b.credit));
        kasse.forEach((k) => add(restoJahr, k.datum, k.einnahme));
        setDaten({ zimmerJahr, restoJahr });
      } catch (e) {
        setFehler(e.message);
      }
    })();
  }, []);

  const jahre = useMemo(() => {
    if (!daten) return {};
    const vorjahr = aktuellesJahr - 1;
    return {
      vorjahr,
      zVorjahr: daten.zimmerJahr[vorjahr] || leer(),
      rVorjahr: daten.restoJahr[vorjahr] || leer(),
      zAktuell: daten.zimmerJahr[aktuellesJahr] || leer(),
    };
  }, [daten, aktuellesJahr]);

  if (fehler) return <p style={{ color: '#b00020' }}>Diagramme: {fehler}</p>;
  if (!daten) return <p>Diagramme laden…</p>;

  return (
    <div style={styles.raster}>
      <Diagramm
        titel={`Umsatz ${jahre.vorjahr} nach Check-in-Monat (Zimmer + Restaurant)`}
        reihen={[
          { name: 'Zimmer', farbe: FARBEN.zimmer, werte: jahre.zVorjahr },
          { name: 'Restaurant', farbe: FARBEN.restaurant, werte: jahre.rVorjahr },
        ]}
      />
      <Diagramm
        titel={`Zimmerumsatz ${aktuellesJahr} nach Check-in-Monat (inkl. künftiger Buchungen)`}
        reihen={[{ name: `Zimmer ${aktuellesJahr}`, farbe: FARBEN.zimmer, werte: jahre.zAktuell }]}
      />
      <Diagramm
        titel={`Vergleich Zimmerumsatz ${jahre.vorjahr} / ${aktuellesJahr}`}
        reihen={[
          { name: String(jahre.vorjahr), farbe: FARBEN.vorjahr, werte: jahre.zVorjahr },
          { name: String(aktuellesJahr), farbe: FARBEN.zimmer, werte: jahre.zAktuell },
        ]}
      />
      <p style={styles.hinweis}>
        Zimmer: Booking.com, Agoda und Direktbuchungen nach Check-in-Datum (Daten ab August 2025).
        Restaurant: Einnahmen Konto 402 aus Bank und Kasse nach Zahlungsmonat.
      </p>
    </div>
  );
}

const styles = {
  raster: { display: 'grid', gap: 16, marginBottom: 24 },
  karte: { background: '#fff', border: '1px solid #e3e7ee', borderRadius: 10, padding: '14px 16px' },
  titel: { fontWeight: 600, fontSize: 15, marginBottom: 6 },
  legende: { display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#444', marginBottom: 8 },
  legendeEintrag: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  punkt: { width: 10, height: 10, borderRadius: 2, display: 'inline-block' },
  flaeche: { display: 'flex', alignItems: 'stretch', gap: 6, height: 220, borderBottom: '1px solid #ccd3dd' },
  spalte: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  balkenGruppe: { flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  balken: { flex: 1, maxWidth: 34, borderRadius: '3px 3px 0 0', position: 'relative', minHeight: 0 },
  wert: { position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#333', whiteSpace: 'nowrap' },
  monat: { textAlign: 'center', fontSize: 11, color: '#666', paddingTop: 4 },
  einheit: { fontSize: 11, color: '#888', marginTop: 4 },
  hinweis: { fontSize: 12, color: '#666', margin: 0 },
};
