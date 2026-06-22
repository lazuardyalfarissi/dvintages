// app/api/payment/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const PAKASIR_BASE = "https://app.pakasir.com/api";

const VALID_METHODS = new Set<string>([
  "qris",
  "bri_va",
  "bni_va",
  "permata_va",
  "cimb_niaga_va",
  "maybank_va",
  "atm_bersama_va",
  "artha_graha_va",
  "bnc_va",
  "sampoerna_va",
]);

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

    if (!VALID_METHODS.has(method)) {
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
    const amount = Number(order.total_price);
    const pakasirOrderId = `DV-${order.id}-${Date.now()}`;

    const pakasirRes = await fetch(`${PAKASIR_BASE}/transactioncreate/${method}`, {
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

    if (!payment_number) {
      console.error("Pakasir payment_number kosong:", pakasirData.payment);
      return NextResponse.json(
        {
          success: false,
          message:
            process.env.NODE_ENV === "development"
              ? `Sandbox: payment_number kosong untuk metode "${method}". Kemungkinan metode ini tidak didukung di sandbox — coba QRIS.`
              : "Gagal mendapatkan nomor pembayaran. Coba metode lain.",
        },
        { status: 502 }
      );
    }

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
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Hapus dulu row lama kalau ada, baru insert baru
    // Ini lebih aman daripada ON DUPLICATE KEY UPDATE untuk kasus ganti channel
    await connection.execute(
      `DELETE FROM order_payments WHERE order_id = ?`,
      [order.id]
    );

    await connection.execute(
      `INSERT INTO order_payments
        (order_id, pakasir_order_id, project_slug, payment_method, amount, fee,
         total_payment, payment_number, status, expired_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
      [
        order.id,
        pakasirOrderId,
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
        baseAmount: amount,
        totalPayment: finalTotalPayment,
        expiredAt: expiredAt.toISOString(),
      },
    });

  } catch (err: any) {
    console.error("payment/create error:", err.message);
    console.error("Error code:", err.code);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}