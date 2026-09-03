import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';

const TABLE_LABELS = {
  bankbuch: 'Bankbuch',
  kassenbuch: 'Kassenbuch',
  kartenumsaetze: 'Kartenumsätze',
  kontenplan: 'Kontenplan',
  bookingcom_buchungen: 'Booking.com',
  agoda_buchungen: 'Agoda',
  petit_cash_adit: 'Petit Cash Adit',
};
const ACTION_COLORS = { INSERT: '#1E7B45', UPDATE: '#2E86AB', DELETE: '#C0392B' };

function defaultDateFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function AccountingLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    let query = supabase.from('accounting_audit_log').select('*').order('changed_at', { ascending: false }).limit(2000);
    if (dateFrom) query = query.gte('changed_at', `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte('changed_at', `${dateTo}T23:59:59`);
    const { data, error } = await query;
    if (error) setError(error.message);
    else setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const bySearch = (r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [r.actor_email, r.actor_role, r.table_name, r.action, r.record_id, JSON.stringify(r.new_data || {}), JSON.stringify(r.old_data || {})]
      .some((f) => (f || '').toString().toLowerCase().includes(q));
  };

  const visible = rows.filter(
    (r) => (!tableFilter || r.table_name === tableFilter) && (!actionFilter || r.action === actionFilter) && bySearch(r)
  );

  function resetFilters() {
    setTableFilter(''); setActionFilter(''); setSearch(''); setDateFrom(defaultDateFrom()); setDateTo('');
  }

  function changedFields(oldData, newData) {
    if (!oldData || !newData) return [];
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    const diffs = [];
    keys.forEach((k) => {
      const ov = oldData[k];
      const nv = newData[k];
      if (JSON.stringify(ov) !== JSON.stringify(nv)) diffs.push({ key: k, ov, nv });
    });
    return diffs;
  }

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Buchhaltungs-Log</h2>
      <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 10 }}>
        Änderungsverlauf aller Buchhaltungstabellen (Bankbuch, Kassenbuch, Kartenumsätze etc.) — wer hat wann was geändert.
      </div>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
          <option value="">Alle Tabellen</option>
          {Object.entries(TABLE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">Alle Aktionen</option>
          <option value="INSERT">Neu angelegt</option>
          <option value="UPDATE">Geändert</option>
          <option value="DELETE">Gelöscht</option>
        </select>
        <input
          placeholder="Suche (Person, Feld, Wert)…"
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
        <button onClick={resetFilters} style={btnGhost}>Filter zurücksetzen</button>
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Standard: letzte 7 Tage, max. 2000 Einträge geladen.</span>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '75vh' }}>
        <table style={{ whiteSpace: 'nowrap', fontSize: 12.5, borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ fontSize: 11.5 }}>
              <th style={thStyle}>Zeit</th>
              <th style={thStyle}>Tabelle</th>
              <th style={thStyle}>Aktion</th>
              <th style={thStyle}>Wer</th>
              <th style={thStyle}>Geänderte Felder</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const diffs = r.action === 'UPDATE' ? changedFields(r.old_data, r.new_data) : [];
              const isOpen = expandedId === r.id;
              return (
                <>
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.changed_at ? new Date(r.changed_at).toLocaleString('de-DE') : '—'}</td>
                    <td style={tdStyle}>{TABLE_LABELS[r.table_name] || r.table_name}</td>
                    <td style={tdStyle}>
                      <span style={{ color: ACTION_COLORS[r.action] || 'inherit', fontWeight: 600 }}>
                        {r.action === 'INSERT' ? 'Neu' : r.action === 'DELETE' ? 'Gelöscht' : 'Geändert'}
                      </span>
                    </td>
                    <td style={tdStyle}>{r.actor_email || 'System / Import'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'normal', color: 'var(--color-muted)' }}>
                      {r.action === 'UPDATE'
                        ? diffs.map((d) => d.key).join(', ') || '—'
                        : r.action === 'INSERT' ? 'Datensatz angelegt' : 'Datensatz entfernt'}
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => setExpandedId(isOpen ? null : r.id)} style={btnGhost}>
                        {isOpen ? 'Zu' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ padding: '8px 12px', background: 'var(--color-bg, #f8f8f8)' }}>
                        {r.action === 'UPDATE' && diffs.length > 0 ? (
                          <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr><th style={thStyleSmall}>Feld</th><th style={thStyleSmall}>Vorher</th><th style={thStyleSmall}>Nachher</th></tr>
                            </thead>
                            <tbody>
                              {diffs.map((d) => (
                                <tr key={d.key}>
                                  <td style={tdStyleSmall}>{d.key}</td>
                                  <td style={{ ...tdStyleSmall, color: 'var(--color-danger)' }}>{JSON.stringify(d.ov)}</td>
                                  <td style={{ ...tdStyleSmall, color: 'var(--color-primary)' }}>{JSON.stringify(d.nv)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', margin: 0 }}>
                            {JSON.stringify(r.action === 'DELETE' ? r.old_data : r.new_data, null, 2)}
                          </pre>
                        )}
                        <div style={{ fontSize: 10.5, color: 'var(--color-muted)', marginTop: 6 }}>
                          Datensatz-ID: {r.record_id} · Rolle: {r.actor_role || '—'}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
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
const thStyleSmall = { padding: '3px 8px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', fontWeight: 600 };
const tdStyle = { padding: '4px 8px' };
const tdStyleSmall = { padding: '3px 8px', verticalAlign: 'top' };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' };
