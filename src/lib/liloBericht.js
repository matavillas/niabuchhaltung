// Monatsbericht für Lilo (Steuerberater), Indonesisch:
// Pembukuan (Buku Kas, Kas Kecil Manager, Buku Bank, Daftar Akun), Payroll, Income Hotel, Income Bar — als Excel.
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

  const kbOrder = (b) => b.order('datum').order('sortierung', { ascending: true, nullsFirst: true }).order('created_at').order('id');
  const [mitarbeiter, lohn, zimmer, rooms, abgleich, bar, kas, kasVor, pc, pcVor, bank, akun] = await Promise.all([
    q(supabase.from('lohn_mitarbeiter').select('*').order('sortierung').order('id')),
    q(supabase.from('lohn_monat').select('*').eq('jahr', jahr)),
    q(supabase.from('hotel_charges').select('*').gte('checkin_date', g.von).lte('checkin_date', g.bis).order('checkin_date').order('id')),
    q(supabase.from('rooms').select('id,name')),
    q(supabase.from('kartenumsaetze').select('hotel_charge_id,netto,match_status,match_info').not('hotel_charge_id', 'is', null)),
    q(supabase.from('sales').select('*').in('revenue_category', ['restaurant', 'minibar', 'bar']).gte('created_at', tsVon).lte('created_at', tsBis).order('created_at')),
    q(kbOrder(supabase.from('kassenbuch').select('*').gte('datum', g.von).lte('datum', g.bis))),
    q(supabase.from('kassenbuch').select('saldo').lt('datum', g.von).order('datum', { ascending: false })
      .order('sortierung', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1)),
    q(supabase.from('petit_cash_adit').select('*').gte('datum', g.von).lte('datum', g.bis).order('datum').order('created_at')),
    q(supabase.from('petit_cash_adit').select('saldo').lt('datum', g.von).order('datum', { ascending: false }).order('created_at', { ascending: false }).limit(1)),
    q(supabase.from('bankbuch').select('*').neq('konto_nr', 'WISE-RK').gte('datum', g.von).lte('datum', g.bis).order('konto_nr').order('datum').order('created_at')),
    q(supabase.from('kontenplan').select('code,name,name_id')),
  ]);

  const roomName = Object.fromEntries(rooms.map((r) => [r.id, r.name]));
  const abgleichByHc = Object.fromEntries(abgleich.map((a) => [a.hotel_charge_id, a]));
  const akunName = Object.fromEntries(akun.map((a) => [a.code, a.name_id || a.name]));
  return {
    jahr, monat, g, mitarbeiter, lohn, zimmer, roomName, abgleichByHc, bar,
    kas, kasAwal: kasVor[0] ? Number(kasVor[0].saldo) : 0, pc, pcAwal: pcVor[0] ? Number(pcVor[0].saldo) : 0, bank, akunName,
  };
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


// ---------- 0. Pembukuan (wie die Übergabe Januar–April 2026) ----------
const STATUS_LEGENDE = [
  ['✅', 'Bukti sudah diperiksa secara visual dan dikonfirmasi sesuai'],
  ['✔️', 'Pengecualian tanpa bukti (pendapatan usaha, biaya bank, setoran pribadi, uang muka/kasbon) — bukti tidak diperlukan'],
  ['📷', 'Bukti sudah ada, tetapi belum diperiksa secara visual final'],
  ['⚠️', 'Belum selesai — bukti belum ada, jumlah tidak sesuai, atau kategori akun belum jelas'],
];
const KOPF_BLAU = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
const MONAT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
const urlsOf = (r) => (Array.isArray(r.drive_urls) ? r.drive_urls : []).filter(Boolean);
const tglPunkt = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

function blatt(wb, name, headers, widths) {
  const ws = wb.addWorksheet(name);
  const h = ws.addRow(headers);
  h.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = KOPF_BLAU; c.border = rahmen; c.alignment = { vertical: 'middle', wrapText: true }; });
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return ws;
}
function bukti(cell, urls) {
  if (!urls.length) return;
  cell.value = urls.length === 1 ? { text: urls[0], hyperlink: urls[0] } : urls.join('\n');
  cell.font = { size: 8, color: { argb: 'FF0563C1' }, underline: urls.length === 1 };
}
function datenZeile(ws, werte, urlSpalte, urls) {
  const row = ws.addRow(werte);
  row.eachCell({ includeEmpty: true }, (c) => { c.border = rahmen; c.alignment = { vertical: 'top', wrapText: true }; });
  if (urlSpalte) bukti(row.getCell(urlSpalte), urls);
  return row;
}
function saldoZeile(ws, text, saldoSpalte, saldo, breite) {
  const werte = Array(breite).fill(null); werte[1] = text; werte[saldoSpalte - 1] = saldo;
  const row = ws.addRow(werte);
  row.font = fett;
  for (let c = 1; c <= breite; c++) { row.getCell(c).fill = MONAT_FILL; row.getCell(c).border = rahmen; }
  row.getCell(saldoSpalte).numFmt = NUM;
}

async function pembukuan(d) {
  const wb = await neueMappe();
  const ohneId = { kas: 0, bank: 0 };
  const ket = (r, de) => { if (r.beschreibung_id) return r.beschreibung_id; return de || ''; };
  const cat = (r) => r.notiz_id || r.notiz || '';
  const bulan = MONAT_ID[d.monat - 1];

  // Ringkasan (zuerst angelegt, am Ende befüllt)
  const ws0 = wb.addWorksheet('Ringkasan');

  // Buku Kas
  const k = blatt(wb, 'Buku Kas', ['Tanggal', 'Keterangan', 'Kode Akun', 'Nama Akun', 'Pemasukan', 'Pengeluaran', 'Saldo', 'Status', 'Catatan', 'Bukti (Tautan Drive)'],
    [12, 40, 10, 30, 14, 14, 14, 8, 46, 45]);
  saldoZeile(k, `SALDO AWAL ${bulan}`, 7, d.kasAwal, 10);
  let kasIn = 0; let kasOut = 0; let kasSaldo = d.kasAwal;
  d.kas.forEach((r) => {
    if (!r.beschreibung_id) ohneId.kas++;
    kasIn += Number(r.einnahme) || 0; kasOut += Number(r.ausgabe) || 0;
    if (r.saldo !== null && r.saldo !== undefined) kasSaldo = Number(r.saldo);
    datenZeile(k, [tglPunkt(r.datum), ket(r, r.beschreibung), r.konto || '', d.akunName[r.konto] || r.konto_name || '',
      Number(r.einnahme) || null, Number(r.ausgabe) || null, null, r.status || '', cat(r), null], 10, urlsOf(r));
  });
  const kt = k.addRow(['', 'JUMLAH', '', '', kasIn, kasOut]); kt.font = fett;
  saldoZeile(k, `SALDO AKHIR ${bulan}`, 7, kasSaldo, 10);
  [5, 6, 7].forEach((c) => { k.getColumn(c).numFmt = NUM; });

  // Kas Kecil Manager (Petit Cash)
  const p = blatt(wb, 'Kas Kecil Manager', ['Tanggal', 'Keterangan', 'Kode Akun', 'Nama Akun', 'Pemasukan', 'Pengeluaran', 'Saldo', 'Status', 'Catatan', 'Bukti (Tautan Drive)'],
    [12, 40, 10, 30, 14, 14, 14, 8, 46, 45]);
  saldoZeile(p, `SALDO AWAL ${bulan}`, 7, d.pcAwal, 10);
  let pcIn = 0; let pcOut = 0; let pcSaldo = d.pcAwal;
  d.pc.forEach((r) => {
    if (!r.beschreibung_id) ohneId.kas++;
    pcIn += Number(r.einnahme) || 0; pcOut += Number(r.ausgabe) || 0;
    if (r.saldo !== null && r.saldo !== undefined) pcSaldo = Number(r.saldo);
    datenZeile(p, [tglPunkt(r.datum), ket(r, r.beschreibung), r.konto || '', d.akunName[r.konto] || '',
      Number(r.einnahme) || null, Number(r.ausgabe) || null, null, r.status || '', cat(r), null], 10, urlsOf(r));
  });
  const pt = p.addRow(['', 'JUMLAH', '', '', pcIn, pcOut]); pt.font = fett;
  saldoZeile(p, `SALDO AKHIR ${bulan}`, 7, pcSaldo, 10);
  [5, 6, 7].forEach((c) => { p.getColumn(c).numFmt = NUM; });

  // Buku Bank
  const b = blatt(wb, 'Buku Bank', ['Tanggal', 'Rekening', 'Keterangan', 'Teks Bank', 'Kode Akun', 'Nama Akun', 'Debit', 'Kredit', 'Saldo', 'Status', 'Catatan', 'Bukti (Tautan Drive)'],
    [12, 18, 40, 30, 10, 30, 14, 14, 15, 8, 46, 45]);
  const proKonto = {};
  d.bank.forEach((r) => {
    if (!r.beschreibung_id) ohneId.bank++;
    const kk = r.konto_nr;
    proKonto[kk] = proKonto[kk] || { name: r.konto || kk, debit: 0, kredit: 0, n: 0 };
    proKonto[kk].debit += Number(r.debit) || 0; proKonto[kk].kredit += Number(r.credit) || 0; proKonto[kk].n++;
    datenZeile(b, [tglPunkt(r.datum), r.konto || kk, ket(r, r.buchungstext), r.remarks || '', r.konto_neu || '', d.akunName[r.konto_neu] || '',
      Number(r.debit) || null, Number(r.credit) || null, r.saldo !== null && r.saldo !== undefined ? Number(r.saldo) : null, r.status || '', cat(r), null], 12, urlsOf(r));
  });
  [7, 8, 9].forEach((c) => { b.getColumn(c).numFmt = NUM; });
  b.autoFilter = { from: 'A1', to: 'L1' };
  k.autoFilter = { from: 'A1', to: 'J1' };

  // Daftar Akun (nur verwendete Konten)
  const codes = new Set([...d.kas.map((r) => r.konto), ...d.pc.map((r) => r.konto), ...d.bank.map((r) => r.konto_neu)].filter(Boolean));
  const a = blatt(wb, 'Daftar Akun', ['Kode Akun', 'Nama Akun'], [12, 60]);
  [...codes].sort((x, y) => String(x).localeCompare(String(y), 'de', { numeric: true }))
    .forEach((c) => datenZeile(a, [c, d.akunName[c] || '(belum ada di daftar akun)'], null, []));

  // Ringkasan befüllen
  ws0.getColumn(1).width = 34; ws0.getColumn(2).width = 70;
  const t = ws0.addRow([`Mata Villas — Pembukuan ${bulan.charAt(0) + bulan.slice(1).toLowerCase()} ${d.jahr}`]);
  t.font = { bold: true, size: 14 };
  ws0.addRow([]);
  const info = [
    ['Periode', `${tglPunkt(d.g.von)} – ${tglPunkt(d.g.bis)}`],
    ['Dibuat tanggal', tglPunkt(new Date().toISOString().slice(0, 10))],
    ['Jumlah transaksi Buku Kas', d.kas.length],
    ['Jumlah transaksi Kas Kecil Manager', d.pc.length],
    ['Jumlah transaksi Buku Bank', d.bank.length],
    ['Saldo akhir Buku Kas', kasSaldo],
    ['Saldo akhir Kas Kecil Manager', pcSaldo],
    ...Object.entries(proKonto).map(([kk, v]) => [`Rekening ${v.name}`, `${v.n} transaksi · Debit ${v.debit.toLocaleString('id-ID')} · Kredit ${v.kredit.toLocaleString('id-ID')}`]),
    [],
    ['Keterangan Status'],
    ...STATUS_LEGENDE,
    [],
    ['Catatan', "Kolom 'Bukti (Tautan Drive)' berisi tautan ke bukti asli di Google Drive. Jika satu transaksi memiliki beberapa bukti, tautan ditulis berurutan ke bawah dalam satu sel. Kolom 'Teks Bank' berisi keterangan asli dari mutasi rekening."],
  ];
  info.forEach((r) => {
    const row = ws0.addRow(r);
    row.getCell(2).alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    if (typeof r[1] === 'number') row.getCell(2).numFmt = NUM;
    if (r.length === 1) row.font = fett;
  });
  return { file: await alsDatei(wb, `Pembukuan_MataVillas_${d.g.tag}.xlsx`), ohneId };
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

export async function baueDateien(d) {
  const [pemb, ...rest] = await Promise.all([pembukuan(d), lohntabelle(d), incomeHotel(d), incomeBar(d)]);
  return { files: [pemb.file, ...rest], ohneId: pemb.ohneId };
}

export async function erstelleBericht(jahr, monat) {
  const d = await ladeBerichtsdaten(jahr, monat);
  const { files, ohneId } = await baueDateien(d);
  const lohnSumme = d.lohn.filter((l) => l.monat === monat).reduce((s, l) => s + Number(l.total || 0), 0);
  const info = {
    lohn: { anzahl: d.lohn.filter((l) => l.monat === monat).length, summe: lohnSumme },
    hotel: { anzahl: d.zimmer.length, summe: d.zimmer.reduce((s, z) => s + Math.round(Number(z.amount_k) * 1000), 0), offen: d.zimmer.filter((z) => d.abgleichByHc[z.id]?.match_status !== 'matched').length },
    bar: { anzahl: d.bar.length, summe: d.bar.reduce((s, b) => s + Math.round(Number(b.total_k) * 1000), 0) },
    pembukuan: {
      kas: d.kas.length, pc: d.pc.length, bank: d.bank.length, ohneId,
      warnung: [...d.kas, ...d.pc, ...d.bank].filter((r) => String(r.status || '').includes('⚠') || (!r.konto && !r.konto_neu)).length,
      bankBis: Object.entries(d.bank.reduce((m, r) => { m[r.konto_nr] = r.datum > (m[r.konto_nr] || '') ? r.datum : m[r.konto_nr]; return m; }, {})),
    },
  };
  return { files, info, label: d.g.label, bis: d.g.bis };
}
