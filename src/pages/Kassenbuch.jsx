import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';

const YEAR_OPTIONS = [
  { value: '2026', label: '2026' },
  { value: 'alle', label: 'Gesamter Zeitraum (2023–2026)' },
];

export default function Kassenbuch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('2026');

  async function load(year) {
    setLoading(true);
    setError('');
    let query = supabase.from('kassenbuch').select('*').order('datum', { ascending: false });
    if (year !== 'alle') {
      query = query.gte('datum', `${year}-01-01`).lte('datum', `${year}-12-31`);
    }
    // Kein .limit() — Endlostabelle, alle Zeilen des gewählten Zeitraums werden geladen.
    const { data, error } = await query;
    if (error) setError(error.message);
    else setRows(data);
    setLoading(false);
  }

  useEffect(() => { load(yearFilter); }, [yearFilter]);

  const visible = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Kassenbuch</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          {YEAR_OPTIONS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Alle Status</option>
          <option value="✅">✅ verknüpft</option>
          <option value="⚠️">⚠️ zu prüfen</option>
          <option value="✔️">✔️ beleglos ok</option>
          <option value="📷">📷 unleserlich</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)', alignSelf: 'center' }}>
          {loading ? 'Lädt…' : `${visible.length} Einträge`}
        </span>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '75vh' }}>
        <table>
          <thead>
            <tr><th>Datum</th><th>Beschreibung</th><th>Konto</th><th>Einnahme</th><th>Ausgabe</th><th>Saldo</th><th>Status</th><th>Beleg</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const urls = Array.isArray(r.drive_urls) ? r.drive_urls : [];
              return (
                <tr key={r.id}>
                  <td>{formatDatum(r.datum)}</td>
                  <td>{r.beschreibung}</td>
                  <td>{r.konto}{r.konto_name ? ` — ${r.konto_name}` : ''}</td>
                  <td>{Number(r.einnahme || 0).toLocaleString('de-DE')}</td>
                  <td>{Number(r.ausgabe || 0).toLocaleString('de-DE')}</td>
                  <td>{Number(r.saldo || 0).toLocaleString('de-DE')}</td>
                  <td>{r.status}</td>
                  <td>
                    {urls.length > 0
                      ? urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>#{i + 1}</a>)
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
