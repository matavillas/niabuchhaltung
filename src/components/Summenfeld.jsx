// Summenfeld über der Tabelle: zeigt Summen der aktuell gefilterten Buchungen.
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('de-DE');

export default function Summenfeld({ anzahl, einLabel, ein, ausLabel, aus }) {
  const diff = ein - aus;
  return (
    <div style={box}>
      <span style={titel}>Summe Auswahl ({anzahl} Einträge)</span>
      <Wert label={einLabel} wert={ein} farbe="var(--color-success)" />
      <Wert label={ausLabel} wert={aus} farbe="var(--color-danger)" />
      <Wert label="Differenz" wert={diff} farbe={diff < 0 ? 'var(--color-danger)' : 'var(--color-text)'} fett />
    </div>
  );
}

function Wert({ label, wert, farbe, fett }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 120 }}>
      <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: fett ? 700 : 600, color: farbe, fontVariantNumeric: 'tabular-nums' }}>{fmt(wert)}</span>
    </span>
  );
}

const box = {
  display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
  background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)',
  padding: '10px 14px', marginBottom: 14,
};
const titel = { fontSize: 12.5, fontWeight: 600, marginRight: 8 };
