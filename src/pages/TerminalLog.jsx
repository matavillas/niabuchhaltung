import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function TerminalLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [terminalFilter, setTerminalFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const PAGE_SIZE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) { setError(error.message); break; }
      all = all.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    setRows(all);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const terminals = [...new Set(rows.map((r) => r.terminal).filter(Boolean))].sort();
  const roles = [...new Set(rows.map((r) => r.staff_role).filter(Boolean))].sort();

  const bySearch = (r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [r.staff_name, r.action, r.details, r.terminal, r.staff_role]
      .some((f) => (f || '').toString().toLowerCase().includes(q));
  };
  const byDate = (r) => {
    if (!r.created_at) return true;
    const d = r.created_at.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const visible = rows.filter(
    (r) =>
      (!terminalFilter || r.terminal === terminalFilter) &&
      (!roleFilter || r.staff_role === roleFilter) &&
      bySearch(r) &&
      byDate(r)
  );

  function resetFilters() {
    setTerminalFilter(''); setRoleFilter(''); setSearch(''); setDateFrom(''); setDateTo('');
  }

  const TERMINAL_COLORS = {
    Kasse: '#1E7B45', POS: '#2E86AB', Manager: '#1F4E79', KDS: '#B7791F',
  };

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Terminal-Log (RMS-Aktivität)</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={terminalFilter} onChange={(e) => setTerminalFilter(e.target.value)}>
          <option value="">Alle Terminals</option>
          {terminals.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Alle Rollen</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input
          placeholder="Suche (Mitarbeiter, Aktion, Details)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', minWidth: 240 }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)', alignSelf: 'center' }}>
          {loading ? 'Lädt…' : `${visible.length} Einträge`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>Datum von</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '5px 8px' }} />
        <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>bis</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '5px 8px' }} />
        {(terminalFilter || roleFilter || search || dateFrom || dateTo) && (
          <button onClick={resetFilters} style={btnGhost}>Filter zurücksetzen</button>
        )}
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '78vh' }}>
        <table style={{ whiteSpace: 'nowrap', fontSize: 12.5, borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ fontSize: 11.5 }}>
              <th style={thStyle}>Zeit</th>
              <th style={thStyle}>Terminal</th>
              <th style={thStyle}>Mitarbeiter</th>
              <th style={thStyle}>Rolle</th>
              <th style={thStyle}>Aktion</th>
              <th style={thStyle}>Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.created_at ? new Date(r.created_at).toLocaleString('de-DE') : '—'}</td>
                <td style={tdStyle}>
                  <span style={{
                    color: TERMINAL_COLORS[r.terminal] || 'inherit',
                    fontWeight: 600,
                    border: `1px solid ${TERMINAL_COLORS[r.terminal] || 'var(--color-border)'}`,
                    borderRadius: 5, padding: '1px 7px', fontSize: 11.5,
                  }}>
                    {r.terminal || '—'}
                  </span>
                </td>
                <td style={tdStyle}>{r.staff_name || '—'}</td>
                <td style={tdStyle}>{r.staff_role || '—'}</td>
                <td style={tdStyle}>{r.action || '—'}</td>
                <td style={{ ...tdStyle, whiteSpace: 'normal', color: 'var(--color-muted)' }}>{r.details || '—'}</td>
              </tr>
            ))}
            {visible.length === 0 && !loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 20 }}>Keine Einträge gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = { padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' };
const tdStyle = { padding: '4px 8px' };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 10px', fontSize: 12 };
