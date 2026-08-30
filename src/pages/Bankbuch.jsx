import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';

const ACCOUNTS = ['666', '415', '386', '783', 'CIMB', '303'];
const YEAR_OPTIONS = [
  { value: '2026', label: '2026' },
  { value: 'alle', label: 'Gesamter Zeitraum (2023–2026)' },
];
const STATUSES = ['⚠️', '✅', '✔️', '📷'];

export default function Bankbuch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('2026');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  async function load(year) {
    setLoading(true);
    setError('');
    const PAGE_SIZE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      let query = supabase.from('bankbuch').select('*').order('datum', { ascending: false });
      if (year !== 'alle') {
        query = query.gte('datum', `${year}-01-01`).lte('datum', `${year}-12-31`);
      }
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) { setError(error.message); break; }
      all = all.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    setRows(all);
    setLoading(false);
  }

  useEffect(() => { load(yearFilter); }, [yearFilter]);

  function startEdit(row) {
    setEditingId(row.id);
    setDraft({ ...row });
  }

  async function saveEdit() {
    const { id, buchungstext, konto_neu, status, notiz } = draft;
    const { error } = await supabase.from('bankbuch').update({ buchungstext, konto_neu, status, notiz }).eq('id', id);
    if (error) setError(error.message);
    else { setEditingId(null); setDraft(null); load(yearFilter); }
  }

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
            <tr>
              <th>Datum</th><th>Konto</th><th>Buchungstext</th><th>Text aus Bankauszug</th>
              <th>Konto-Nr (Kontenplan)</th><th>Ausgang</th><th>Eingang</th><th>Status</th><th>Notiz</th><th>Beleg</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const urls = Array.isArray(r.drive_urls) ? r.drive_urls : [];
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id}>
                  <td>{formatDatum(r.datum)}</td>
                  <td>...{r.konto_nr}</td>
                  <td>
                    {isEditing
                      ? <input value={draft.buchungstext || ''} onChange={(e) => setDraft({ ...draft, buchungstext: e.target.value })} style={{ width: 220 }} />
                      : r.buchungstext}
                  </td>
                  <td style={{ maxWidth: 240, fontSize: 11.5, color: 'var(--color-muted)' }}>{r.remarks || '—'}</td>
                  <td>
                    {isEditing
                      ? <input value={draft.konto_neu || ''} onChange={(e) => setDraft({ ...draft, konto_neu: e.target.value })} style={{ width: 70 }} />
                      : (r.konto_neu || '???')}
                  </td>
                  <td>{Number(r.debit || 0).toLocaleString('de-DE')}</td>
                  <td>{Number(r.credit || 0).toLocaleString('de-DE')}</td>
                  <td>
                    {isEditing
                      ? (
                        <select value={draft.status || ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )
                      : r.status}
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    {isEditing
                      ? <input value={draft.notiz || ''} onChange={(e) => setDraft({ ...draft, notiz: e.target.value })} style={{ width: '100%' }} />
                      : <span style={{ fontSize: 11.5 }}>{r.notiz || '—'}</span>}
                  </td>
                  <td>
                    {urls.length > 0
                      ? urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>#{i + 1}</a>)
                      : '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {isEditing ? (
                      <>
                        <button onClick={saveEdit} style={btnPrimary}>Speichern</button>{' '}
                        <button onClick={() => { setEditingId(null); setDraft(null); }} style={btnGhost}>Abbrechen</button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(r)} style={btnGhost}>Bearbeiten</button>
                    )}
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

const btnPrimary = { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600 };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', fontSize: 12.5 };
