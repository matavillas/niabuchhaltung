import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';
import { useAuth } from '../context/AuthContext';

// Offene Zahlungen = Rechnungen/Notas aus dem Drive-Ordner "Bills 2026 / Payment".
// Ablauf: offen → (Button "Bezahlt") bestaetigt → (Claude: Beleg in Ordner "Bank" verschoben,
// Überweisungsdatum aus dem Kontoauszug eingetragen) erledigt.
const STATUS = {
  offen: { label: '⏳ Offen', color: 'var(--color-warning)' },
  bestaetigt: { label: '✔ Bezahlt bestätigt — wartet auf Kontoauszug', color: 'var(--color-primary)' },
  erledigt: { label: '✅ Erledigt', color: 'var(--color-success)' },
  abgebrochen: { label: '✖ Abgebrochen (Datei aus Payment entfernt)', color: 'var(--color-muted)' },
};

const fmt = (n) => Number(n || 0).toLocaleString('de-DE');

export default function OffeneZahlungen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('offen');
  const [busy, setBusy] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('offene_zahlungen')
      .select('*')
      .order('eingang', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else { setRows(data || []); setError(''); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function bestaetigen(r) {
    setBusy(r.id);
    const { error } = await supabase
      .from('offene_zahlungen')
      .update({
        status: 'bestaetigt',
        bestaetigt_am: new Date().toISOString(),
        bestaetigt_von: profile?.full_name || profile?.email || null,
      })
      .eq('id', r.id);
    if (error) setError(error.message);
    setBusy(null);
    load();
  }

  async function zuruecknehmen(r) {
    setBusy(r.id);
    const { error } = await supabase
      .from('offene_zahlungen')
      .update({ status: 'offen', bestaetigt_am: null, bestaetigt_von: null })
      .eq('id', r.id)
      .eq('status', 'bestaetigt');
    if (error) setError(error.message);
    setBusy(null);
    load();
  }

  const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const summe = (st) => rows.filter((r) => r.status === st).reduce((s, r) => s + Number(r.betrag || 0), 0);
  const visible = rows.filter((r) => filter === 'all' || r.status === filter);

  if (loading) return <div>Lade offene Zahlungen…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Offene Zahlungen</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', fontSize: 13 }}>
        <div style={styles.kpi}><div style={styles.kpiLabel}>Noch zu zahlen</div><div style={styles.kpiValue}>Rp {fmt(summe('offen'))}</div></div>
        <div style={styles.kpi}><div style={styles.kpiLabel}>Bezahlt, Kontoauszug fehlt noch</div><div style={styles.kpiValue}>Rp {fmt(summe('bestaetigt'))}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'offen', label: `⏳ Offen (${counts.offen || 0})` },
          { key: 'bestaetigt', label: `✔ Bezahlt bestätigt (${counts.bestaetigt || 0})` },
          { key: 'erledigt', label: `✅ Erledigt (${counts.erledigt || 0})` },
          { key: 'abgebrochen', label: `✖ Abgebrochen (${counts.abgebrochen || 0})` },
          { key: 'all', label: `Alle (${rows.length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12.5, border: '1px solid var(--color-border)',
              background: filter === f.key ? 'var(--color-primary)' : 'white',
              color: filter === f.key ? 'white' : 'var(--color-text)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '72vh' }}>
        <table style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th>Eingang</th><th>Belegdatum</th><th>Empfänger</th><th>Beschreibung</th>
              <th style={{ textAlign: 'right' }}>Betrag</th><th>Konto</th><th>Beleg</th><th>Hinweis</th>
              <th>Status</th><th>Überweisung</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDatum(r.eingang)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.beleg_datum || '—'}</td>
                <td>{r.empfaenger}</td>
                <td style={{ maxWidth: 280 }}>{r.beschreibung}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmt(r.betrag)}</td>
                <td>{r.konto_vorschlag || '—'}</td>
                <td>{r.drive_url ? <a href={r.drive_url} target="_blank" rel="noreferrer">📄 ansehen</a> : '—'}</td>
                <td style={{ fontSize: 11, color: 'var(--color-muted)', maxWidth: 240 }}>{r.hinweis || ''}</td>
                <td style={{ color: STATUS[r.status]?.color, fontWeight: 600, fontSize: 11.5 }}>
                  {STATUS[r.status]?.label || r.status}
                  {r.bestaetigt_am && (
                    <div style={{ fontWeight: 400, color: 'var(--color-muted)' }}>
                      {formatDatum(r.bestaetigt_am)}{r.bestaetigt_von ? ` · ${r.bestaetigt_von}` : ''}
                    </div>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.ueberweisung_datum ? formatDatum(r.ueberweisung_datum) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {r.status === 'offen' && (
                    <button disabled={busy === r.id} onClick={() => bestaetigen(r)} style={styles.btnPay}>✔ Bezahlt</button>
                  )}
                  {r.status === 'bestaetigt' && (
                    <button disabled={busy === r.id} onClick={() => zuruecknehmen(r)} style={styles.btnUndo}>↺ Zurück</button>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Keine Einträge in dieser Ansicht.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
        Quelle: Drive-Ordner „Bills 2026 / Payment“. Nach „✔ Bezahlt“ wird der Beleg in den Ordner „Bank“ verschoben;
        sobald die Überweisung im Kontoauszug steht, wird das Überweisungsdatum eingetragen und die Zeile auf „Erledigt“ gesetzt.
        Wird eine offene Datei aus „Payment“ herausgenommen, gilt der Vorgang als abgebrochen.
      </p>
    </div>
  );
}

const styles = {
  kpi: { background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', padding: '10px 14px', minWidth: 200 },
  kpiLabel: { fontSize: 11.5, color: 'var(--color-muted)' },
  kpiValue: { fontSize: 18, fontWeight: 700, color: 'var(--color-text)' },
  btnPay: { padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--color-success)', color: 'white', fontSize: 12, cursor: 'pointer' },
  btnUndo: { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'white', fontSize: 12, cursor: 'pointer' },
};
