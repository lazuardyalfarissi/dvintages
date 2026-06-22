import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getPakasirTransactionDetail } from "@/lib/pakasir";

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("order_id");
    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "order_id wajib diisi" },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      `SELECT op.order_id, op.pakasir_order_id, op.amount, op.total_payment,
              op.status AS local_status, op.expired_at,
              o.payment_status AS order_payment_status
       FROM order_payments op
       JOIN orders o ON o.id = op.order_id
       WHERE op.order_id = ?`,
      [orderId]
    );
    const payment = (rows as any[])[0];

    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Transaksi pembayaran tidak ditemukan" },
        { status: 404 }
      );
    }

    if (
      payment.local_status === "completed" ||
      payment.local_status === "expired" ||
      payment.local_status === "cancelled"
    ) {
      return NextResponse.json({
        success: true,
        data: { status: payment.local_status },
      });
    }

    // amount (sebelum fee) — harus sama dengan yang dikirim waktu create
    const pakasirAmount = Number(payment.amount);

    let detail;
    try {
      detail = await getPakasirTransactionDetail({
        orderId: payment.pakasir_order_id,
        amount: pakasirAmount,
      });
    } catch (pakasirError: any) {
      console.error("[Pakasir] gagal cek status:", pakasirError.message, {
        orderId,
        pakasirAmount,
      });
      return NextResponse.json({
        success: true,
        data: { status: "pending" },
      });
    }

    if (detail.status === "completed") {
      await pool.execute(
        `UPDATE order_payments SET status = 'completed', completed_at = ? WHERE order_id = ?`,
        [detail.completed_at ?? new Date(), orderId]
      );
      await pool.execute(
        `UPDATE orders SET payment_status = 'paid' WHERE id = ?`,
        [orderId]
      );
      return NextResponse.json({
        success: true,
        data: { status: "completed" },
      });
    }

    if (detail.status === "expired") {
      await pool.execute(
        `UPDATE order_payments SET status = 'expired' WHERE order_id = ?`,
        [orderId]
      );
      return NextResponse.json({
        success: true,
        data: { status: "expired" },
      });
    }

    if (detail.status === "cancelled") {
      await pool.execute(
        `UPDATE order_payments SET status = 'cancelled' WHERE order_id = ?`,
        [orderId]
      );
      return NextResponse.json({
        success: true,
        data: { status: "cancelled" },
      });
    }

    return NextResponse.json({
      success: true,
      data: { status: "pending" },
    });

  } catch (error: any) {
    console.error("[/api/payment/status] error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}