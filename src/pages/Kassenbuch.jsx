import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';

const YEAR_OPTIONS = [
  { value: '2026', label: '2026' },
  { value: 'alle', label: 'Gesamter Zeitraum (2023–2026)' },
];
const STATUSES = ['⚠️', '✅', '✔️', '📷'];

export default function Kassenbuch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('2026');
  const [search, setSearch] = useState('');
  const [konten, setKonten] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [newUrl, setNewUrl] = useState('');

  async function load(year) {
    setLoading(true);
    setError('');
    const PAGE_SIZE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      let query = supabase.from('kassenbuch').select('*').order('datum', { ascending: false });
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
  useEffect(() => {
    supabase.from('kontenplan').select('*').order('code').then(({ data }) => setKonten(data || []));
  }, []);

  function startEdit(row) {
    setEditingId(row.id);
    setDraft({ ...row, drive_urls: Array.isArray(row.drive_urls) ? [...row.drive_urls] : [] });
    setNewUrl('');
  }

  function addUrl() {
    const u = newUrl.trim();
    if (!u) return;
    setDraft({ ...draft, drive_urls: [...draft.drive_urls, u] });
    setNewUrl('');
  }

  function removeUrl(idx) {
    setDraft({ ...draft, drive_urls: draft.drive_urls.filter((_, i) => i !== idx) });
  }

  async function saveEdit() {
    const { id, beschreibung, konto, einnahme, ausgabe, status, notiz, drive_urls } = draft;
    const { error } = await supabase.from('kassenbuch').update({
      beschreibung, konto, einnahme: Number(einnahme) || 0, ausgabe: Number(ausgabe) || 0, status, notiz, drive_urls,
    }).eq('id', id);
    if (error) setError(error.message);
    else { setEditingId(null); setDraft(null); load(yearFilter); }
  }

  const bySearch = (r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [r.beschreibung, r.notiz, r.konto, r.konto_name, r.status]
      .some((f) => (f || '').toString().toLowerCase().includes(q));
  };
  const visible = rows.filter((r) => (!statusFilter || r.status === statusFilter) && bySearch(r));

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
        <input
          placeholder="Suche (Beschreibung, Notiz, Konto)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', minWidth: 260 }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)', alignSelf: 'center' }}>
          {loading ? 'Lädt…' : `${visible.length} Einträge`}
        </span>
      </div>

      {editingId && draft && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Bearbeite: {formatDatum(draft.datum)} — {draft.beschreibung}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, alignItems: 'center', maxWidth: 700 }}>
            <label>Beschreibung</label>
            <input value={draft.beschreibung || ''} onChange={(e) => setDraft({ ...draft, beschreibung: e.target.value })} />
            <label>Konto</label>
            <select value={draft.konto || ''} onChange={(e) => setDraft({ ...draft, konto: e.target.value })} style={{ width: 320 }}>
              <option value="???">??? (ungeklärt)</option>
              {konten.map((k) => <option key={k.code} value={k.code}>{k.code} — {k.name}</option>)}
            </select>
            <label>Einnahme</label>
            <input type="number" value={draft.einnahme || 0} onChange={(e) => setDraft({ ...draft, einnahme: e.target.value })} style={{ width: 140 }} />
            <label>Ausgabe</label>
            <input type="number" value={draft.ausgabe || 0} onChange={(e) => setDraft({ ...draft, ausgabe: e.target.value })} style={{ width: 140 }} />
            <label>Status</label>
            <select value={draft.status || ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })} style={{ width: 100 }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label>Notiz</label>
            <input value={draft.notiz || ''} onChange={(e) => setDraft({ ...draft, notiz: e.target.value })} />
            <label>Belege</label>
            <div>
              {draft.drive_urls.map((u, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <a href={u} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{u}</a>
                  <button onClick={() => removeUrl(i)} style={btnDanger}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  placeholder="Google-Drive-Link einfügen…"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button onClick={addUrl} style={btnGhost}>+ Hinzufügen</button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={saveEdit} style={btnPrimary}>Speichern</button>{' '}
            <button onClick={() => { setEditingId(null); setDraft(null); }} style={btnGhost}>Abbrechen</button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '78vh' }}>
        <table style={{ whiteSpace: 'nowrap', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ fontSize: 11.5 }}>
              <th style={thStyle}></th><th style={thStyle}>Datum</th><th style={thStyle}>Beschreibung</th><th style={thStyle}>Konto</th>
              <th style={thStyle}>Einnahme</th><th style={thStyle}>Ausgabe</th><th style={thStyle}>Saldo</th><th style={thStyle}>Status</th><th style={thStyle}>Notiz</th><th style={thStyle}>Beleg</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const urls = Array.isArray(r.drive_urls) ? r.drive_urls : [];
              return (
                <tr key={r.id}>
                  <td style={tdStyle}><button onClick={() => startEdit(r)} style={btnGhost}>Bearb.</button></td>
                  <td style={tdStyle}>{formatDatum(r.datum)}</td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{r.beschreibung}</td>
                  <td style={tdStyle}>{r.konto}{r.konto_name ? ` — ${r.konto_name}` : ''}</td>
                  <td style={tdStyle}>{Number(r.einnahme || 0).toLocaleString('de-DE')}</td>
                  <td style={tdStyle}>{Number(r.ausgabe || 0).toLocaleString('de-DE')}</td>
                  <td style={tdStyle}>{Number(r.saldo || 0).toLocaleString('de-DE')}</td>
                  <td style={tdStyle}>{r.status}</td>
                  <td style={{ ...tdStyle, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{r.notiz || '—'}</td>
                  <td style={tdStyle}>
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

const thStyle = { padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' };
const tdStyle = { padding: '3px 8px' };

const btnPrimary = { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600 };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 10px', fontSize: 12 };
const btnDanger = { background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 13 };
