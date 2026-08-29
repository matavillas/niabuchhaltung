import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { evaluateBooking } from '../lib/reconciliation';

const STATUS_ORDER = { warning: 0, pending: 1, ok: 2 };
const STATUS_COLOR = { warning: 'var(--color-danger)', pending: 'var(--color-warning)', ok: 'var(--color-success)' };

export default function Zahlungsabgleich() {
  const [agoda, setAgoda] = useState([]);
  const [booking, setBooking] = useState([]);
  const [hotelCharges, setHotelCharges] = useState([]);
  const [bankRows, setBankRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  async function load() {
    setLoading(true);
    const [a, b, hc, bb] = await Promise.all([
      supabase.from('agoda_buchungen').select('*'),
      supabase.from('bookingcom_buchungen').select('*'),
      supabase.from('hotel_charges').select('*'),
      supabase.from('bankbuch').select('datum,buchungstext,debit,credit')
        .or('buchungstext.ilike.%agoda%,buchungstext.ilike.%booking%'),
    ]);
    if (a.error || b.error || hc.error || bb.error) {
      setError(a.error?.message || b.error?.message || hc.error?.message || bb.error?.message);
    } else {
      setAgoda(a.data);
      setBooking(b.data);
      setHotelCharges(hc.data);
      setBankRows(bb.data);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const agodaRows = agoda.map((e) => ({ ...e, quelle: 'agoda', quelleLabel: 'Agoda' }));
    const bookingRows = booking.map((e) => ({ ...e, quelle: 'booking', quelleLabel: 'Booking.com' }));
    const all = [...agodaRows, ...bookingRows];
    return all
      .map((b) => ({ ...b, evalResult: evaluateBooking(b, b.quelle, hotelCharges, bankRows) }))
      .sort((x, y) => STATUS_ORDER[x.evalResult.status] - STATUS_ORDER[y.evalResult.status]
        || new Date(y.checkout) - new Date(x.checkout));
  }, [agoda, booking, hotelCharges, bankRows]);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.evalResult.status === filter);
  const counts = rows.reduce((acc, r) => { acc[r.evalResult.status] = (acc[r.evalResult.status] || 0) + 1; return acc; }, {});

  if (loading) return <div>Lade Zahlungsabgleich…</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Zahlungsabgleich (Agoda / Booking.com)</h2>
      {error && <div style={{ color: 'var(--color-danger)', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { key: 'all', label: `Alle (${rows.length})` },
          { key: 'warning', label: `⚠️ Zu prüfen (${counts.warning || 0})` },
          { key: 'pending', label: `⏳ Ausstehend (${counts.pending || 0})` },
          { key: 'ok', label: `✅ Erledigt (${counts.ok || 0})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12.5, border: '1px solid var(--color-border)',
              background: filter === f.key ? 'var(--color-primary)' : 'white',
              color: filter === f.key ? 'white' : 'var(--color-text)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'auto', maxHeight: '70vh' }}>
        <table>
          <thead>
            <tr><th>Quelle</th><th>Gast</th><th>Check-in</th><th>Check-out</th><th>Betrag</th><th>Zahlweg</th><th>Status</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={`${r.quelle}-${r.id}`}>
                <td>{r.quelleLabel}</td>
                <td>{r.gast}</td>
                <td>{r.checkin}</td>
                <td>{r.checkout}</td>
                <td>{Number(r.betrag || 0).toLocaleString('de-DE')}</td>
                <td>{r.zahlweg}</td>
                <td style={{ color: STATUS_COLOR[r.evalResult.status], fontWeight: 600 }}>
                  {r.evalResult.label}
                  <div style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--color-muted)' }}>{r.evalResult.detail}</div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Keine Buchungen in dieser Ansicht.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
        Regeln: Vor-Ort-Zahlung 1 Tag Toleranz (Karte: Folgetag minus 1,8% Gebühr, Cash: taggleich) ·
        Booking.com-Auszahlung: wöchentlich donnerstags, 10 Tage Toleranz ·
        Agoda-Auszahlung: 30 Tage nach Check-out. Agoda-Kommission (≈18%) ist geschätzt, da nicht separat ausgewiesen.
      </p>
    </div>
  );
}
