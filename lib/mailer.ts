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

export interface OrderEmailData {
  orderId: number;
  customerName: string;
  customerEmail: string;
  customerContact: string;
  customerAddress: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  shippingCost: number;
  shippingCourier: string;
  shippingService: string;
  shippingDestination: string;
  shippingEtd: string;
  paymentMethod: "wa_manual" | "pakasir";
  grandTotal: number;
}

function formatRp(amount: number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(amount)}`;
}

function buildItemRows(items: OrderEmailData["items"]) {
  return items
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;">${i.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:center;">${i.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:right;">${formatRp(i.price)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;text-align:right;">${formatRp(i.price * i.quantity)}</td>
        </tr>`
    )
    .join("");
}

function buildEmailHtml(d: OrderEmailData) {
  const paymentLabel =
    d.paymentMethod === "wa_manual"
      ? "Transfer Manual (konfirmasi WhatsApp)"
      : "QRIS / Virtual Account (Pakasir)";

  return `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#667eea,#764ba2);padding:32px;text-align:center;">
            <h1 style="margin:0;font-size:28px;letter-spacing:4px;color:#fff;">DVINTAGES</h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Konfirmasi Pesanan</p>
          </td>
        </tr>

        <!-- Order ID Banner -->
        <tr>
          <td style="background:#111;padding:16px 32px;text-align:center;border-bottom:1px solid #2a2a2a;">
            <span style="font-size:13px;color:#aaa;">Nomor Pesanan</span>
            <h2 style="margin:4px 0 0;font-size:24px;color:#667eea;letter-spacing:2px;">#${d.orderId}</h2>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px;">

          <!-- Greeting -->
          <p style="margin:0 0 24px;font-size:15px;color:#ccc;">
            Halo <strong style="color:#f0f0f0;">${d.customerName}</strong>, terima kasih sudah berbelanja di DVINTAGES! 🎉<br>
            Pesanan kamu sudah kami terima dan sedang diproses.
          </p>

          <!-- Info pelanggan -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr><td colspan="2" style="padding:12px 16px;background:#1e1e1e;font-size:12px;font-weight:700;letter-spacing:1px;color:#667eea;text-transform:uppercase;">Info Pelanggan</td></tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:#aaa;width:40%;">Nama</td>
              <td style="padding:10px 16px;font-size:13px;color:#f0f0f0;">${d.customerName}</td>
            </tr>
            <tr style="background:#0f0f0f;">
              <td style="padding:10px 16px;font-size:13px;color:#aaa;">Email</td>
              <td style="padding:10px 16px;font-size:13px;color:#f0f0f0;">${d.customerEmail}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:#aaa;">WhatsApp</td>
              <td style="padding:10px 16px;font-size:13px;color:#f0f0f0;">${d.customerContact}</td>
            </tr>
            <tr style="background:#0f0f0f;">
              <td style="padding:10px 16px;font-size:13px;color:#aaa;vertical-align:top;">Alamat</td>
              <td style="padding:10px 16px;font-size:13px;color:#f0f0f0;">${d.customerAddress}</td>
            </tr>
          </table>

          <!-- Produk -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr><td colspan="4" style="padding:12px 16px;background:#1e1e1e;font-size:12px;font-weight:700;letter-spacing:1px;color:#667eea;text-transform:uppercase;">Produk Dipesan</td></tr>
            <tr style="background:#0f0f0f;">
              <th style="padding:8px 12px;font-size:12px;color:#aaa;text-align:left;">Produk</th>
              <th style="padding:8px 12px;font-size:12px;color:#aaa;text-align:center;">Qty</th>
              <th style="padding:8px 12px;font-size:12px;color:#aaa;text-align:right;">Harga</th>
              <th style="padding:8px 12px;font-size:12px;color:#aaa;text-align:right;">Subtotal</th>
            </tr>
            ${buildItemRows(d.items)}
          </table>

          <!-- Pengiriman -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr><td colspan="2" style="padding:12px 16px;background:#1e1e1e;font-size:12px;font-weight:700;letter-spacing:1px;color:#667eea;text-transform:uppercase;">Info Pengiriman</td></tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:#aaa;width:40%;">Tujuan</td>
              <td style="padding:10px 16px;font-size:13px;color:#f0f0f0;">${d.shippingDestination}</td>
            </tr>
            <tr style="background:#0f0f0f;">
              <td style="padding:10px 16px;font-size:13px;color:#aaa;">Kurir</td>
              <td style="padding:10px 16px;font-size:13px;color:#f0f0f0;">${d.shippingCourier} - ${d.shippingService}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:#aaa;">Estimasi</td>
              <td style="padding:10px 16px;font-size:13px;color:#48bb78;">${d.shippingEtd}${!/hari|day/i.test(d.shippingEtd) ? " hari" : ""}</td>
            </tr>
          </table>

          <!-- Ringkasan biaya -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr><td colspan="2" style="padding:12px 16px;background:#1e1e1e;font-size:12px;font-weight:700;letter-spacing:1px;color:#667eea;text-transform:uppercase;">Ringkasan Biaya</td></tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:#aaa;">Subtotal produk</td>
              <td style="padding:10px 16px;font-size:13px;color:#f0f0f0;text-align:right;">${formatRp(d.subtotal)}</td>
            </tr>
            <tr style="background:#0f0f0f;">
              <td style="padding:10px 16px;font-size:13px;color:#aaa;">Ongkos kirim</td>
              <td style="padding:10px 16px;font-size:13px;color:#f0f0f0;text-align:right;">${formatRp(d.shippingCost)}</td>
            </tr>
            <tr style="border-top:1px solid #2a2a2a;">
              <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#f0f0f0;">Total</td>
              <td style="padding:14px 16px;font-size:16px;font-weight:700;color:#667eea;text-align:right;">${formatRp(d.grandTotal)}</td>
            </tr>
          </table>

          <!-- Metode pembayaran -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:10px;overflow:hidden;margin-bottom:32px;">
            <tr><td colspan="2" style="padding:12px 16px;background:#1e1e1e;font-size:12px;font-weight:700;letter-spacing:1px;color:#667eea;text-transform:uppercase;">Metode Pembayaran</td></tr>
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:#f0f0f0;">${paymentLabel}</td>
            </tr>
          </table>

          ${
            d.paymentMethod === "wa_manual"
              ? `<div style="background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
                  <p style="margin:0 0 12px;font-size:14px;color:#ccc;">Segera konfirmasi pembayaran kamu via WhatsApp</p>
                  <a href="https://wa.me/6285774497521" style="display:inline-block;padding:10px 24px;background:#25d366;color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px;">
                    💬 Chat WhatsApp Admin
                  </a>
                </div>`
              : `<div style="background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.3);border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
                  <p style="margin:0;font-size:14px;color:#ccc;">Selesaikan pembayaran melalui QRIS / Virtual Account yang sudah dikirimkan.</p>
                </div>`
          }

        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px;text-align:center;border-top:1px solid #2a2a2a;background:#111;">
            <p style="margin:0 0 8px;font-size:13px;color:#667eea;font-weight:700;letter-spacing:2px;">DVINTAGES</p>
            <p style="margin:0 0 8px;font-size:12px;color:#555;">Bikin Gaya Lo Makin Kalcer Abiss!</p>
            <p style="margin:0;font-size:11px;color:#444;">
              Email ini dikirim otomatis, harap tidak membalas langsung.<br>
              Hubungi kami via <a href="https://wa.me/6285774497521" style="color:#667eea;text-decoration:none;">WhatsApp</a> atau
              <a href="https://instagram.com/dvintagesss" style="color:#667eea;text-decoration:none;">Instagram</a>.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPlainText(d: OrderEmailData) {
  const items = d.items
    .map((i) => `  - ${i.name} x${i.quantity} = ${formatRp(i.price * i.quantity)}`)
    .join("\n");
  return `
DVINTAGES - Konfirmasi Pesanan #${d.orderId}
=============================================

Halo ${d.customerName}, pesanan kamu sudah kami terima!

PRODUK:
${items}

PENGIRIMAN:
  Tujuan : ${d.shippingDestination}
  Kurir  : ${d.shippingCourier} - ${d.shippingService}
  Estimasi: ${d.shippingEtd}

BIAYA:
  Subtotal  : ${formatRp(d.subtotal)}
  Ongkir    : ${formatRp(d.shippingCost)}
  Total     : ${formatRp(d.grandTotal)}

PEMBAYARAN:
  ${d.paymentMethod === "wa_manual" ? "Transfer Manual - segera konfirmasi via WhatsApp: https://wa.me/6285774497521" : "QRIS / Virtual Account (Pakasir)"}

Terima kasih sudah berbelanja di DVINTAGES!
`.trim();
}

/**
 * Kirim notifikasi email ke customer DAN ke admin (EMAIL_TO).
 * Kedua email dikirim paralel.
 */
export async function sendOrderEmail(data: OrderEmailData) {
  const html = buildEmailHtml(data);
  const text = buildPlainText(data);
  const subject = `✅ Pesanan #${data.orderId} Dikonfirmasi — DVINTAGES`;

  await Promise.all([
    // Email ke customer
    transporter.sendMail({
      from: `"DVINTAGES" <${process.env.EMAIL_USER}>`,
      to: data.customerEmail,
      subject,
      html,
      text,
    }),
    // Notifikasi ke admin
    transporter.sendMail({
      from: `"DVINTAGES" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `🛒 [ORDER BARU] #${data.orderId} — ${data.customerName}`,
      html,
      text,
    }),
  ]);
}