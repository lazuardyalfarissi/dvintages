// app/api/payment/create/route.ts
//
// FIX: jangan percaya mentah-mentah field `total_payment` dari Pakasir.
// Di production terbukti field ini kadang balik sama dengan `amount`
// (tidak termasuk fee), padahal `fee`-nya sendiri valid/terhitung benar
// (mis. amount 715000, fee 7150, tapi total_payment ikut 715000 — harusnya
// 722150). Daripada bug upstream ini diam-diam ngerugiin customer/toko,
// kita hitung ulang totalnya sendiri (amount + fee) dan TIDAK pernah
// trust nilai total_payment dari Pakasir untuk disimpan/ditampilkan.
// Kalau ternyata beda, kita log supaya ketahuan kalau perilaku Pakasir
// berubah lagi di kemudian hari.
//
// amount yang dikirim ke Pakasir = orders.total_price (sudah termasuk ongkir,
// belum termasuk fee — fee dihitung otomatis oleh Pakasir).

import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const PAKASIR_BASE = "https://app.pakasir.com/api";

// Sesuaikan dengan daftar PAKASIR_PAYMENT_LABELS_CLIENT di lib/pakasir-client.ts
const METHOD_ENDPOINT: Record<string, string> = {
  qris: "qris",
  bca_va: "va/bca",
  bni_va: "va/bni",
  bri_va: "va/bri",
  permata_va: "va/permata",
};

export async function POST(req: NextRequest) {
  let connection;
  try {
    const { order_id, method } = await req.json();

    if (!order_id || !method) {
      return NextResponse.json(
        { success: false, message: "order_id dan method wajib diisi" },
        { status: 400 }
      );
    }

    const endpointPath = METHOD_ENDPOINT[method];
    if (!endpointPath) {
      return NextResponse.json(
        { success: false, message: "Metode pembayaran tidak dikenali" },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [orderRows]: any = await connection.execute(
      `SELECT id, total_price, payment_status FROM orders WHERE id = ? LIMIT 1`,
      [order_id]
    );

    if (!orderRows.length) {
      return NextResponse.json(
        { success: false, message: "Pesanan tidak ditemukan" },
        { status: 404 }
      );
    }

    const order = orderRows[0];
    const amount = Number(order.total_price); // sudah termasuk ongkir

    const pakasirOrderId = `DV-${order.id}-${Date.now()}`;

    const pakasirRes = await fetch(`${PAKASIR_BASE}/transactioncreate/${endpointPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: process.env.PAKASIR_PROJECT_SLUG,
        order_id: pakasirOrderId,
        amount,
        api_key: process.env.PAKASIR_API_KEY,
      }),
    });

    const pakasirData = await pakasirRes.json();

    if (!pakasirRes.ok || !pakasirData.payment) {
      console.error("Pakasir create transaction failed:", pakasirData);
      return NextResponse.json(
        { success: false, message: pakasirData.message || "Gagal membuat transaksi pembayaran" },
        { status: 502 }
      );
    }

    const { fee, total_payment, payment_number, payment_method } = pakasirData.payment;

    // ── Hitung total_payment sendiri, jangan percaya field dari Pakasir ──
    const feeNum = Number(fee) || 0;
    const totalPaymentFromPakasir = Number(total_payment) || 0;
    const computedTotalPayment = amount + feeNum;

    if (totalPaymentFromPakasir !== computedTotalPayment) {
      console.error(
        "Pakasir total_payment mismatch — pakai hasil hitung sendiri (amount + fee).",
        JSON.stringify({
          order_id: order.id,
          amount,
          fee: feeNum,
          pakasir_total_payment: totalPaymentFromPakasir,
          computed_total_payment: computedTotalPayment,
        })
      );
    }

    const finalTotalPayment = computedTotalPayment;

    // Pakasir biasanya kasih window 24 jam; kalau response gak punya expired_at
    // eksplisit, kita set manual di sini.
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // order_payments punya UNIQUE KEY pada order_id, jadi pakai
    // INSERT ... ON DUPLICATE KEY UPDATE supaya aman kalau customer
    // ganti channel pembayaran dan create ulang.
    await connection.execute(
      `INSERT INTO order_payments
        (order_id, project_slug, payment_method, amount, fee, total_payment,
         payment_number, status, expired_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         project_slug = VALUES(project_slug),
         payment_method = VALUES(payment_method),
         amount = VALUES(amount),
         fee = VALUES(fee),
         total_payment = VALUES(total_payment),
         payment_number = VALUES(payment_number),
         status = 'pending',
         expired_at = VALUES(expired_at),
         completed_at = NULL,
         updated_at = NOW()`,
      [
        order.id,
        process.env.PAKASIR_PROJECT_SLUG,
        payment_method,
        amount,
        feeNum,
        finalTotalPayment,
        payment_number,
        expiredAt,
      ]
    );

    await connection.execute(
      `UPDATE orders SET payment_status = 'pending' WHERE id = ?`,
      [order.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        paymentNumber: payment_number,
        fee: feeNum,
        baseAmount: amount,                  // harga produk + ongkir, sebelum fee
        totalPayment: finalTotalPayment,      // baseAmount + fee, yang harus dibayar customer
        expiredAt: expiredAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("payment/create error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}