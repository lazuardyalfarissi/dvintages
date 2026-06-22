import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/orders/my-orders?contact=08xxx
export async function GET(req: NextRequest) {
  const contact = req.nextUrl.searchParams.get("contact");

  if (!contact || contact.trim().length < 5)
    return NextResponse.json({ success: false, message: "Masukkan nomor WhatsApp yang valid" }, { status: 400 });

  // Normalisasi nomor: trim whitespace, hapus karakter non-digit kecuali +
  const normalized = contact.trim().replace(/\s/g, "");

  try {
    const conn = await pool.getConnection();
    const [rows]: any = await conn.execute(
      `SELECT 
        o.id,
        o.customer_name,
        o.total_price,
        o.payment_method,
        o.payment_status,
        o.order_status,
        o.created_at,
        os.courier,
        os.service,
        os.destination_label,
        os.cost AS shipping_cost,
        os.etd
      FROM orders o
      LEFT JOIN order_shipping os ON os.order_id = o.id
      WHERE o.customer_contact = ?
      ORDER BY o.created_at DESC
      LIMIT 20`,
      [normalized]
    );
    conn.release();

    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}