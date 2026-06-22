import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/orders/track?id=123
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, message: "ID tidak ada" }, { status: 400 });

  try {
    const conn = await pool.getConnection();
    const [rows]: any = await conn.execute(`
      SELECT 
        o.id, o.customer_name, o.customer_contact, o.customer_address,
        o.total_price, o.payment_method, o.payment_status, o.order_status,
        o.created_at,
        os.courier, os.service, os.cost, os.etd, os.destination_label,
        JSON_ARRAYAGG(
          JSON_OBJECT('product_name', oi.product_name, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase)
        ) AS order_items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN order_shipping os ON os.order_id = o.id
      WHERE o.id = ?
      GROUP BY o.id
    `, [id]);
    conn.release();

    if (!rows.length) return NextResponse.json({ success: false, message: "Order tidak ditemukan" }, { status: 404 });

    const order = {
      ...rows[0],
      order_items: typeof rows[0].order_items === "string"
        ? JSON.parse(rows[0].order_items)
        : rows[0].order_items,
    };

    return NextResponse.json({ success: true, data: order });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}