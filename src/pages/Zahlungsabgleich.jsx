import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';

const STATUS_LABEL = { open: '⏳ Offen — noch abzugleichen', matched: '✅ Abgeglichen' };
const STATUS_COLOR = { open: 'var(--color-warning)', matched: 'var(--color-success)' };

export default function Zahlungsabgleich() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');
  const [quelleFilter, setQuelleFilter] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('kartenumsaetze').select('*').order('datum', { ascending: false });
    if (error) setError(error.message);
    else setRows(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const quelleOf = (detail) => {
    if (!detail) return '—';
    if (detail.includes('(Agoda)')) return 'Agoda';
    if (detail.includes('(Booking.com')) return 'Booking.com';
    if (detail.toLowerCase().includes('direktbuchung')) return 'Direkt';
    if (detail.includes('(RMS')) return 'RMS';
    return '—';
  };

  const enriched = useMemo(() => rows.map((r) => ({ ...r, quelle_erkannt: quelleOf(r.detail) })), [rows]);

  const visible = enriched.filter((r) =>
    (filter === 'all' || r.match_status === filter) &&
    (!quelleFilter || r.quelle_erkannt === quelleFilter)
  );
  const counts = enriched.reduce((acc, r) => { acc[r.match_status] = (acc[r.match_status] || 0) + 1; return acc; }, {});

  if (loading) return <div>Lade Zahlungsabgleich…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Zahlungsabgleich</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'open', label: `⏳ Offen — noch abzugleichen (${counts.open || 0})` },
          { key: 'matched', label: `✅ Abgeglichen (${counts.matched || 0})` },
          { key: 'all', label: `Alle (${enriched.length})` },
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
        <select value={quelleFilter} onChange={(e) => setQuelleFilter(e.target.value)} style={{ marginLeft: 'auto' }}>
          <option value="">Alle Quellen</option>
          <option value="Booking.com">Booking.com</option>
          <option value="Agoda">Agoda</option>
          <option value="Direkt">Direkt</option>
          <option value="RMS">RMS</option>
        </select>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '72vh' }}>
        <table style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
          <thead>
            <tr><th>Datum</th><th>Quelle</th><th>Detail</th><th>Betrag</th><th>Netto</th><th>Zahlungsart</th><th>Status</th><th>Info</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{formatDatum(r.datum)}</td>
                <td>{r.quelle_erkannt}</td>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>{r.detail}</td>
                <td>{Number(r.betrag || 0).toLocaleString('de-DE')}</td>
                <td>{Number(r.netto || 0).toLocaleString('de-DE')}</td>
                <td>{r.zahlungsart || '—'}</td>
                <td style={{ color: STATUS_COLOR[r.match_status], fontWeight: 600 }}>
                  {STATUS_LABEL[r.match_status] || r.match_status}
                </td>
                <td style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{r.match_info || '—'}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Keine Buchungen in dieser Ansicht.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
        Quelle: kartenumsaetze — Ergebnis des manuellen Abgleichs gegen Booking.com/Agoda-Buchungsdaten, RMS (hotel_charges) und Bank-/Kassenbuch.
        "Offen" heißt: noch nicht gegen Bank-/Kasseneingang bestätigt (z.B. Agoda hat noch nicht ausgezahlt, oder Beleg fehlt noch).
      </p>
    </div>
  );
}
