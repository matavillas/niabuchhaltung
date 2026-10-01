// Monatsbericht für Lilo (Steuerberater): Lohntabelle, Income Hotel, Income Bar als Excel.
// Kontoauszüge werden als Original-Dateien (PDF aus Kopra) auf der Seite hinzugefügt.
import { supabase } from './supabaseClient';

const MONAT_ID = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOPEMBER', 'DESEMBER'];
const MONAT_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NUM = '#,##0';

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
// Datum in Lombok-Zeit (UTC+8) als YYYY-MM-DD
const lokalDatum = (ts) => new Date(new Date(ts).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const tglID = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const zahlartText = (p) => ({ booking: 'Booking.com', agoda: 'Agoda', card: 'Kartu (Non Tunai)', cash: 'Tunai', qr: 'QR (Non Tunai)' }[String(p || '').toLowerCase()] || p || '');
const tunai = (p) => (String(p || '').toLowerCase() === 'cash' ? 'Tunai' : 'Non Tunai');

export function monatsGrenzen(jahr, monat) {
  const last = new Date(jahr, monat, 0).getDate();
  return { von: isoDate(jahr, monat, 1), bis: isoDate(jahr, monat, last), label: `${MONAT_DE[monat - 1]} ${jahr}`, tag: `${jahr}-${pad(monat)}` };
}

async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

export async function ladeBerichtsdaten(jahr, monat) {
  const g = monatsGrenzen(jahr, monat);
  const tsVon = new Date(Date.parse(`${g.von}T00:00:00+08:00`)).toISOString();
  const tsBis = new Date(Date.parse(`${g.bis}T23:59:59+08:00`)).toISOString();

  const [mitarbeiter, lohn, zimmer, rooms, abgleich, bar] = await Promise.all([
    q(supabase.from('lohn_mitarbeiter').select('*').order('sortierung').order('id')),
    q(supabase.from('lohn_monat').select('*').eq('jahr', jahr)),
    q(supabase.from('hotel_charges').select('*').gte('checkin_date', g.von).lte('checkin_date', g.bis).order('checkin_date').order('id')),
    q(supabase.from('rooms').select('id,name')),
    q(supabase.from('kartenumsaetze').select('hotel_charge_id,netto,match_status,match_info').not('hotel_charge_id', 'is', null)),
    q(supabase.from('sales').select('*').in('revenue_category', ['restaurant', 'minibar', 'bar']).gte('created_at', tsVon).lte('created_at', tsBis).order('created_at')),
  ]);

  const roomName = Object.fromEntries(rooms.map((r) => [r.id, r.name]));
  const abgleichByHc = Object.fromEntries(abgleich.map((a) => [a.hotel_charge_id, a]));
  return { jahr, monat, g, mitarbeiter, lohn, zimmer, roomName, abgleichByHc, bar };
}

// ---------- Excel-Helfer ----------
async function neueMappe() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mata Villas Buchhaltung';
  wb.created = new Date();
  return wb;
}
const fett = { bold: true };
const rahmen = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
function kopfzeile(row) {
  row.eachCell((c) => {
    c.font = fett;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE7F0' } };
    c.border = rahmen;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
}
async function alsDatei(wb, name) {
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], name, { type: XLSX_TYPE });
}

// ---------- 1. Lohntabelle (Format wie "Salery PT Nusantara Indonesia Asri.xlsx") ----------
async function lohntabelle(d) {
  const wb = await neueMappe();
  const ws = wb.addWorksheet(String(d.jahr));
  ws.addRow([d.jahr, 'PT Nusantara Indonesia Asri']).font = fett;
  ws.addRow(['', 'PAYROLL SALARY']).font = fett;
  ws.addRow([]);
  const h1 = ['NO', 'NAME', 'ID NUMBER', 'STATUS', 'SEX', 'ADDRESS'];
  const h2 = ['', '', '', '', '', ''];
  for (let m = 0; m < 12; m++) { h1.push(MONAT_ID[m], '', '', ''); h2.push('BASIC SALARY', 'BPJS KES', 'BPJS TK', 'TOTAL'); }
  const r1 = ws.addRow(h1); const r2 = ws.addRow(h2);
  for (let c = 1; c <= 6; c++) ws.mergeCells(r1.number, c, r2.number, c);
  for (let m = 0; m < 12; m++) ws.mergeCells(r1.number, 7 + m * 4, r1.number, 10 + m * 4);
  kopfzeile(r1); kopfzeile(r2);

  const jahrVon = new Date(d.jahr, 0, 1); const bisMonat = new Date(d.jahr, d.monat, 0);
  const imJahr = d.mitarbeiter.filter((m) => (!m.eintritt || new Date(m.eintritt) <= bisMonat) && (!m.austritt || new Date(m.austritt) >= jahrVon));
  const summen = Array(48).fill(0);
  imJahr.forEach((m, i) => {
    const werte = [];
    for (let mon = 1; mon <= 12; mon++) {
      const w = mon <= d.monat ? d.lohn.find((l) => l.mitarbeiter_id === m.id && l.monat === mon) : null;
      const v = w ? [Number(w.basic) || null, Number(w.bpjs_kes) || null, Number(w.bpjs_tk) || null, Number(w.total) || null] : [null, null, null, null];
      v.forEach((x, k) => { summen[(mon - 1) * 4 + k] += x || 0; });
      werte.push(...v);
    }
    const row = ws.addRow([i + 1, m.name, m.id_nummer || '', m.status || '', m.geschlecht || '', m.adresse || '', ...werte]);
    row.eachCell((c) => { c.border = rahmen; });
  });
  const sumRow = ws.addRow(['', 'TOTAL', '', '', '', '', ...summen.map((s, i) => (Math.floor(i / 4) < d.monat ? s : null))]);
  sumRow.font = fett; sumRow.eachCell((c) => { c.border = rahmen; });
  for (let c = 7; c <= 54; c++) ws.getColumn(c).numFmt = NUM;
  ws.getColumn(2).width = 30; ws.getColumn(3).width = 22; ws.getColumn(6).width = 16;
  for (let c = 7; c <= 54; c++) ws.getColumn(c).width = 13;
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: r2.number }];

  ws.addRow([]);
  [['STATUS'], [1, 'SINGLE', '(S)'], [2, 'MARRIED'], [3, 'K/0', 'MARRIED NO CHILDREN'], [4, 'K/1', 'MARRIED 1 CHILD'], [5, 'K/2', 'MARRIED 2 CHILD'], [6, 'K/3', 'MARRIED 3 CHILD'], ['SEX'], [1, 'MALE (M)'], [2, 'FEMALE (F)']]
    .forEach((r) => ws.addRow(['', ...r]));
  return alsDatei(wb, `Payroll_${d.g.tag}.xlsx`);
}

// ---------- 2. Income Hotel (Format wie "Income rooms.xlsx") ----------
async function incomeHotel(d) {
  const wb = await neueMappe();
  const ws = wb.addWorksheet(`Income Hotel ${d.g.tag}`);
  ws.addRow([`Income Hotel — ${d.g.label}`]).font = { bold: true, size: 13 };
  ws.addRow(['Quelle: Kassenterminal (Zimmerbuchungen), Zahlungsstatus aus Zahlungsabgleich']).font = { italic: true, size: 9 };
  ws.addRow([]);
  const h = ws.addRow(['Tanggal', 'Tanggal Masuk', 'Tanggal Keluar', 'Joglo', 'Nama Tamu', 'Malam', 'Jenis', 'Jumlah Pembayaran', 'Jenis Pembayaran', 'Diterima (Bank/Kas)', 'Status']);
  kopfzeile(h);
  let sum = 0; let sumDiterima = 0;
  d.zimmer.forEach((z) => {
    const betrag = Math.round(Number(z.amount_k) * 1000);
    const a = d.abgleichByHc[z.id];
    const diterima = a && a.match_status === 'matched' ? Number(a.netto) || null : null;
    sum += betrag; sumDiterima += diterima || 0;
    const jenis = ['booking', 'agoda'].includes(String(z.payment_method).toLowerCase()) ? zahlartText(z.payment_method) : 'Direct';
    const row = ws.addRow([tglID(z.checkin_date), tglID(z.checkin_date), tglID(z.checkout_date), d.roomName[z.room_id] || '', z.guest_name, z.nights || '',
      jenis, betrag, tunai(z.payment_method) + (jenis === 'Direct' ? '' : ` (by ${jenis})`), diterima, a ? (a.match_status === 'matched' ? 'diterima' : 'belum diterima') : '']);
    row.eachCell((c) => { c.border = rahmen; });
  });
  const t = ws.addRow(['', '', '', '', '', '', 'Total', sum, '', sumDiterima || null, '']);
  t.font = fett;
  [8, 10].forEach((c) => { ws.getColumn(c).numFmt = NUM; });
  [12, 13, 13, 9, 26, 7, 12, 17, 22, 17, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  return alsDatei(wb, `Income_Hotel_${d.g.tag}.xlsx`);
}

// ---------- 3. Income Bar/Restaurant (Format wie "income restaurant 2025.xlsx") ----------
async function incomeBar(d) {
  const wb = await neueMappe();
  const ws = wb.addWorksheet(`Income Bar ${d.g.tag}`);
  ws.addRow([`Income Bar & Restaurant — ${d.g.label}`]).font = { bold: true, size: 13 };
  ws.addRow(['Quelle: Kassenterminal (bezahlte Rechnungen)']).font = { italic: true, size: 9 };
  ws.addRow([]);
  const h = ws.addRow(['Tanggal', 'No. Bill', 'Kategori', 'Jumlah', 'Diskon %', 'Pembayaran']);
  kopfzeile(h);
  let sumT = 0; let sumNT = 0;
  d.bar.forEach((s) => {
    const betrag = Math.round(Number(s.total_k) * 1000);
    if (tunai(s.payment_method) === 'Tunai') sumT += betrag; else sumNT += betrag;
    const kat = { restaurant: 'Restaurant/Bar', minibar: 'Minibar', bar: 'Bar' }[s.revenue_category] || s.revenue_category;
    const row = ws.addRow([tglID(lokalDatum(s.created_at)), s.order_id ? `#${s.order_id}` : `S${s.id}`, kat, betrag, s.discount_percent || null, tunai(s.payment_method)]);
    row.eachCell((c) => { c.border = rahmen; });
  });
  ws.addRow(['', '', 'Total Tunai', sumT]).font = fett;
  ws.addRow(['', '', 'Total Non Tunai', sumNT]).font = fett;
  ws.addRow(['', '', 'Total', sumT + sumNT]).font = fett;
  ws.getColumn(4).numFmt = NUM;
  [12, 10, 16, 14, 10, 13].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  return alsDatei(wb, `Income_Bar_${d.g.tag}.xlsx`);
}

export const baueDateien = (d) => Promise.all([lohntabelle(d), incomeHotel(d), incomeBar(d)]);

export async function erstelleBericht(jahr, monat) {
  const d = await ladeBerichtsdaten(jahr, monat);
  const files = await baueDateien(d);
  const lohnSumme = d.lohn.filter((l) => l.monat === monat).reduce((s, l) => s + Number(l.total || 0), 0);
  const info = {
    lohn: { anzahl: d.lohn.filter((l) => l.monat === monat).length, summe: lohnSumme },
    hotel: { anzahl: d.zimmer.length, summe: d.zimmer.reduce((s, z) => s + Math.round(Number(z.amount_k) * 1000), 0), offen: d.zimmer.filter((z) => d.abgleichByHc[z.id]?.match_status !== 'matched').length },
    bar: { anzahl: d.bar.length, summe: d.bar.reduce((s, b) => s + Math.round(Number(b.total_k) * 1000), 0) },
  };
  return { files, info, label: d.g.label, bis: d.g.bis };
}
