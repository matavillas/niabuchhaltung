import { useEffect, useState } from 'react';
import { erstelleBericht } from '../lib/liloBericht';
import { MONATE } from './Lohn';

const fmt = (n) => Number(n || 0).toLocaleString('de-DE');

function vormonat() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { jahr: d.getFullYear(), monat: d.getMonth() + 1 };
}

export default function BerichtLilo() {
  const start = vormonat();
  const [jahr, setJahr] = useState(start.jahr);
  const [monat, setMonat] = useState(start.monat);
  const [bericht, setBericht] = useState(null);
  const [laedt, setLaedt] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [auszuege, setAuszuege] = useState([]);

  useEffect(() => {
    let aktiv = true;
    setLaedt(true); setError(''); setMsg(''); setBericht(null);
    erstelleBericht(jahr, monat)
      .then((b) => { if (aktiv) setBericht(b); })
      .catch((e) => { if (aktiv) setError(e.message); })
      .finally(() => { if (aktiv) setLaedt(false); });
    return () => { aktiv = false; };
  }, [jahr, monat]);

  const text = bericht ? `Laporan bulanan PT Nusantara Indonesia Asri – ${MONATE[monat - 1]} ${jahr}: Payroll, Income Hotel, Income Bar, Rekening Koran.` : '';
  const alleDateien = bericht ? [...bericht.files, ...auszuege] : [];
  const kannTeilen = typeof navigator !== 'undefined' && navigator.canShare && bericht && navigator.canShare({ files: alleDateien });

  async function teilen() {
    setError(''); setMsg('');
    try {
      await navigator.share({ files: alleDateien, title: `Laporan ${MONATE[monat - 1]} ${jahr}`, text });
      setMsg('Geteilt.');
    } catch (e) {
      if (e.name !== 'AbortError') setError(`Teilen nicht möglich: ${e.message}`);
    }
  }

  function herunterladen() {
    bericht.files.forEach((f, i) => {
      setTimeout(() => {
        const url = URL.createObjectURL(f);
        const a = document.createElement('a');
        a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, i * 400);
    });
  }

  const i = bericht?.info;
  const warnungen = [];
  if (i) {
    if (!i.lohn.anzahl) warnungen.push('Für diesen Monat sind keine Löhne erfasst (Seite „Löhne“).');
    if (i.hotel.offen) warnungen.push(`${i.hotel.offen} Zimmerbuchung(en) sind im Zahlungsabgleich noch offen.`);
    if (!auszuege.length) warnungen.push('Noch keine Kontoauszüge hinzugefügt (Original-PDF aus Kopra für ...666, ...415, ...386, ...783).');
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ color: 'var(--color-primary)' }}>Monatsbericht an Lilo</h2>
      <p style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: -6 }}>
        Fällig am 5. jedes Monats für den Vormonat: Lohntabelle, Income Hotel, Income Bar (werden automatisch erstellt) und die Original-Kontoauszüge.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <select value={monat} onChange={(e) => setMonat(Number(e.target.value))}>
          {MONATE.map((n, idx) => <option key={n} value={idx + 1}>{n}</option>)}
        </select>
        <select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
          {[2025, 2026, 2027].map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        {laedt && <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Bericht wird erstellt…</span>}
      </div>

      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      {msg && <div style={{ color: 'var(--color-success)', marginBottom: 10 }}>{msg}</div>}

      {bericht && (
        <>
          <div style={card}>
            <table style={{ fontSize: 13 }}>
              <tbody>
                <tr><td>📄 {bericht.files[0].name}</td><td>{i.lohn.anzahl} Mitarbeiter</td><td style={r}>{fmt(i.lohn.summe)}</td></tr>
                <tr><td>📄 {bericht.files[1].name}</td><td>{i.hotel.anzahl} Buchungen</td><td style={r}>{fmt(i.hotel.summe)}</td></tr>
                <tr><td>📄 {bericht.files[2].name}</td><td>{i.bar.anzahl} Rechnungen</td><td style={r}>{fmt(i.bar.summe)}</td></tr>
                {auszuege.map((f) => (
                  <tr key={f.name}><td>🏦 {f.name}</td><td>Kontoauszug</td>
                    <td style={r}><button onClick={() => setAuszuege(auszuege.filter((x) => x !== f))} style={{ border: 'none', background: 'none', color: 'var(--color-danger)' }}>entfernen</button></td></tr>
                ))}
                <tr><td colSpan={3}>
                  <label style={{ ...btn, color: 'var(--color-primary)', background: 'white', display: 'inline-block', cursor: 'pointer' }}>
                    + Kontoauszüge hinzufügen
                    <input type="file" multiple accept=".pdf,.xls,.xlsx,.csv,image/*" style={{ display: 'none' }}
                      onChange={(e) => { setAuszuege([...auszuege, ...Array.from(e.target.files)]); e.target.value = ''; }} />
                  </label>
                </td></tr>
              </tbody>
            </table>
          </div>

          {warnungen.length > 0 && (
            <div style={{ ...card, borderLeft: '4px solid var(--color-warning)' }}>
              {warnungen.map((w) => <div key={w} style={{ fontSize: 12.5, color: 'var(--color-warning)' }}>⚠️ {w}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {kannTeilen && (
              <button onClick={teilen} style={{ ...btn, background: '#25D366', borderColor: '#25D366', fontSize: 15, padding: '12px 22px' }}>
                Per WhatsApp an Lilo senden
              </button>
            )}
            <button onClick={herunterladen} style={{ ...btn, background: 'white', color: 'var(--color-text)' }}>Berichte herunterladen</button>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
            {kannTeilen
              ? 'Der Knopf öffnet das Teilen-Menü: WhatsApp wählen, dann Lilo. Alle Dateien werden zusammen gesendet.'
              : 'Dieses Gerät/dieser Browser kann keine Dateien direkt teilen. Am Handy (Chrome/Safari) erscheint hier der WhatsApp-Knopf. Alternativ: Dateien herunterladen und in WhatsApp anhängen.'}
          </p>
        </>
      )}
    </div>
  );
}

const card = { background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', padding: 12, marginBottom: 14 };
const r = { textAlign: 'right', fontWeight: 600 };
const btn = { padding: '8px 16px', borderRadius: 8, fontSize: 13.5, border: '1px solid var(--color-border)', color: 'white', fontWeight: 600 };
