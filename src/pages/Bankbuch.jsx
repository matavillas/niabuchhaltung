import { useEffect, useState } from 'react';
import { useAnsicht, useScrollMerken } from '../lib/ansicht';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';

const ACCOUNTS = ['666', '415', '386', '783', 'CIMB', '303', 'WISE-RK'];
const YEAR_OPTIONS = [
  { value: '2026', label: '2026' },
  { value: 'alle', label: 'Gesamter Zeitraum (2023–2026)' },
];
const STATUSES = ['⚠️', '✅', '✔️', '📷'];
const STATUS_FILTERS = [
  { value: '', label: 'Alle Status' },
  { value: 'offen', label: '⚠️ offen' },
  { value: 'geklaert', label: '✅ geklärt' },
  { value: '📷', label: '📷 Beleg fehlt' },
];
const GROUP_COLORS = ['#e8a33d', '#4f8fd6'];

// Split-Buchungen: eine Bankbewegung, auf mehrere Zeilen aufgeteilt.
// Gleiche Kontonummer + Datum + Saldo + Bankauszug-Text = derselbe Umsatz.
// Ohne Bankauszug-Text oder Saldo lässt sich nichts sicher zuordnen -> keine Gruppe.
function groupKey(r) {
  const remarks = (r.remarks || '').trim();
  if (!remarks || r.saldo === null || r.saldo === undefined || r.saldo === '') return `id|${r.id}`;
  return [r.konto_nr, r.datum, r.saldo, remarks].join('|');
}

function AutoTextarea({ value, onChange, minRows = 1 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      rows={minRows}
      ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; } }}
      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }}
      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '5px 8px', boxSizing: 'border-box' }}
    />
  );
}

export default function Bankbuch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountFilter, setAccountFilter] = useAnsicht('bankbuch', 'accountFilter', '');
  const [statusFilter, setStatusFilter] = useAnsicht('bankbuch', 'statusFilter', '');
  const [yearFilter, setYearFilter] = useAnsicht('bankbuch', 'yearFilter', '2026');
  const [search, setSearch] = useAnsicht('bankbuch', 'search', '');
  const [dateFrom, setDateFrom] = useAnsicht('bankbuch', 'dateFrom', '');
  const [dateTo, setDateTo] = useAnsicht('bankbuch', 'dateTo', '');
  const [amountMin, setAmountMin] = useAnsicht('bankbuch', 'amountMin', '');
  const [amountMax, setAmountMax] = useAnsicht('bankbuch', 'amountMax', '');
  const [konten, setKonten] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [newUrl, setNewUrl] = useState('');
  const scrollRef = useScrollMerken('bankbuch', !loading);

  async function load(year) {
    setLoading(true);
    setError('');
    const PAGE_SIZE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      let query = supabase.from('bankbuch').select('*')
        .order('datum', { ascending: false })
        .order('konto_nr', { ascending: true })
        .order('id', { ascending: true });
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
    const { id, buchungstext, konto_neu, status, notiz, drive_urls } = draft;
    const { error } = await supabase.from('bankbuch').update({ buchungstext, konto_neu, status, notiz, drive_urls }).eq('id', id);
    if (error) setError(error.message);
    else { setEditingId(null); setDraft(null); load(yearFilter); }
  }

  const bySearch = (r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [r.buchungstext, r.remarks, r.notiz, r.konto_neu, r.konto_nr, r.status]
      .some((f) => (f || '').toString().toLowerCase().includes(q));
  };
  const byDate = (r) => {
    if (dateFrom && r.datum < dateFrom) return false;
    if (dateTo && r.datum > dateTo) return false;
    return true;
  };
  const byAmount = (r) => {
    if (!amountMin && !amountMax) return true;
    const betrag = Math.max(Number(r.debit || 0), Number(r.credit || 0));
    if (amountMin && betrag < Number(amountMin)) return false;
    if (amountMax && betrag > Number(amountMax)) return false;
    return true;
  };
  const byStatus = (r) => {
    if (!statusFilter) return true;
    if (statusFilter === 'offen') return r.status === '⚠️' || !r.status;
    if (statusFilter === 'geklaert') return r.status === '✅' || r.status === '✔️';
    return r.status === statusFilter;
  };

  // Gruppen über ALLE geladenen Zeilen bilden, damit eine Split-Buchung auch dann
  // als Gruppe erkennbar bleibt, wenn der Filter nur einen Teil davon zeigt.
  const groups = new Map();
  for (const r of rows) {
    const k = groupKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const filtered = rows.filter((r) => (!accountFilter || r.konto_nr === accountFilter) && byStatus(r) && bySearch(r) && byDate(r) && byAmount(r));
  // Zeilen einer Split-Buchung direkt untereinander anzeigen
  const seen = new Set();
  const visible = [];
  const filteredIds = new Set(filtered.map((r) => r.id));
  for (const r of filtered) {
    const k = groupKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    for (const m of groups.get(k)) if (filteredIds.has(m.id)) visible.push(m);
  }
  const splitKeys = [...groups.entries()].filter(([, v]) => v.length > 1).map(([k]) => k);
  const splitColor = new Map(splitKeys.map((k, i) => [k, GROUP_COLORS[i % GROUP_COLORS.length]]));

  function resetFilters() {
    setSearch(''); setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax(''); setAccountFilter(''); setStatusFilter('');
  }

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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input
          placeholder="Suche (Buchungstext, Notiz, Konto, Status)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', minWidth: 260 }}
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
        <label style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 10 }}>Betrag von</label>
        <input type="number" placeholder="min" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} style={{ padding: '5px 8px', width: 110 }} />
        <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>bis</label>
        <input type="number" placeholder="max" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} style={{ padding: '5px 8px', width: 110 }} />
        {(dateFrom || dateTo || amountMin || amountMax || search || accountFilter || statusFilter) && (
          <button onClick={resetFilters} style={btnGhost}>Filter zurücksetzen</button>
        )}
      </div>

      {editingId && draft && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Bearbeite: {formatDatum(draft.datum)} — {draft.buchungstext}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, alignItems: 'center', maxWidth: 900 }}>
            <label>Bankauszug-Text</label>
            <div style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-bg, #f6f6f6)', padding: '5px 8px', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {draft.remarks || '—'} <span style={{ fontFamily: 'inherit', fontSize: 11, color: 'var(--color-muted)' }}>(Original, nicht änderbar)</span>
            </div>
            {(groups.get(groupKey(draft)) || []).length > 1 && (<>
              <label>Split-Buchung</label>
              <div style={{ fontSize: 12.5 }}>
                Teil einer aufgeteilten Bankbewegung ({groups.get(groupKey(draft)).length} Zeilen, Summe{' '}
                {groups.get(groupKey(draft)).reduce((a, m) => a + Number(m.debit || 0) + Number(m.credit || 0), 0).toLocaleString('de-DE')})
              </div>
            </>)}
            <label>Buchungstext</label>
            <AutoTextarea value={draft.buchungstext || ''} onChange={(e) => setDraft({ ...draft, buchungstext: e.target.value })} />
            <label>Ausgang</label>
            <div style={{ color: 'var(--color-muted)' }}>{Number(draft.debit || 0).toLocaleString('de-DE')} <span style={{ fontSize: 11 }}>(nicht änderbar)</span></div>
            <label>Eingang</label>
            <div style={{ color: 'var(--color-muted)' }}>{Number(draft.credit || 0).toLocaleString('de-DE')} <span style={{ fontSize: 11 }}>(nicht änderbar)</span></div>
            <label>Saldo</label>
            <div style={{ color: 'var(--color-muted)' }}>{Number(draft.saldo || 0).toLocaleString('de-DE')} <span style={{ fontSize: 11 }}>(nicht änderbar)</span></div>
            <label>Konto (Kontenplan)</label>
            <select value={draft.konto_neu || ''} onChange={(e) => setDraft({ ...draft, konto_neu: e.target.value })} style={{ width: 320 }}>
              <option value="???">??? (ungeklärt)</option>
              {konten.map((k) => <option key={k.code} value={k.code}>{k.code} — {k.name}</option>)}
            </select>
            <label>Status</label>
            <select value={draft.status || ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })} style={{ width: 100 }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label>Notiz</label>
            <AutoTextarea minRows={2} value={draft.notiz || ''} onChange={(e) => setDraft({ ...draft, notiz: e.target.value })} />
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
                <a href="https://drive.google.com/drive/folders/1BoId298-Fp9BYmYHdJF1Z0rG7qBHDfFU" target="_blank" rel="noreferrer">
                  <button type="button" style={btnGhost}>📁 Beleg-Ordner öffnen</button>
                </a>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={saveEdit} style={btnPrimary}>Speichern</button>{' '}
            <button onClick={() => { setEditingId(null); setDraft(null); }} style={btnGhost}>Abbrechen</button>
          </div>
        </div>
      )}

      <div ref={scrollRef} style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '78vh' }}>
        <table style={{ whiteSpace: 'nowrap', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ fontSize: 11.5 }}>
              <th style={thStyle}></th><th style={thStyle}>Datum</th><th style={thStyle}>Konto</th><th style={thStyle}>Buchungstext</th><th style={thStyle}>Bankauszug-Text</th>
              <th style={thStyle}>Konto-Nr</th><th style={thStyle}>Ausgang</th><th style={thStyle}>Eingang</th><th style={thStyle}>Status</th><th style={thStyle}>Notiz</th><th style={thStyle}>Beleg</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const urls = Array.isArray(r.drive_urls) ? r.drive_urls : [];
              const k = groupKey(r);
              const grp = groups.get(k);
              const color = splitColor.get(k);
              const pos = grp.length > 1 ? grp.findIndex((m) => m.id === r.id) + 1 : 0;
              const rowStyle = color ? { borderLeft: `4px solid ${color}`, background: pos > 1 ? 'rgba(0,0,0,0.02)' : undefined } : { borderLeft: '4px solid transparent' };
              return (
                <tr key={r.id} style={rowStyle}
                    title={pos ? `Split-Buchung ${pos}/${grp.length} — Summe ${grp.reduce((a, m) => a + Number(m.debit || 0) + Number(m.credit || 0), 0).toLocaleString('de-DE')}` : undefined}>
                  <td style={tdStyle}>
                    <button onClick={() => startEdit(r)} style={btnGhost}>Bearb.</button>
                    {pos > 0 && <span style={{ marginLeft: 6, fontSize: 10.5, color }}>{pos}/{grp.length}</span>}
                  </td>
                  <td style={tdStyle}>{formatDatum(r.datum)}</td>
                  <td style={tdStyle}>...{r.konto_nr}</td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{r.buchungstext}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{r.remarks || '—'}</td>
                  <td style={tdStyle}>{r.konto_neu || '???'}</td>
                  <td style={tdStyle}>{Number(r.debit || 0).toLocaleString('de-DE')}</td>
                  <td style={tdStyle}>{Number(r.credit || 0).toLocaleString('de-DE')}</td>
                  <td style={tdStyle}>{r.status}</td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{r.notiz || '—'}</td>
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
const tdStyle = { padding: '2px 8px', lineHeight: 1.35 };

const btnPrimary = { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600 };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 10px', fontSize: 12 };
const btnDanger = { background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 13 };
