// Zahlungsabgleich: gleicht OTA-Buchungen (Agoda/Booking.com) gegen tatsächliche
// Zahlungseingänge (hotel_charges für Vor-Ort-Zahlungen, bankbuch für OTA-Auszahlungen) ab.

const CARD_FEE = 0.018; // 1,8% Kreditkartengebühr
const AGODA_COMMISSION_ESTIMATE = 0.18; // ca. 18%, näherungsweise (Rabatte vermischt)

const VOR_ORT_GRACE_DAYS = 1; // Karte: nächster Tag; Cash: taggleich -> 1 Tag Toleranz
const BOOKING_PAYOUT_GRACE_DAYS = 10; // wöchentliche Donnerstags-Auszahlung + Verarbeitungszeit
const AGODA_PAYOUT_GRACE_DAYS = 30; // exakt 30 Tage nach Checkout

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Akzente entfernen
    .replace(/[^a-z0-9]/g, '');
}

// Einfache Ähnlichkeit: Levenshtein-Distanz relativ zur Länge
function similarity(a, b) {
  const s1 = normalizeName(a);
  const s2 = normalizeName(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1;
  const dist = levenshtein(longer, shorter);
  return (longer.length - dist) / longer.length;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

const NAME_MATCH_THRESHOLD = 0.6;

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Findet den besten hotel_charges-Treffer für eine "Zahlung vor Ort"-Buchung.
 */
function findHotelChargeMatch(booking, hotelCharges) {
  let best = null;
  let bestScore = 0;
  for (const hc of hotelCharges) {
    const nameScore = similarity(booking.gast, hc.guest_name);
    if (nameScore < NAME_MATCH_THRESHOLD) continue;
    const dateDiff = Math.abs(daysBetween(booking.checkin, hc.checkin_date || hc.created_at?.slice(0, 10)));
    if (dateDiff > 2) continue;
    const score = nameScore - dateDiff * 0.05;
    if (score > bestScore) { bestScore = score; best = hc; }
  }
  return best;
}

/**
 * Findet den besten Bankbuch-Treffer für eine OTA-Sammelauszahlung.
 * OTA-Zahlungen sind Sammelüberweisungen — Match erfolgt daher primär über
 * Zeitraum + Stichwort im Buchungstext, nicht über den Einzelbetrag.
 */
function findPayoutMatch(booking, quelle, bankRows) {
  const keyword = quelle === 'agoda' ? 'agoda' : 'booking';
  const checkoutDate = booking.checkout;
  const graceDays = quelle === 'agoda' ? AGODA_PAYOUT_GRACE_DAYS : BOOKING_PAYOUT_GRACE_DAYS;
  const windowEnd = new Date(checkoutDate);
  windowEnd.setDate(windowEnd.getDate() + graceDays + 15); // Suchfenster etwas großzügiger als Warnschwelle

  return bankRows.find((r) => {
    const text = (r.buchungstext || '').toLowerCase();
    if (!text.includes(keyword)) return false;
    const rDate = new Date(r.datum);
    return rDate >= new Date(checkoutDate) && rDate <= windowEnd;
  }) || null;
}

/**
 * Berechnet den Abgleichsstatus für eine einzelne OTA-Buchung.
 * Rückgabe: { status: 'ok' | 'warning' | 'pending', label, detail }
 */
export function evaluateBooking(booking, quelle, hotelCharges, bankRows) {
  const isVorOrt = quelle === 'booking' && booking.zahlweg === 'Zahlung vor Ort';
  const t = today();

  if (isVorOrt) {
    const match = findHotelChargeMatch(booking, hotelCharges);
    const daysSinceCheckin = daysBetween(booking.checkin, t);
    if (match) {
      // Kartenzahlung: Betrag minus 1,8% sollte am Folgetag im Bankbuch stehen — hier nur Ist-Erfassung bestätigt
      return { status: 'ok', label: '✅ Vor Ort erfasst', detail: `Zahlweg: ${match.payment_method || '—'}` };
    }
    if (daysSinceCheckin > VOR_ORT_GRACE_DAYS) {
      return { status: 'warning', label: '⚠️ Zahlung vor Ort erwartet, nicht gefunden', detail: `Check-in vor ${daysSinceCheckin} Tagen` };
    }
    return { status: 'pending', label: '⏳ Check-in steht bevor', detail: booking.checkin };
  }

  // OTA zieht Geld selbst ein (Agoda immer, oder Booking.com "Zahlung über Booking.com")
  const payout = findPayoutMatch(booking, quelle, bankRows);
  const graceDays = quelle === 'agoda' ? AGODA_PAYOUT_GRACE_DAYS : BOOKING_PAYOUT_GRACE_DAYS;
  const daysSinceCheckout = daysBetween(booking.checkout, t);

  if (payout) {
    let commissionNote = '';
    if (quelle === 'booking' && booking.kommission != null) {
      const expectedNet = Number(booking.betrag) - Number(booking.kommission);
      commissionNote = ` · erwartet netto ${expectedNet.toLocaleString('de-DE')}`;
    } else if (quelle === 'agoda') {
      const estNet = Number(booking.betrag) * (1 - AGODA_COMMISSION_ESTIMATE);
      commissionNote = ` · ca. netto ${estNet.toLocaleString('de-DE')} (18% geschätzt, zu prüfen)`;
    }
    return { status: 'ok', label: '✅ Auszahlung gefunden', detail: `${payout.datum}${commissionNote}` };
  }
  if (daysSinceCheckout > graceDays) {
    return { status: 'warning', label: '⚠️ OTA-Auszahlung überfällig', detail: `Check-out vor ${daysSinceCheckout} Tagen, erwartet nach ${graceDays} Tagen` };
  }
  return { status: 'pending', label: '⏳ Auszahlung ausstehend', detail: `erwartet bis ${graceDays - daysSinceCheckout} Tage` };
}

export { CARD_FEE, AGODA_COMMISSION_ESTIMATE };
