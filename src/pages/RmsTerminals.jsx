import { useState } from 'react';

const TERMINALS = [
  { key: 'manager', label: 'Manager', file: 'manager_terminal.html' },
  { key: 'kasse', label: 'Kasse', file: 'kasse_terminal.html' },
  { key: 'pos', label: 'POS', file: 'pos_terminal.html' },
  { key: 'kds', label: 'Küche (KDS)', file: 'kds_terminal.html' },
  { key: 'bar', label: 'Bar', file: 'bar_terminal.html' },
  { key: 'tischplan', label: 'Tischplan', file: 'tischplan.html' },
];

const BASE_URL = 'https://matavillas.github.io/Tourmanager/';

export default function RmsTerminals() {
  const [active, setActive] = useState(TERMINALS[0].key);
  const [reloadKey, setReloadKey] = useState(0);
  const current = TERMINALS.find((t) => t.key === active);
  const url = BASE_URL + current.file;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ color: 'var(--color-primary)', marginBottom: 6 }}>RMS-Terminals</h2>
      <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 14 }}>
        Live-Ansicht der Terminal-Oberflächen (dasselbe System wie auf den Geräten vor Ort). Login jeweils per PIN wie gewohnt.
      </div>

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
        Falls die Ansicht leer bleibt oder sich nicht lädt (manche Browser blockieren eingebettete fremde Seiten): oben rechts "In neuem Tab öffnen" nutzen.
      </div>
    </div>
  );
}

const btnTab = { border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' };
const btnGhost = { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' };
