import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { createPakasirTransaction, type PakasirPaymentMethod } from "@/lib/pakasir";

const ALLOWED_METHODS: PakasirPaymentMethod[] = [
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
];

// POST /api/payment/create
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, method } = body;

    if (!order_id || !method || !ALLOWED_METHODS.includes(method)) {
      return NextResponse.json(
        { success: false, message: "order_id atau metode pembayaran tidak valid" },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      `SELECT id, total_price, payment_method, payment_status
       FROM orders WHERE id = ?`,
      [order_id]
    );
    const order = (rows as any[])[0];

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Pesanan tidak ditemukan" },
        { status: 404 }
      );
    }
    if (order.payment_method !== "pakasir") {
      return NextResponse.json(
        { success: false, message: "Pesanan ini tidak menggunakan pembayaran online" },
        { status: 400 }
      );
    }
    if (order.payment_status === "paid") {
      return NextResponse.json(
        { success: false, message: "Pesanan sudah dibayar" },
        { status: 400 }
      );
    }

    const amount = Number(order.total_price);

    const payment = await createPakasirTransaction({
      orderId: order.id,
      amount,
      method,
    });

    console.log("[Pakasir Create]", {
      orderId: order.id,
      method,
      paymentNumber: payment.payment_number,
      paymentNumberLength: payment.payment_number?.length,
      amount: payment.amount,
      fee: payment.fee,
      totalPayment: payment.total_payment,
      expiredAt: payment.expired_at,
    });

    // Simpan dengan total_payment — ini yang harus dikirim ke Pakasir waktu cek status
    await pool.execute(
      `INSERT INTO order_payments
        (order_id, project_slug, payment_method, amount, fee, total_payment,
         payment_number, status, expired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
       ON DUPLICATE KEY UPDATE
        project_slug   = VALUES(project_slug),
        payment_method = VALUES(payment_method),
        amount         = VALUES(amount),
        fee            = VALUES(fee),
        total_payment  = VALUES(total_payment),
        payment_number = VALUES(payment_number),
        status         = 'pending',
        expired_at     = VALUES(expired_at)`,
      [
        order.id,
        payment.project,
        payment.payment_method,
        payment.amount,
        payment.fee,
        payment.total_payment,
        payment.payment_number,
        payment.expired_at,
      ]
    );

    await pool.execute(
      `UPDATE orders SET payment_status = 'pending' WHERE id = ?`,
      [order.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        paymentMethod: payment.payment_method,
        paymentNumber: payment.payment_number,
        amount: payment.amount,
        fee: payment.fee,
        totalPayment: payment.total_payment,
        expiredAt: payment.expired_at,
      },
    });
  } catch (error: any) {
    console.error("[/api/payment/create] error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}