import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getPakasirTransactionDetail } from "@/lib/pakasir";
import { sendPaymentConfirmedEmail } from "@/lib/email";

/**
 * POST /api/payment/webhook
 *
 * Dipanggil oleh server Pakasir saat pembayaran berhasil. Body-nya:
 * {
 *   "amount": 22000,
 *   "order_id": "240910HDE7C9",
 *   "project": "depodomain",
 *   "status": "completed",
 *   "payment_method": "qris",
 *   "completed_at": "2024-09-10T08:07:02.819+07:00"
 * }
 *
 * PENTING (sesuai docs Pakasir): jangan langsung percaya body webhook ini
 * mentah-mentah. Kita cross-check ke Transaction Detail API supaya lebih
 * valid sebelum menandai order sebagai 'paid'.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, amount, status } = body;

    if (!order_id || amount === undefined || !status) {
      // Tetap balas 200 supaya Pakasir tidak retry terus untuk payload aneh,
      // tapi catat sebagai invalid.
      return NextResponse.json(
        { success: false, message: "Payload webhook tidak lengkap" },
        { status: 400 }
      );
    }

    // Pastikan order ini memang ada & memang pakai metode pakasir
    const [rows] = await pool.execute(
      `SELECT id, total_price, payment_method, customer_name, customer_email
       FROM orders WHERE id = ?`,
      [order_id]
    );
    const order = (rows as any[])[0];

    if (!order || order.payment_method !== "pakasir") {
      // Order tidak ditemukan / bukan order pakasir — abaikan tapi balas 200
      // supaya tidak terus di-retry oleh Pakasir.
      return NextResponse.json({ success: true, message: "Diabaikan" });
    }

    // Validasi nominal harus cocok dengan yang tercatat di sistem kita
    if (Number(amount) !== Number(order.total_price)) {
      return NextResponse.json(
        { success: false, message: "Nominal tidak sesuai" },
        { status: 400 }
      );
    }

    // Cross-check langsung ke Pakasir (anti pemalsuan webhook)
    const detail = await getPakasirTransactionDetail({
      orderId: order_id,
      amount: Number(order.total_price),
    });

    if (detail.status === "completed") {
      // Update status di DB
      await pool.execute(
        `UPDATE order_payments SET status = 'completed', completed_at = ? WHERE order_id = ?`,
        [detail.completed_at ?? new Date(), order_id]
      );
      await pool.execute(
        `UPDATE orders SET payment_status = 'paid' WHERE id = ?`,
        [order_id]
      );

      // Kirim email konfirmasi pembayaran ke customer
      // fire-and-forget — jangan sampai gagal kirim email bikin webhook error
      sendPaymentConfirmedEmail({
        orderId: order.id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        grandTotal: Number(order.total_price),
      }).catch((err) =>
        console.error("[webhook] Gagal kirim email konfirmasi:", err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}