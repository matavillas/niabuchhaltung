import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const STATUSES = ['new', 'cooking', 'ready', 'served', 'paid', 'cancelled'];
const STATUS_COLORS = {
  new: '#B7791F', cooking: '#2E86AB', ready: '#1E7B45',
  served: '#64748B', paid: '#1F4E79', cancelled: '#C0392B',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [itemCounts, setItemCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { setError(error.message); setLoading(false); return; }
    setOrders(data);

    const { data: items } = await supabase.from('order_items').select('order_id');
    const counts = {};
    (items || []).forEach((i) => { counts[i.order_id] = (counts[i.order_id] || 0) + 1; });
    setItemCounts(counts);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id, status) {
    const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  async function deleteOrder(id) {
    if (!confirm('Bestellung wirklich löschen?')) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  const visible = filterStatus ? orders.filter((o) => o.status === filterStatus) : orders;

  if (loading) return <div>Lade Bestellungen…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Bestellungen (Orders)</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Alle Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)', alignSelf: 'center' }}>
          {visible.length} Bestellungen
        </span>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '70vh' }}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Tisch/Zimmer</th><th>Typ</th><th>Positionen</th>
              <th>Summe (k)</th><th>Status</th><th>Erstellt</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.table_number ? `Tisch ${o.table_number}` : o.room_id ? `Zimmer ${o.room_id}` : '—'}</td>
                <td>{o.order_type || '—'}</td>
                <td>{itemCounts[o.id] || 0}</td>
                <td>{Number(o.total_k || 0).toLocaleString('de-DE')}</td>
                <td>
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                    style={{ color: STATUS_COLORS[o.status] || 'inherit', fontWeight: 600 }}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>{o.created_at ? new Date(o.created_at).toLocaleString('de-DE') : '—'}</td>
                <td>
                  <button onClick={() => deleteOrder(o.id)} style={btnDanger}>✕</button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Keine Bestellungen gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnDanger = { background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 14 };
