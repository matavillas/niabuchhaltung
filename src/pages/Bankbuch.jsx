import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ACCOUNTS = ['666', '415', '386', 'CIMB', '303'];

export default function Bankbuch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('bankbuch').select('*').order('datum', { ascending: false }).limit(500);
    if (error) setError(error.message);
    else setRows(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const visible = accountFilter ? rows.filter((r) => r.konto_nr === accountFilter) : rows;

  if (loading) return <div>Lade Bankbuch…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Bankbuch</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="">Alle Konten</option>
          {ACCOUNTS.map((a) => <option key={a} value={a}>...{a}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)', alignSelf: 'center' }}>{visible.length} Einträge</span>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '70vh' }}>
        <table>
          <thead>
            <tr><th>Datum</th><th>Konto</th><th>Buchungstext</th><th>Konto-Nr (Kontenplan)</th><th>Debit</th><th>Credit</th><th>Status</th><th>Beleg</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const urls = Array.isArray(r.drive_urls) ? r.drive_urls : [];
              return (
                <tr key={r.id}>
                  <td>{r.datum}</td>
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
