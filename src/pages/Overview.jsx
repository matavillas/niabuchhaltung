import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Overview() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    async function load() {
      const [kb, bb, karten, agoda, booking, rooms, sales, orders] = await Promise.all([
        supabase.from('kassenbuch').select('*', { count: 'exact', head: true }),
        supabase.from('bankbuch').select('*', { count: 'exact', head: true }),
        supabase.from('kartenumsaetze').select('*', { count: 'exact', head: true }),
        supabase.from('agoda_buchungen').select('*', { count: 'exact', head: true }),
        supabase.from('bookingcom_buchungen').select('*', { count: 'exact', head: true }),
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
      ]);
      setCounts({
        kb: kb.count, bb: bb.count, karten: karten.count, agoda: agoda.count,
        booking: booking.count, rooms: rooms.count, sales: sales.count, orders: orders.count,
      });
    }
    load();
  }, []);

  const cards = counts ? [
    { label: 'Kassenbuch', value: counts.kb },
    { label: 'Bankbuch', value: counts.bb },
    { label: 'Kartenumsätze', value: counts.karten },
    { label: 'Agoda', value: counts.agoda },
    { label: 'Booking.com', value: counts.booking },
    { label: 'Zimmer', value: counts.rooms },
    { label: 'Umsätze (Sales)', value: counts.sales },
    { label: 'Bestellungen', value: counts.orders },
  ] : [];

  return (
    <div>
      <h2 style={{ color: 'var(--color-primary)' }}>Übersicht</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '18px 16px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-primary)' }}>{c.value ?? '…'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
