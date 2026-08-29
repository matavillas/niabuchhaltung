import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('rooms').select('*').order('sort_order');
    if (error) setError(error.message);
    else setRooms(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addRoom() {
    if (!newName.trim()) return;
    const maxSort = rooms.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
    const { error } = await supabase.from('rooms').insert({ name: newName.trim(), sort_order: maxSort + 1 });
    if (error) setError(error.message);
    else { setNewName(''); load(); }
  }

  async function updateRoom(id, patch) {
    const { error } = await supabase.from('rooms').update(patch).eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  async function deleteRoom(id) {
    if (!confirm('Zimmer wirklich löschen?')) return;
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  if (loading) return <div>Lade Zimmer…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Zimmer</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Neues Zimmer (Name)" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={addRoom} style={btnPrimary}>+ Hinzufügen</button>
      </div>
      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>Name</th><th>Reihenfolge</th><th>Aktiv</th><th></th></tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    defaultValue={r.name}
                    onBlur={(e) => e.target.value !== r.name && updateRoom(r.id, { name: e.target.value })}
                  />
                </td>
                <td style={{ width: 100 }}>
                  <input
                    type="number"
                    defaultValue={r.sort_order}
                    onBlur={(e) => Number(e.target.value) !== r.sort_order && updateRoom(r.id, { sort_order: Number(e.target.value) })}
                  />
                </td>
                <td style={{ width: 80 }}>
                  <input type="checkbox" checked={r.active} onChange={(e) => updateRoom(r.id, { active: e.target.checked })} />
                </td>
                <td style={{ width: 40 }}>
                  <button onClick={() => deleteRoom(r.id)} style={btnDanger}>✕</button>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr><td colSpan={4} style={{ color: 'var(--color-muted)', textAlign: 'center' }}>Keine Zimmer angelegt.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnPrimary = { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600 };
const btnDanger = { background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 14 };
