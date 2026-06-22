// lib/email.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderEmailData {
  orderId: number;
  customerName: string;
  customerEmail: string;
  customerContact: string;
  customerAddress: string;
  items: { name: string; quantity: number; price: number; imageUrl?: string }[];
  subtotal: number;
  shippingCost: number;
  shippingCourier: string;
  shippingService: string;
  shippingDestination: string;
  shippingEtd: string;
  paymentMethod: "wa_manual" | "pakasir";
  grandTotal: number;
  pakasirInstructions?: {
    channel: string;
    totalPayment: number;
    fee: number;
    expiredAt: string;
  };
}

export interface PaymentConfirmedEmailData {
  orderId: number;
  customerName: string;
  customerEmail: string;
  grandTotal: number; // total yang sudah dibayar (termasuk fee)
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand palette — mirrors the dark/monochrome theme used on the storefront
// (CSS variables: --bg-color, --card-bg, --primary-color, --text-color, etc.)
// Hardcoded hex is used instead of CSS vars since most email clients strip
// <style>/:root custom properties.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: "#0a0a0a",          // --bg-color
  card: "#141414",        // --card-bg
  section: "#111111",     // section/table background
  sectionAlt: "#0d0d0d",  // alternating row background
  headerBg: "#0a0a0a",    // header / nav background
  border: "#1f1f1f",      // --border-color (solid approximation)
  borderStrong: "#2e2e2e",// --border-color-strong
  text: "#f0f0f0",        // --text-color
  textSecondary: "#b0b0b0", // --text-color-secondary
  textSubtle: "#666666",  // --text-color-subtle
  primary: "#e0e0e0",     // --primary-color (accent — light grey, not purple)
  primaryLight: "#ffffff",// --primary-color-light
  onPrimary: "#0a0a0a",   // --text-on-primary
  whatsapp: "#25d366",    // --social-whatsapp
  warning: "#fc8181",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_URL = process.env.EMAIL_LOGO_URL || "";
const FALLBACK_IMG = `https://placehold.co/56x56/141414/e0e0e0?text=DV`;

function formatRp(amount: number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(amount)}`;
}

function formatExpiry(isoString: string) {
  return new Date(isoString).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";
}

function buildBrandHeader() {
  return `
    <td style="background:${C.headerBg};padding:30px 32px;text-align:center;border-bottom:1px solid ${C.border};">
      ${
        LOGO_URL
          ? `<img src="${LOGO_URL}" alt="DVINTAGES" height="38" style="height:38px;display:inline-block;border:0;" />`
          : `<h1 style="margin:0;font-family:'Montserrat',Arial,sans-serif;font-size:22px;font-weight:300;letter-spacing:8px;color:${C.text};text-transform:uppercase;">DVINTAGES</h1>`
      }
    </td>`;
}

function buildItemRows(items: OrderEmailData["items"]) {
  return items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid ${C.border};">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:48px;padding-right:12px;vertical-align:middle;">
                <img src="${i.imageUrl || FALLBACK_IMG}" width="48" height="48"
                     style="width:48px;height:48px;border-radius:8px;object-fit:cover;display:block;border:1px solid ${C.border};" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:13px;color:${C.text};font-weight:600;">${i.name}</div>
                <div style="font-size:12px;color:${C.textSubtle};margin-top:2px;">Qty ${i.quantity} &times; ${formatRp(i.price)}</div>
              </td>
            </tr></table>
          </td>
          <td style="padding:10px 16px;border-bottom:1px solid ${C.border};text-align:right;vertical-align:middle;">
            <span style="font-size:13px;font-weight:700;color:${C.primary};">${formatRp(i.price * i.quantity)}</span>
          </td>
        </tr>`
    )
    .join("");
}

function buildSectionHeader(label: string) {
  return `<tr><td colspan="2" style="padding:12px 16px;background:#1a1a1a;font-size:12px;font-weight:700;letter-spacing:1.5px;color:${C.primary};text-transform:uppercase;">${label}</td></tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email 1: Order Diterima (dikirim langsung setelah order/payment dibuat)
// ─────────────────────────────────────────────────────────────────────────────

function buildOrderEmailHtml(d: OrderEmailData) {
  const paymentLabel =
    d.paymentMethod === "wa_manual"
      ? "Transfer Manual (konfirmasi WhatsApp)"
      : "QRIS / Virtual Account (Pakasir)";

  const ctaSection =
    d.paymentMethod === "wa_manual"
      ? `<div style="background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.25);border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
          <p style="margin:0 0 12px;font-size:14px;color:${C.textSecondary};">Segera konfirmasi pembayaran kamu via WhatsApp</p>
          <a href="https://wa.me/6285774497521" style="display:inline-block;padding:10px 24px;background:${C.whatsapp};color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px;">
            💬 Chat WhatsApp Admin
          </a>
        </div>`
      : d.pakasirInstructions
      ? `<div style="background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.18);border-radius:10px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 14px;font-size:14px;color:${C.text};font-weight:700;">📋 Instruksi Pembayaran</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${C.textSubtle};width:45%;">Metode</td>
              <td style="padding:6px 0;font-size:13px;color:${C.text};font-weight:600;">${d.pakasirInstructions.channel}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${C.textSubtle};">Biaya Admin</td>
              <td style="padding:6px 0;font-size:13px;color:${C.text};">${formatRp(d.pakasirInstructions.fee)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${C.textSubtle};">Total Bayar</td>
              <td style="padding:6px 0;font-size:15px;color:${C.primary};font-weight:700;">${formatRp(d.pakasirInstructions.totalPayment)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${C.textSubtle};">Bayar Sebelum</td>
              <td style="padding:6px 0;font-size:13px;color:${C.warning};font-weight:600;">${formatExpiry(d.pakasirInstructions.expiredAt)}</td>
            </tr>
          </table>
          <p style="margin:14px 0 0;font-size:12px;color:${C.textSubtle};">
            Kembali ke halaman checkout untuk menyelesaikan pembayaran via QRIS / Virtual Account.
          </p>
        </div>`
      : `<div style="background:rgba(224,224,224,0.05);border:1px solid rgba(224,224,224,0.18);border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;color:${C.textSecondary};">Selesaikan pembayaran melalui QRIS / Virtual Account yang sudah dikirimkan.</p>
        </div>`;

  return `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:'Montserrat','Segoe UI',Arial,sans-serif;color:${C.text};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.card};border-radius:16px;overflow:hidden;border:1px solid ${C.border};">

        <!-- Header -->
        <tr>${buildBrandHeader()}</tr>

        <!-- Order ID Banner -->
        <tr>
          <td style="background:${C.section};padding:16px 32px;text-align:center;border-bottom:1px solid ${C.border};">
            <span style="font-size:12px;letter-spacing:1px;color:${C.textSubtle};text-transform:uppercase;">Nomor Pesanan</span>
            <h2 style="margin:6px 0 0;font-size:24px;font-weight:700;color:${C.primary};letter-spacing:2px;">#${d.orderId}</h2>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px;">

          <!-- Greeting -->
          <p style="margin:0 0 24px;font-size:15px;color:${C.textSecondary};">
            Halo <strong style="color:${C.text};">${d.customerName}</strong>, terima kasih sudah berbelanja di DVINTAGES! 🎉<br>
            Pesanan kamu sudah kami terima dan sedang diproses.
          </p>

          <!-- Info pelanggan -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.section};border-radius:10px;overflow:hidden;margin-bottom:24px;">
            ${buildSectionHeader("Info Pelanggan")}
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};width:40%;">Nama</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.text};">${d.customerName}</td>
            </tr>
            <tr style="background:${C.sectionAlt};">
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};">Email</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.text};">${d.customerEmail}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};">WhatsApp</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.text};">${d.customerContact}</td>
            </tr>
            <tr style="background:${C.sectionAlt};">
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};vertical-align:top;">Alamat</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.text};">${d.customerAddress}</td>
            </tr>
          </table>

          <!-- Produk -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.section};border-radius:10px;overflow:hidden;margin-bottom:24px;">
            ${buildSectionHeader("Produk Dipesan")}
            ${buildItemRows(d.items)}
          </table>

          <!-- Pengiriman -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.section};border-radius:10px;overflow:hidden;margin-bottom:24px;">
            ${buildSectionHeader("Info Pengiriman")}
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};width:40%;">Tujuan</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.text};">${d.shippingDestination}</td>
            </tr>
            <tr style="background:${C.sectionAlt};">
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};">Kurir</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.text};">${d.shippingCourier} - ${d.shippingService}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};">Estimasi</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.whatsapp};">${d.shippingEtd}${!/hari|day/i.test(d.shippingEtd) ? " hari" : ""}</td>
            </tr>
          </table>

          <!-- Ringkasan biaya -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.section};border-radius:10px;overflow:hidden;margin-bottom:24px;">
            ${buildSectionHeader("Ringkasan Biaya")}
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};">Subtotal produk</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.text};text-align:right;">${formatRp(d.subtotal)}</td>
            </tr>
            <tr style="background:${C.sectionAlt};">
              <td style="padding:10px 16px;font-size:13px;color:${C.textSubtle};">Ongkos kirim</td>
              <td style="padding:10px 16px;font-size:13px;color:${C.text};text-align:right;">${formatRp(d.shippingCost)}</td>
            </tr>
            <tr style="border-top:1px solid ${C.borderStrong};">
              <td style="padding:14px 16px;font-size:15px;font-weight:700;color:${C.text};">Total</td>
              <td style="padding:14px 16px;font-size:17px;font-weight:700;color:${C.primary};text-align:right;">${formatRp(d.grandTotal)}</td>
            </tr>
          </table>

          <!-- Metode pembayaran -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.section};border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:12px 16px;background:#1a1a1a;font-size:12px;font-weight:700;letter-spacing:1.5px;color:${C.primary};text-transform:uppercase;">Metode Pembayaran</td></tr>
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:${C.text};">${paymentLabel}</td>
            </tr>
          </table>

          <!-- CTA -->
          ${ctaSection}

        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px;text-align:center;border-top:1px solid ${C.border};background:${C.section};">
            <p style="margin:0 0 8px;font-size:13px;color:${C.primary};font-weight:700;letter-spacing:3px;text-transform:uppercase;">DVINTAGES</p>
            <p style="margin:0 0 8px;font-size:12px;color:${C.textSubtle};">Bikin Gaya Lo Makin Kalcer Abiss!</p>
            <p style="margin:0;font-size:11px;color:${C.textSubtle};">
              Email ini dikirim otomatis, harap tidak membalas langsung.<br>
              Hubungi kami via <a href="https://wa.me/6285774497521" style="color:${C.primary};text-decoration:none;">WhatsApp</a> atau
              <a href="https://instagram.com/dvintagesss" style="color:${C.primary};text-decoration:none;">Instagram</a>.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildOrderPlainText(d: OrderEmailData) {
  const items = d.items
    .map((i) => `  - ${i.name} x${i.quantity} = ${formatRp(i.price * i.quantity)}`)
    .join("\n");

  const paymentSection =
    d.paymentMethod === "wa_manual"
      ? "Transfer Manual - segera konfirmasi via WhatsApp: https://wa.me/6285774497521"
      : d.pakasirInstructions
      ? [
          `QRIS / Virtual Account (${d.pakasirInstructions.channel})`,
          `  Total Bayar : ${formatRp(d.pakasirInstructions.totalPayment)} (termasuk biaya admin ${formatRp(d.pakasirInstructions.fee)})`,
          `  Bayar Sebelum: ${formatExpiry(d.pakasirInstructions.expiredAt)}`,
          `  Kembali ke halaman checkout untuk menyelesaikan pembayaran.`,
        ].join("\n")
      : "QRIS / Virtual Account (Pakasir)";

  return `
DVINTAGES - Konfirmasi Pesanan #${d.orderId}
=============================================

Halo ${d.customerName}, pesanan kamu sudah kami terima!

PRODUK:
${items}

PENGIRIMAN:
  Tujuan   : ${d.shippingDestination}
  Kurir    : ${d.shippingCourier} - ${d.shippingService}
  Estimasi : ${d.shippingEtd}

BIAYA:
  Subtotal : ${formatRp(d.subtotal)}
  Ongkir   : ${formatRp(d.shippingCost)}
  Total    : ${formatRp(d.grandTotal)}

PEMBAYARAN:
  ${paymentSection}

Terima kasih sudah berbelanja di DVINTAGES!
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Email 2: Pembayaran Berhasil (dikirim dari webhook Pakasir)
// ─────────────────────────────────────────────────────────────────────────────

function buildPaymentConfirmedHtml(d: PaymentConfirmedEmailData) {
  return `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:'Montserrat','Segoe UI',Arial,sans-serif;color:${C.text};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.card};border-radius:16px;overflow:hidden;border:1px solid ${C.border};">

        <!-- Header -->
        <tr>
          <td style="background:${C.headerBg};padding:32px;text-align:center;border-bottom:1px solid ${C.border};">
            ${
              LOGO_URL
                ? `<img src="${LOGO_URL}" alt="DVINTAGES" height="32" style="height:32px;display:inline-block;margin-bottom:14px;border:0;" />`
                : ""
            }
            <div style="width:56px;height:56px;line-gradient:none;border-radius:50%;background:rgba(37,211,102,0.12);display:inline-block;line-height:56px;font-size:26px;margin-bottom:12px;">✅</div>
            <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:1px;color:${C.text};">Pembayaran Berhasil!</h1>
          </td>
        </tr>

        <!-- Order ID -->
        <tr>
          <td style="background:${C.section};padding:16px 32px;text-align:center;border-bottom:1px solid ${C.border};">
            <span style="font-size:12px;letter-spacing:1px;color:${C.textSubtle};text-transform:uppercase;">Nomor Pesanan</span>
            <h2 style="margin:6px 0 0;font-size:24px;font-weight:700;color:${C.whatsapp};letter-spacing:2px;">#${d.orderId}</h2>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:40px 32px;text-align:center;">
          <p style="font-size:16px;color:${C.textSecondary};margin:0 0 12px;">
            Halo <strong style="color:${C.text};">${d.customerName}</strong>! 🎉
          </p>
          <p style="font-size:14px;color:${C.textSubtle};margin:0 0 24px;">
            Pembayaran sebesar
            <strong style="color:${C.whatsapp};font-size:19px;display:block;margin-top:8px;">${formatRp(d.grandTotal)}</strong>
            sudah kami terima.
          </p>
          <div style="background:${C.section};border-radius:10px;padding:16px;border:1px solid ${C.border};text-align:left;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:${C.textSecondary};">
              🚚 Pesanan kamu sedang kami proses dan akan segera dikirim.<br><br>
              📦 Kamu akan mendapat info resi pengiriman dari admin via WhatsApp setelah barang dikirim.
            </p>
          </div>
          <a href="https://wa.me/6285774497521" style="display:inline-block;padding:12px 28px;background:${C.whatsapp};color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px;">
            💬 Hubungi Admin
          </a>
        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px;text-align:center;border-top:1px solid ${C.border};background:${C.section};">
            <p style="margin:0 0 8px;font-size:13px;color:${C.primary};font-weight:700;letter-spacing:3px;text-transform:uppercase;">DVINTAGES</p>
            <p style="margin:0 0 8px;font-size:12px;color:${C.textSubtle};">Bikin Gaya Lo Makin Kalcer Abiss!</p>
            <p style="margin:0;font-size:11px;color:${C.textSubtle};">
              Email ini dikirim otomatis, harap tidak membalas langsung.<br>
              Hubungi kami via <a href="https://wa.me/6285774497521" style="color:${C.primary};text-decoration:none;">WhatsApp</a> atau
              <a href="https://instagram.com/dvintagesss" style="color:${C.primary};text-decoration:none;">Instagram</a>.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public functions
// ─────────────────────────────────────────────────────────────────────────────

export async function sendOrderEmail(data: OrderEmailData) {
  const html = buildOrderEmailHtml(data);
  const text = buildOrderPlainText(data);
  const subject = `✅ Pesanan #${data.orderId} Dikonfirmasi — DVINTAGES`;

  await Promise.all([
    transporter.sendMail({
      from: `"DVINTAGES" <${process.env.EMAIL_USER}>`,
      to: data.customerEmail,
      subject,
      html,
      text,
    }),
    transporter.sendMail({
      from: `"DVINTAGES" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `🛒 [ORDER BARU] #${data.orderId} — ${data.customerName}`,
      html,
      text,
    }),
  ]);
}

export async function sendPaymentConfirmedEmail(data: PaymentConfirmedEmailData) {
  const html = buildPaymentConfirmedHtml(data);
  const text = `Halo ${data.customerName}, pembayaran pesanan #${data.orderId} sebesar ${formatRp(data.grandTotal)} sudah kami terima. Pesanan sedang diproses!`;
  const subject = `💰 Pembayaran #${data.orderId} Berhasil — DVINTAGES`;

  await Promise.all([
    transporter.sendMail({
      from: `"DVINTAGES" <${process.env.EMAIL_USER}>`,
      to: data.customerEmail,
      subject,
      html,
      text,
    }),
    transporter.sendMail({
      from: `"DVINTAGES" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `💰 [LUNAS] #${data.orderId} — ${data.customerName}`,
      html,
      text,
    }),
  ]);
}