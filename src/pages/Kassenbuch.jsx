import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Kassenbuch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('kassenbuch').select('*').order('datum', { ascending: false }).limit(400);
    if (error) setError(error.message);
    else setRows(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const visible = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  if (loading) return <div>Lade Kassenbuch…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Kassenbuch</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Alle Status</option>
          <option value="✅">✅ verknüpft</option>
          <option value="⚠️">⚠️ zu prüfen</option>
          <option value="✔️">✔️ beleglos ok</option>
          <option value="📷">📷 unleserlich</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)', alignSelf: 'center' }}>{visible.length} Einträge</span>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '70vh' }}>
        <table>
          <thead>
            <tr><th>Datum</th><th>Beschreibung</th><th>Konto</th><th>Einnahme</th><th>Ausgabe</th><th>Saldo</th><th>Status</th><th>Beleg</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const urls = Array.isArray(r.drive_urls) ? r.drive_urls : [];
              return (
                <tr key={r.id}>
                  <td>{r.datum}</td>
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
