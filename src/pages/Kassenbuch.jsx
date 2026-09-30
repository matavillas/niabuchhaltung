import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';

const YEAR_OPTIONS = [
  { value: '2026', label: '2026' },
  { value: 'alle', label: 'Gesamter Zeitraum (2023–2026)' },
];
const STATUSES = ['⚠️', '✅', '✔️', '📷'];
// Januar–April 2026 ist abgeschlossen (Lilo) – dort keine neuen Einträge
const GESPERRT_VON = '2026-01-01';
const GESPERRT_BIS = '2026-04-30';

export default function Kassenbuch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('2026');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [konten, setKonten] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [newUrl, setNewUrl] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load(year) {
    setLoading(true);
    setError('');
    const PAGE_SIZE = 1000;
    let all = [];
    let from = 0;
    while (true) {
      let query = supabase.from('kassenbuch').select('*')
        .order('datum', { ascending: false })
        .order('sortierung', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
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
    setIsNew(false);
    setEditingId(row.id);
    setDraft({ ...row, drive_urls: Array.isArray(row.drive_urls) ? [...row.drive_urls] : [], _orig: { einnahme: row.einnahme, ausgabe: row.ausgabe } });
    setNewUrl('');
  }

  function startNew() {
    const heute = new Date().toISOString().slice(0, 10);
    setIsNew(true);
    setEditingId('neu');
    setDraft({ datum: heute, beschreibung: '', lieferant: '', konto: '???', einnahme: '', ausgabe: '', status: '⚠️', notiz: '', drive_urls: [] });
    setNewUrl('');
  }

  function closeForm() { setEditingId(null); setDraft(null); setIsNew(false); }

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
    setError('');
    // Ein noch nicht per "+ Hinzufügen" übernommener Link wird mitgespeichert
    const urls = newUrl.trim() ? [...draft.drive_urls, newUrl.trim()] : draft.drive_urls;
    const einnahme = Number(draft.einnahme) || 0;
    const ausgabe = Number(draft.ausgabe) || 0;
    setSaving(true);
    if (isNew) {
      if (!draft.datum || !draft.beschreibung.trim()) { setSaving(false); setError('Datum und Beschreibung sind Pflicht.'); return; }
      if (draft.datum >= GESPERRT_VON && draft.datum <= GESPERRT_BIS) { setSaving(false); setError('Januar–April 2026 ist abgeschlossen – dort sind keine neuen Einträge möglich.'); return; }
      if ((einnahme > 0) === (ausgabe > 0)) { setSaving(false); setError('Bitte entweder Einnahme oder Ausgabe eintragen (nicht beides).'); return; }
      const { error } = await supabase.rpc('kassenbuch_neu', {
        p_datum: draft.datum, p_beschreibung: draft.beschreibung.trim(), p_lieferant: draft.lieferant || '',
        p_konto: draft.konto, p_einnahme: einnahme, p_ausgabe: ausgabe, p_status: draft.status,
        p_notiz: draft.notiz || null, p_drive_urls: urls,
      });
      setSaving(false);
      if (error) { setError(error.message); return; }
    } else {
      const { id, beschreibung, konto, status, notiz, datum, _orig } = draft;
      const { error } = await supabase.from('kassenbuch').update({
        beschreibung, konto, einnahme, ausgabe, status, notiz, drive_urls: urls,
      }).eq('id', id);
      if (error) { setSaving(false); setError(error.message); return; }
      // Betrag geändert -> Saldo ab diesem Datum neu berechnen
      if (Number(_orig.einnahme || 0) !== einnahme || Number(_orig.ausgabe || 0) !== ausgabe) {
        const { error: e2 } = await supabase.rpc('kassenbuch_saldo_neu', { p_from: datum });
        if (e2) setError('Gespeichert, aber Saldo-Neuberechnung fehlgeschlagen: ' + e2.message);
      }
      setSaving(false);
    }
    closeForm();
    load(yearFilter);
  }

  const bySearch = (r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [r.beschreibung, r.notiz, r.konto, r.konto_name, r.status]
      .some((f) => (f || '').toString().toLowerCase().includes(q));
  };
  const byDate = (r) => {
    if (dateFrom && r.datum < dateFrom) return false;
    if (dateTo && r.datum > dateTo) return false;
    return true;
  };
  const byAmount = (r) => {
    if (!amountMin && !amountMax) return true;
    const betrag = Math.max(Number(r.einnahme || 0), Number(r.ausgabe || 0));
    if (amountMin && betrag < Number(amountMin)) return false;
    if (amountMax && betrag > Number(amountMax)) return false;
    return true;
  };
  const visible = rows.filter((r) => (!statusFilter || r.status === statusFilter) && bySearch(r) && byDate(r) && byAmount(r));
  function resetFilters() {
    setSearch(''); setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax(''); setStatusFilter('');
  }

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
        <button onClick={startNew} style={btnPrimary} disabled={editingId !== null}>+ Neuer Eintrag</button>
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
        {(dateFrom || dateTo || amountMin || amountMax || search || statusFilter) && (
          <button onClick={resetFilters} style={btnGhost}>Filter zurücksetzen</button>
        )}
      </div>

      {editingId && draft && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', padding: '10px 14px', marginBottom: 10, fontSize: 12.5 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {isNew ? 'Neuer Eintrag' : <>Bearbeite: {formatDatum(draft.datum)} — {draft.beschreibung}</>}
          </div>
          <div style={rowStyle}>
            {isNew
              ? <Field label="Datum" w={140}><input type="date" value={draft.datum} onChange={(e) => setDraft({ ...draft, datum: e.target.value })} style={inp} /></Field>
              : <Field label="Datum" w={90}><div style={{ padding: '5px 0' }}>{formatDatum(draft.datum)}</div></Field>}
            <Field label="Beschreibung" grow><input value={draft.beschreibung || ''} onChange={(e) => setDraft({ ...draft, beschreibung: e.target.value })} style={inp} /></Field>
            {isNew && <Field label="Lieferant" w={160}><input value={draft.lieferant || ''} onChange={(e) => setDraft({ ...draft, lieferant: e.target.value })} style={inp} /></Field>}
            <Field label="Konto" w={250}>
              <select value={draft.konto || ''} onChange={(e) => setDraft({ ...draft, konto: e.target.value })} style={inp}>
                <option value="???">??? (ungeklärt)</option>
                {konten.map((k) => <option key={k.code} value={k.code}>{k.code} — {k.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={rowStyle}>
            <Field label="Einnahme" w={120}><input type="number" min="0" value={draft.einnahme ?? ''} onChange={(e) => setDraft({ ...draft, einnahme: e.target.value })} style={inp} /></Field>
            <Field label="Ausgabe" w={120}><input type="number" min="0" value={draft.ausgabe ?? ''} onChange={(e) => setDraft({ ...draft, ausgabe: e.target.value })} style={inp} /></Field>
            <Field label="Status" w={70}>
              <select value={draft.status || ''} onChange={(e) => setDraft({ ...draft, status: e.target.value })} style={inp}>
                {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </Field>
            <Field label="Notiz" grow><input value={draft.notiz || ''} onChange={(e) => setDraft({ ...draft, notiz: e.target.value })} style={inp} /></Field>
          </div>
          <div style={{ ...rowStyle, alignItems: 'center' }}>
            <span style={lbl}>Belege</span>
            {draft.drive_urls.map((u, i) => (
              <span key={i} style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                <a href={u} target="_blank" rel="noreferrer">#{i + 1}</a>
                <button onClick={() => removeUrl(i)} style={btnDanger} title="Link entfernen">✕</button>
              </span>
            ))}
            <input placeholder="Google-Drive-Link einfügen…" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} style={{ ...inp, flex: 1, minWidth: 220 }} />
            <button onClick={addUrl} style={btnGhost}>+ Link</button>
            <a href="https://drive.google.com/drive/folders/1BoId298-Fp9BYmYHdJF1Z0rG7qBHDfFU" target="_blank" rel="noreferrer">
              <button type="button" style={btnGhost}>📁 Beleg-Ordner</button>
            </a>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={saveEdit} style={btnPrimary} disabled={saving}>{saving ? 'Speichert…' : (isNew ? 'Anlegen' : 'Speichern')}</button>
              <button onClick={closeForm} style={btnGhost}>Abbrechen</button>
            </span>
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
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{r.beschreibung}</td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}>{r.konto}</td>
                  <td style={tdStyle}>{Number(r.einnahme || 0).toLocaleString('de-DE')}</td>
                  <td style={tdStyle}>{Number(r.ausgabe || 0).toLocaleString('de-DE')}</td>
                  <td style={tdStyle}>{Number(r.saldo || 0).toLocaleString('de-DE')}</td>
                  <td style={tdStyle}>{r.status}</td>
                  <td style={{ ...tdStyle, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{r.notiz || '—'}</td>
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

function Field({ label, w, grow, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, width: grow ? undefined : w, flex: grow ? 1 : undefined, minWidth: grow ? 160 : undefined }}>
      <span style={lbl}>{label}</span>
      {children}
    </label>
  );
}

const rowStyle = { display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' };
const lbl = { fontSize: 11, color: 'var(--color-muted)' };
const inp = { padding: '4px 7px', fontSize: 12.5, width: '100%', boxSizing: 'border-box' };

const thStyle = { padding: '5px 8px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' };
const tdStyle = { padding: '3px 8px' };

const btnPrimary = { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600 };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 10px', fontSize: 12 };
const btnDanger = { background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 13 };
