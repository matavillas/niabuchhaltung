import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const STATUS = { 1: 'Single', 2: 'Married', 3: 'K/0', 4: 'K/1', 5: 'K/2', 6: 'K/3' };
const fmt = (n) => Number(n || 0).toLocaleString('de-DE');
const num = (s) => Number(String(s ?? '').replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '')) || 0;

function vormonat() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { jahr: d.getFullYear(), monat: d.getMonth() + 1 };
}

export default function Lohn() {
  const start = vormonat();
  const [jahr, setJahr] = useState(start.jahr);
  const [monat, setMonat] = useState(start.monat);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [werte, setWerte] = useState([]);
  const [edit, setEdit] = useState({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [neu, setNeu] = useState(null);

  async function load() {
    setError('');
    const [ma, lm] = await Promise.all([
      supabase.from('lohn_mitarbeiter').select('*').order('sortierung').order('id'),
      supabase.from('lohn_monat').select('*').eq('jahr', jahr),
    ]);
    if (ma.error || lm.error) { setError((ma.error || lm.error).message); return; }
    setMitarbeiter(ma.data);
    setWerte(lm.data);
    setEdit({});
  }
  useEffect(() => { load(); }, [jahr]); // eslint-disable-line react-hooks/exhaustive-deps

  const monatsWerte = useMemo(() => {
    const m = {};
    werte.filter((w) => w.monat === monat).forEach((w) => { m[w.mitarbeiter_id] = w; });
    return m;
  }, [werte, monat]);

  const aktive = mitarbeiter.filter((m) => {
    const ab = m.eintritt ? new Date(m.eintritt) : null;
    const bis = m.austritt ? new Date(m.austritt) : null;
    const monatsEnde = new Date(jahr, monat, 0);
    const monatsAnfang = new Date(jahr, monat - 1, 1);
    return (!ab || ab <= monatsEnde) && (!bis || bis >= monatsAnfang);
  });

  const zeile = (m) => edit[m.id] ?? {
    basic: monatsWerte[m.id]?.basic ?? '',
    bpjs_kes: monatsWerte[m.id]?.bpjs_kes ?? '',
    bpjs_tk: monatsWerte[m.id]?.bpjs_tk ?? '',
    notiz: monatsWerte[m.id]?.notiz ?? '',
  };
  const setFeld = (id, feld, v) => setEdit((e) => ({ ...e, [id]: { ...zeile({ id }), ...e[id], [feld]: v } }));

  async function speichern() {
    setMsg(''); setError('');
    const rows = Object.entries(edit).map(([id, z]) => ({
      mitarbeiter_id: Number(id), jahr, monat,
      basic: num(z.basic), bpjs_kes: num(z.bpjs_kes), bpjs_tk: num(z.bpjs_tk), notiz: z.notiz || null,
      updated_at: new Date().toISOString(),
    }));
    if (!rows.length) return;
    const { error } = await supabase.from('lohn_monat').upsert(rows, { onConflict: 'mitarbeiter_id,jahr,monat' });
    if (error) setError(error.message);
    else { setMsg(`${rows.length} Zeile(n) gespeichert.`); load(); }
  }

  async function mitarbeiterAnlegen() {
    setError('');
    const { error } = await supabase.from('lohn_mitarbeiter').insert({
      name: neu.name, id_nummer: neu.id_nummer || null, status: Number(neu.status) || null,
      geschlecht: Number(neu.geschlecht) || null, adresse: neu.adresse || null,
      eintritt: neu.eintritt || null, sortierung: (mitarbeiter.length + 1) * 10,
    });
    if (error) setError(error.message);
    else { setNeu(null); load(); }
  }

  async function austrittSetzen(m, datum) {
    const { error } = await supabase.from('lohn_mitarbeiter').update({ austritt: datum || null }).eq('id', m.id);
    if (error) setError(error.message); else load();
  }

  const summe = aktive.reduce((s, m) => {
    const z = zeile(m);
    return s + num(z.basic) + num(z.bpjs_kes) + num(z.bpjs_tk);
  }, 0);
  const jahre = [2025, 2026, 2027];

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Löhne</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}
      {msg && <div style={{ color: 'var(--color-success)', marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={monat} onChange={(e) => { setMonat(Number(e.target.value)); setEdit({}); }}>
          {MONATE.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        <select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
          {jahre.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <button onClick={speichern} disabled={!Object.keys(edit).length} style={btn(true)}>Speichern</button>
        <button onClick={() => setNeu({ name: '', status: 1, geschlecht: 1 })} style={btn(false)}>+ Mitarbeiter</button>
      </div>

      {neu && (
        <div style={card}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="Name" value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} />
            <input placeholder="ID-Nummer (NIK)" value={neu.id_nummer || ''} onChange={(e) => setNeu({ ...neu, id_nummer: e.target.value })} />
            <select value={neu.status} onChange={(e) => setNeu({ ...neu, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={neu.geschlecht} onChange={(e) => setNeu({ ...neu, geschlecht: e.target.value })}>
              <option value={1}>M</option><option value={2}>F</option>
            </select>
            <input placeholder="Adresse" value={neu.adresse || ''} onChange={(e) => setNeu({ ...neu, adresse: e.target.value })} />
            <label style={{ fontSize: 12 }}>Eintritt <input type="date" value={neu.eintritt || ''} onChange={(e) => setNeu({ ...neu, eintritt: e.target.value })} /></label>
            <button onClick={mitarbeiterAnlegen} disabled={!neu.name} style={btn(true)}>Anlegen</button>
            <button onClick={() => setNeu(null)} style={btn(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto' }}>
        <table style={{ fontSize: 12.5 }}>
          <thead>
            <tr><th>Name</th><th>Status</th><th>Basic Salary</th><th>BPJS Kes</th><th>BPJS TK</th><th>Total</th><th>Notiz</th><th>Austritt</th></tr>
          </thead>
          <tbody>
            {aktive.map((m) => {
              const z = zeile(m);
              const total = num(z.basic) + num(z.bpjs_kes) + num(z.bpjs_tk);
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td>{STATUS[m.status] || '—'}</td>
                  {['basic', 'bpjs_kes', 'bpjs_tk'].map((f) => (
                    <td key={f}>
                      <input style={{ width: 110, textAlign: 'right' }} value={edit[m.id] ? z[f] : (z[f] === '' ? '' : fmt(z[f]))}
                        onChange={(e) => setFeld(m.id, f, e.target.value)} />
                    </td>
                  ))}
                  <td style={{ fontWeight: 600, textAlign: 'right' }}>{fmt(total)}</td>
                  <td><input style={{ width: 160 }} value={z.notiz || ''} onChange={(e) => setFeld(m.id, 'notiz', e.target.value)} /></td>
                  <td><input type="date" value={m.austritt || ''} onChange={(e) => austrittSetzen(m, e.target.value)} /></td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>Summe {MONATE[monat - 1]} {jahr}</td>
              <td style={{ fontWeight: 700, textAlign: 'right' }}>{fmt(summe)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
        Angezeigt werden Mitarbeiter, die im gewählten Monat beschäftigt waren (Eintritt/Austritt). Beträge in IDR.
        Diese Daten gehen in die Lohntabelle des Monatsberichts an Lilo.
      </p>
    </div>
  );
}

const card = { background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', padding: 12, marginBottom: 14 };
function btn(primary) {
  return {
    padding: '6px 14px', borderRadius: 6, fontSize: 12.5, border: '1px solid var(--color-border)',
    background: primary ? 'var(--color-primary)' : 'white', color: primary ? 'white' : 'var(--color-text)',
  };
}
