import Kassenbuch from './Kassenbuch';

const SAKTI_YEARS = [
  { value: 'alle', label: 'Gesamter Zeitraum' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
];

// Kassenbuch von Raja Andeta Sakti (Projektleitung Bau) – eigene Tabelle kassenbuch_sakti.
// Anzeigen und Bearbeiten wie im Hauptkassenbuch; neue Einträge vorerst nur über die Buchhaltung.
export default function KassenbuchSakti() {
  return <Kassenbuch table="kassenbuch_sakti" title="Kassenbuch Sakti" defaultYear="alle" allowNew={false} yearOptions={SAKTI_YEARS} />;
}
