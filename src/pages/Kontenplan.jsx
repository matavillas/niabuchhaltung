import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Kontenplan() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingCode, setEditingCode] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('kontenplan').select('*').order('code');
    if (error) setError(error.message);
    else setRows(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(row) {
    setEditingCode(row.code);
    setDraftName(row.name);
  }

  async function saveEdit(code) {
    const { error } = await supabase.from('kontenplan').update({ name: draftName }).eq('code', code);
    if (error) setError(error.message);
    else { setEditingCode(null); load(); }
  }

  async function deleteRow(code) {
    if (!confirm(`Konto ${code} wirklich löschen?`)) return;
    const { error } = await supabase.from('kontenplan').delete().eq('code', code);
    if (error) setError(error.message);
    else load();
  }

  async function addRow() {
    if (!newCode.trim() || !newName.trim()) return;
    const { error } = await supabase.from('kontenplan').insert({ code: newCode.trim(), name: newName.trim() });
    if (error) setError(error.message);
    else { setNewCode(''); setNewName(''); setAdding(false); load(); }
  }

  const visible = rows.filter((r) =>
    !search || r.code.includes(search) || r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div>Lade Kontenplan…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Kontenplan</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <input
          placeholder="Suche nach Konto-Nr. oder Bezeichnung…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', minWidth: 260 }}
        />
        <button onClick={() => setAdding((a) => !a)} style={btnPrimary}>+ Neues Konto</button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-muted)' }}>{visible.length} Konten</span>
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', background: 'var(--color-surface)', padding: 10, borderRadius: 8 }}>
          <input placeholder="Konto-Nr. (z.B. 783)" value={newCode} onChange={(e) => setNewCode(e.target.value)} style={{ width: 140 }} />
          <input placeholder="Bezeichnung" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1 }} />
          <button onClick={addRow} style={btnPrimary}>Anlegen</button>
          <button onClick={() => setAdding(false)} style={btnGhost}>Abbrechen</button>
        </div>
      )}

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '75vh' }}>
        <table>
          <thead>
            <tr><th style={{ width: 100 }}>Konto-Nr.</th><th>Bezeichnung</th><th style={{ width: 140 }}></th></tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.code}>
                <td style={{ fontWeight: 600 }}>{r.code}</td>
                <td>
                  {editingCode === r.code
                    ? <input value={draftName} onChange={(e) => setDraftName(e.target.value)} style={{ width: '100%' }} autoFocus />
                    : r.name}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {editingCode === r.code ? (
                    <>
                      <button onClick={() => saveEdit(r.code)} style={btnPrimary}>Speichern</button>{' '}
                      <button onClick={() => setEditingCode(null)} style={btnGhost}>Abbrechen</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(r)} style={btnGhost}>Bearbeiten</button>{' '}
                      <button onClick={() => deleteRow(r.code)} style={btnDanger}>✕</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Keine Konten gefunden.</td></tr>
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
