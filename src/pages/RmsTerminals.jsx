import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const TERMINALS = [
  { key: 'manager', label: 'Manager', file: 'manager_terminal.html' },
  { key: 'kasse', label: 'Kasse', file: 'kasse_terminal.html' },
  { key: 'pos', label: 'POS', file: 'pos_terminal.html' },
  { key: 'kds', label: 'Küche (KDS)', file: 'kds_terminal.html' },
  { key: 'bar', label: 'Bar', file: 'bar_terminal.html' },
  { key: 'tischplan', label: 'Tischplan', file: 'tischplan.html' },
];

const BASE_URL = '/rms/';
const SS_STAFF_KEY = 'rms_autostaff_id';
const SS_PIN_KEY = 'rms_autostaff_pin';

export default function RmsTerminals() {
  const [active, setActive] = useState(TERMINALS[0].key);
  const [reloadKey, setReloadKey] = useState(0);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(sessionStorage.getItem(SS_STAFF_KEY) || '');
  const [pinDraft, setPinDraft] = useState('');
  const [autoLoginActive, setAutoLoginActive] = useState(
    !!(sessionStorage.getItem(SS_STAFF_KEY) && sessionStorage.getItem(SS_PIN_KEY))
  );
  const [showSetup, setShowSetup] = useState(!autoLoginActive);

  useEffect(() => {
    supabase.from('staff').select('id,fname,lname').eq('active', true).order('fname').then(({ data }) => {
      setStaffList(data || []);
    });
  }, []);

  function saveAutoLogin() {
    if (!selectedStaff || pinDraft.length !== 4) return;
    sessionStorage.setItem(SS_STAFF_KEY, selectedStaff);
    sessionStorage.setItem(SS_PIN_KEY, pinDraft);
    setAutoLoginActive(true);
    setShowSetup(false);
    setPinDraft('');
    setReloadKey((k) => k + 1);
  }

  function clearAutoLogin() {
    sessionStorage.removeItem(SS_STAFF_KEY);
    sessionStorage.removeItem(SS_PIN_KEY);
    setAutoLoginActive(false);
    setShowSetup(true);
    setReloadKey((k) => k + 1);
  }

  const current = TERMINALS.find((t) => t.key === active);
  let url = BASE_URL + current.file;
  const storedStaff = sessionStorage.getItem(SS_STAFF_KEY);
  const storedPin = sessionStorage.getItem(SS_PIN_KEY);
  if (autoLoginActive && storedStaff && storedPin && current.key !== 'tischplan') {
    url += `?autostaff=${encodeURIComponent(storedStaff)}&autopin=${encodeURIComponent(storedPin)}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ color: 'var(--color-primary)', marginBottom: 6 }}>RMS-Terminals</h2>
      <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 10 }}>
        Live-Ansicht der Terminal-Oberflächen (dasselbe System wie auf den Geräten vor Ort).
      </div>

      {showSetup ? (
        <div style={{
          background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)',
          padding: 12, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Auto-Login für diese Sitzung einrichten:</span>
          <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} style={{ padding: '5px 8px' }}>
            <option value="">— Mitarbeiter —</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.fname} {s.lname || ''}</option>)}
          </select>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="PIN (4-stellig)"
            value={pinDraft}
            onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={{ padding: '5px 8px', width: 100 }}
          />
          <button onClick={saveAutoLogin} disabled={!selectedStaff || pinDraft.length !== 4} style={btnPrimary}>
            Speichern für diese Sitzung
          </button>
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
            PIN wird nur im Browser-Tab gespeichert (verschwindet beim Schließen), nie im Code oder auf dem Server.
          </span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          ✓ Auto-Login aktiv für diese Sitzung.
          <button onClick={clearAutoLogin} style={btnGhost}>Zurücksetzen / andere Person</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {TERMINALS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActive(t.key); setReloadKey((k) => k + 1); }}
            style={{
              ...btnTab,
              background: active === t.key ? 'var(--color-primary)' : 'none',
              color: active === t.key ? 'white' : 'inherit',
              fontWeight: active === t.key ? 700 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setReloadKey((k) => k + 1)} style={btnGhost}>↻ Neu laden</button>
          <a href={url} target="_blank" rel="noreferrer">
            <button type="button" style={btnGhost}>↗ In neuem Tab öffnen</button>
          </a>
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 640, background: 'var(--color-surface)', borderRadius: 8,
        boxShadow: 'var(--shadow)', overflow: 'hidden', border: '1px solid var(--color-border)',
      }}>
        <iframe
          key={active + reloadKey}
          src={url}
          title={current.label}
          style={{ width: '100%', height: '100%', minHeight: 640, border: 'none' }}
        />
      </div>

      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8 }}>
        Läuft jetzt direkt unter dieser Adresse (kein externes GitHub Pages mehr nötig).
      </div>
    </div>
  );
}

const btnTab = { border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' };
const btnPrimary = { background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };

