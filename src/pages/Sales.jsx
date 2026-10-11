import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDatum } from '../lib/format';
import UmsatzDiagramme from '../components/UmsatzDiagramme';

const CATEGORIES = ['hotel', 'restaurant', 'minibar'];
const CATEGORY_LABELS = { hotel: 'Hotel', restaurant: 'Restaurant', minibar: 'Minibar' };
const PAYMENT_METHODS = ['cash', 'card', 'qris', 'bank_transfer', 'ota'];

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [historie, setHistorie] = useState([]);
  const [hotelCharges, setHotelCharges] = useState([]);
  const [rohdatenOffen, setRohdatenOffen] = useState(false);
  const [abgleichFilter, setAbgleichFilter] = useState('all');
  const [kanalFilter, setKanalFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  async function load() {
    setLoading(true);
    const [salesRes, roomsRes, histRes, hcRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('rooms').select('id,name'),
      supabase.from('kartenumsaetze').select('*').order('datum', { ascending: false }),
      supabase.from('hotel_charges').select('id,amount_k'),
    ]);
    if (salesRes.error) setError(salesRes.error.message);
    else setSales(salesRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
    if (histRes.data) setHistorie(histRes.data);
    if (hcRes.data) setHotelCharges(hcRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function roomName(id) {
    return rooms.find((r) => r.id === id)?.name || '—';
  }

  function startEdit(row) {
    setEditingId(row.id);
    setDraft({ ...row });
  }

  async function saveEdit() {
    const { id, ...patch } = draft;
    const { error } = await supabase.from('sales').update(patch).eq('id', id);
    if (error) setError(error.message);
    else { setEditingId(null); setDraft(null); load(); }
  }

  async function deleteSale(id) {
    if (!confirm('Buchung wirklich löschen?')) return;
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  async function addSale() {
    if (!confirm('Neue leere Umsatzbuchung (0 Rp) anlegen?')) return;
    const { error } = await supabase.from('sales').insert({
      revenue_category: 'restaurant',
      total_k: 0,
      payment_method: 'cash',
    });
    if (error) setError(error.message);
    else load();
  }

  const visible = filterCategory ? sales.filter((s) => s.revenue_category === filterCategory) : sales;
  const total = visible.reduce((sum, s) => sum + Number(s.total_k || 0), 0);

  const alle = baueGesamtliste(historie, sales, hotelCharges);
  const counts = alle.reduce((acc, g) => { acc[g.status || 'ohne'] = (acc[g.status || 'ohne'] || 0) + 1; return acc; }, {});
  const gesamt = alle.filter((g) =>
    (abgleichFilter === 'all' || g.status === abgleichFilter) &&
    (!kanalFilter || g.kanal === kanalFilter)
  );
  const sumPreis = gesamt.reduce((a, g) => a + g.preis, 0);
  const sumBank = gesamt.reduce((a, g) => a + g.bank, 0);

  if (loading) return <div>Lade Umsätze…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Umsätze (Sales)</h2>
      <UmsatzDiagramme />
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <button onClick={() => setRohdatenOffen(!rohdatenOffen)} style={{ ...btnGhost, marginBottom: 10 }}>
        {rohdatenOffen ? '▾' : '▸'} Kassenterminal-Rohdaten bearbeiten
      </button>
      {rohdatenOffen && (<>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">Alle Kategorien</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <button onClick={addSale} style={btnPrimary}>+ Neue Buchung</button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)' }}>
          {visible.length} Einträge · Summe {total.toLocaleString('de-DE')}k
        </span>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '55vh', marginBottom: 24 }}>
        <table style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th>Datum</th><th>Kategorie</th><th>Zimmer</th><th>Gast</th>
              <th>Betrag (k)</th><th>Zahlung</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              editingId === s.id ? (
                <tr key={s.id}>
                  <td><input type="date" value={draft.created_at?.slice(0, 10) || ''} onChange={(e) => setDraft({ ...draft, created_at: e.target.value })} /></td>
                  <td>
                    <select value={draft.revenue_category || ''} onChange={(e) => setDraft({ ...draft, revenue_category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={draft.room_id || ''} onChange={(e) => setDraft({ ...draft, room_id: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">—</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td><input value={draft.guest_name || ''} onChange={(e) => setDraft({ ...draft, guest_name: e.target.value })} /></td>
                  <td><input type="number" value={draft.total_k || 0} onChange={(e) => setDraft({ ...draft, total_k: Number(e.target.value) })} style={{ width: 90 }} /></td>
                  <td>
                    <select value={draft.payment_method || ''} onChange={(e) => setDraft({ ...draft, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={saveEdit} style={btnPrimary}>Speichern</button>{' '}
                    <button onClick={() => { setEditingId(null); setDraft(null); }} style={btnGhost}>Abbrechen</button>
                  </td>
                </tr>
              ) : (
                <tr key={s.id} onClick={() => startEdit(s)} style={{ cursor: 'pointer' }}>
                  <td>{s.created_at ? formatDatum(s.created_at.slice(0, 10)) : '—'}</td>
                  <td>{CATEGORY_LABELS[s.revenue_category] || s.revenue_category}</td>
                  <td>{s.room_id ? roomName(s.room_id) : '—'}</td>
                  <td>{s.guest_name || '—'}</td>
                  <td>{Number(s.total_k || 0).toLocaleString('de-DE')}</td>
                  <td>{s.payment_method || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => deleteSale(s.id)} style={btnDanger}>✕</button>
                  </td>
                </tr>
              )
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Keine Umsätze gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </>)}

      <h3 style={{ color: 'var(--color-primary)', fontSize: 15 }}>Alle Umsätze &amp; Zahlungsabgleich — Hotel &amp; Restaurant</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { key: 'open', label: `⏳ Offen — noch abzugleichen (${counts.open || 0})` },
          { key: 'matched', label: `✅ Abgeglichen (${counts.matched || 0})` },
          { key: 'all', label: `Alle (${alle.length})` },
        ].map((f) => (
          <button key={f.key} onClick={() => setAbgleichFilter(f.key)} style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--color-border)',
            background: abgleichFilter === f.key ? 'var(--color-primary)' : 'white',
            color: abgleichFilter === f.key ? 'white' : 'var(--color-text)',
          }}>{f.label}</button>
        ))}
        <select value={kanalFilter} onChange={(e) => setKanalFilter(e.target.value)} style={{ marginLeft: 'auto' }}>
          <option value="">Alle Kanäle</option>
          {['Booking.com', 'Agoda', 'Karte', 'Bar', 'Direkt', 'Sonstige'].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
        Preis = Betrag laut Kassenterminal bzw. Buchung. Bankbetrag = was auf der Bank ankommt: Kartenzahlung minus 1,8 % Kartengebühr, sonst gleich dem Preis.
        {' '}{gesamt.length} Einträge · Preis {sumPreis.toLocaleString('de-DE')} · Bank {sumBank.toLocaleString('de-DE')}
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '60vh' }}>
        <table style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th>Datum</th><th>Bereich</th><th>Gast / Detail</th><th>Zahlungsart</th>
              <th style={{ textAlign: 'right' }}>Preis</th><th style={{ textAlign: 'right' }}>Bankbetrag</th>
              <th>Datenquelle</th><th>Abgleich</th><th>Info</th>
            </tr>
          </thead>
          <tbody>
            {gesamt.map((g) => (
              <tr key={g.key}>
                <td>{formatDatum(g.datum)}</td>
                <td>{g.bereich}</td>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>{g.detail}</td>
                <td>{g.kanal}</td>
                <td style={{ textAlign: 'right' }}>{g.preis.toLocaleString('de-DE')}</td>
                <td style={{ textAlign: 'right' }}>{g.bank.toLocaleString('de-DE')}</td>
                <td style={{ color: 'var(--color-muted)' }}>{g.datenquelle}</td>
                <td style={{ color: STATUS_COLOR[g.status], fontWeight: 600 }}>{STATUS_LABEL[g.status] || g.status || '—'}</td>
                <td style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }} title={g.info || ''}>{g.info || '—'}</td>
              </tr>
            ))}
            {gesamt.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Keine Umsätze in dieser Ansicht.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const KARTE = ['card', 'non tunai', 'karte', 'kartenzahlung', 'qris'];
function istKarte(z) { return KARTE.includes(String(z || '').trim().toLowerCase()); }

const STATUS_LABEL = { open: '⏳ Offen', matched: '✅ Abgeglichen' };
const STATUS_COLOR = { open: 'var(--color-warning)', matched: 'var(--color-success)' };

// Zahlungskanal aus Zahlungsart (und für Altdaten ohne klare Zahlungsart aus dem Detailtext)
function kanalVon(zahlungsart, detail) {
  const z = String(zahlungsart || '').trim().toLowerCase();
  if (z === 'booking' || z === 'booking.com') return 'Booking.com';
  if (z === 'agoda') return 'Agoda';
  if (istKarte(z)) return 'Karte';
  if (z === 'cash') return 'Bar';
  if (z === 'bank_transfer') return 'Direkt';
  const d = String(detail || '');
  if (d.includes('(Agoda')) return 'Agoda';
  if (d.includes('(Booking.com')) return 'Booking.com';
  if (d.toLowerCase().includes('direktbuchung')) return 'Direkt';
  return 'Sonstige';
}

// Eine Liste aus Zahlungsabgleich (kartenumsaetze, enthält auch die Zimmer aus dem Kassenterminal)
// plus den Restaurant-/Minibar-Umsätzen aus dem Kassenterminal (sales), die dort nicht enthalten sind.
function baueGesamtliste(historie, sales, hotelCharges) {
  const hcById = new Map(hotelCharges.map((h) => [h.id, h]));
  const rows = historie.map((h) => {
    const hc = h.hotel_charge_id ? hcById.get(h.hotel_charge_id) : null;
    const preis = Math.round(Number(h.jumlah_pembayaran || (hc ? Number(hc.amount_k) * 1000 : 0) || h.betrag || 0));
    const karte = istKarte(h.zahlungsart);
    return {
      key: `k-${h.id}`,
      datum: h.datum,
      bereich: h.quelle,
      detail: h.detail,
      zahlungsart: h.zahlungsart,
      preis,
      bank: karte ? Math.round(preis * 0.982) : preis,
      datenquelle: h.hotel_charge_id ? `Kassenterminal #${h.hotel_charge_id}` : 'Import Altdaten',
      status: h.match_status,
      kanal: kanalVon(h.zahlungsart, h.detail),
      info: h.match_info,
    };
  });
  for (const s of sales) {
    if (s.revenue_category === 'hotel') continue; // Zimmer stehen schon über hotel_charges in der Liste
    const preis = Math.round(Number(s.total_k || 0) * 1000);
    const karte = istKarte(s.payment_method);
    rows.push({
      key: `s-${s.id}`,
      datum: (s.created_at || '').slice(0, 10),
      bereich: s.revenue_category === 'minibar' ? 'Minibar' : 'Restaurant/Bar',
      detail: s.guest_name || '—',
      zahlungsart: s.payment_method,
      preis,
      bank: karte ? Math.round(preis * 0.982) : preis,
      datenquelle: 'Kassenterminal (Umsatz)',
      status: '',
      kanal: kanalVon(s.payment_method, ''),
      info: '',
    });
  }
  return rows.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
}

const btnPrimary = { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600 };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', fontSize: 12.5 };
const btnDanger = { background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 14 };
