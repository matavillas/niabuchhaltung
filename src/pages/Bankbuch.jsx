import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';

const ACCOUNTS = ['666', '415', '386', 'CIMB', '303'];
const YEAR_OPTIONS = [
  { value: '2026', label: '2026' },
  { value: 'alle', label: 'Gesamter Zeitraum (2023–2026)' },
];

export default function Bankbuch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('2026');

  async function load(year) {
    setLoading(true);
    setError('');
    let query = supabase.from('bankbuch').select('*').order('datum', { ascending: false });
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

  const visible = accountFilter ? rows.filter((r) => r.konto_nr === accountFilter) : rows;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Bankbuch</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          {YEAR_OPTIONS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
        </select>
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="">Alle Konten</option>
          {ACCOUNTS.map((a) => <option key={a} value={a}>...{a}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)', alignSelf: 'center' }}>
          {loading ? 'Lädt…' : `${visible.length} Einträge`}
        </span>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '75vh' }}>
        <table>
          <thead>
            <tr><th>Datum</th><th>Konto</th><th>Buchungstext</th><th>Konto-Nr (Kontenplan)</th><th>Debit</th><th>Credit</th><th>Status</th><th>Beleg</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const urls = Array.isArray(r.drive_urls) ? r.drive_urls : [];
              return (
                <tr key={r.id}>
                  <td>{formatDatum(r.datum)}</td>
                  <td>...{r.konto_nr}</td>
                  <td>{r.buchungstext}</td>
                  <td>{r.konto_neu || '???'}</td>
                  <td>{Number(r.debit || 0).toLocaleString('de-DE')}</td>
                  <td>{Number(r.credit || 0).toLocaleString('de-DE')}</td>
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
