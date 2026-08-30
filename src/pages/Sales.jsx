import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const CATEGORIES = ['restaurant', 'room', 'spa', 'dive', 'other'];
const PAYMENT_METHODS = ['cash', 'card', 'qris', 'bank_transfer', 'ota'];

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  async function load() {
    setLoading(true);
    const [salesRes, roomsRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('rooms').select('id,name'),
    ]);
    if (salesRes.error) setError(salesRes.error.message);
    else setSales(salesRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
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

  if (loading) return <div>Lade Umsätze…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Umsätze (Sales)</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">Alle Kategorien</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={addSale} style={btnPrimary}>+ Neue Buchung</button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)' }}>
          {visible.length} Einträge · Summe {total.toLocaleString('de-DE')}k
        </span>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '70vh' }}>
        <table>
          <thead>
            <tr>
              <th>Datum</th><th>Kategorie</th><th>Zimmer</th><th>Gast</th>
              <th>Betrag (k)</th><th>Zahlung</th><th>Rabatt %</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              editingId === s.id ? (
                <tr key={s.id}>
                  <td><input type="date" value={draft.created_at?.slice(0, 10) || ''} onChange={(e) => setDraft({ ...draft, created_at: e.target.value })} /></td>
                  <td>
                    <select value={draft.revenue_category || ''} onChange={(e) => setDraft({ ...draft, revenue_category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
                  <td><input type="number" value={draft.discount_percent || 0} onChange={(e) => setDraft({ ...draft, discount_percent: Number(e.target.value) })} style={{ width: 60 }} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={saveEdit} style={btnPrimary}>Speichern</button>{' '}
                    <button onClick={() => { setEditingId(null); setDraft(null); }} style={btnGhost}>Abbrechen</button>
                  </td>
                </tr>
              ) : (
                <tr key={s.id} onClick={() => startEdit(s)} style={{ cursor: 'pointer' }}>
                  <td>{s.created_at ? new Date(s.created_at).toLocaleDateString('de-DE') : '—'}</td>
                  <td>{s.revenue_category}</td>
                  <td>{s.room_id ? roomName(s.room_id) : '—'}</td>
                  <td>{s.guest_name || '—'}</td>
                  <td>{Number(s.total_k || 0).toLocaleString('de-DE')}</td>
                  <td>{s.payment_method || '—'}</td>
                  <td>{s.discount_percent || 0}%</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => deleteSale(s.id)} style={btnDanger}>✕</button>
                  </td>
                </tr>
              )
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Keine Umsätze gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnPrimary = { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600 };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', fontSize: 12.5 };
const btnDanger = { background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 14 };
