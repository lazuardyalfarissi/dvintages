import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// GET /api/orders — admin only
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const [orders] = await pool.execute(
      "SELECT id, customer_name, customer_contact, total_price, order_status, created_at FROM orders ORDER BY created_at DESC"
    );

    // Ambil order_items untuk setiap pesanan
    const ordersWithItems = await Promise.all(
      (orders as any[]).map(async (order) => {
        const [items] = await pool.execute(
          `SELECT oi.quantity, p.name AS product_name
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`,
          [order.id]
        );
        return {
          ...order,
          total_price: Number(order.total_price),
          order_items: items,
        };
      })
    );

    return NextResponse.json({ success: true, data: ordersWithItems });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/orders — buat pesanan baru (public)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product_id, customer_name, customer_contact } = body;

    if (!product_id || !customer_name || !customer_contact) {
      return NextResponse.json(
        { success: false, message: "Data pesanan tidak lengkap" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // Cek stok produk
      const [rows] = await conn.execute(
        "SELECT id, name, price, inventory FROM products WHERE id = ? AND inventory > 0 FOR UPDATE",
        [product_id]
      );
      const product = (rows as any[])[0];
      if (!product) {
        await conn.rollback();
        conn.release();
        return NextResponse.json(
          { success: false, message: "Stok produk habis atau tidak ditemukan" },
          { status: 400 }
        );
      }

      // Buat pesanan
      const [orderResult] = await conn.execute(
        "INSERT INTO orders (customer_name, customer_contact, total_price, order_status, created_at) VALUES (?, ?, ?, 'Pending', NOW())",
        [customer_name, customer_contact, product.price]
      );
      const orderId = (orderResult as any).insertId;

      // Tambah order item
      await conn.execute(
        "INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase) VALUES (?, ?, ?, 1, ?)",
        [orderId, product_id, product.name, product.price]
      );

      // Ambil nomor WA admin
      const [settingRows] = await conn.execute(
        "SELECT setting_value FROM settings WHERE setting_key = 'whatsapp_number'",
        []
      );
      const waNumber = (settingRows as any[])[0]?.setting_value || "";

      await conn.commit();
      conn.release();

      return NextResponse.json({
        success: true,
        message: "Pesanan berhasil dibuat",
        data: { orderId, productName: product.name, waNumber },
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
