import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import mysql from "mysql2/promise";
import { sendOrderEmail } from "@/lib/mailer";

// GET /api/orders — ambil semua pesanan (admin only)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const conn = await pool.getConnection();
    try {
      const [orders] = await conn.execute(`
        SELECT 
          o.id,
          o.customer_name,
          o.customer_contact,
          o.customer_address,
          o.total_price,
          o.payment_method,
          o.payment_status,
          o.order_status,
          o.created_at,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'product_name', oi.product_name,
              'quantity', oi.quantity
            )
          ) AS order_items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `);

      const parsed = (orders as any[]).map((o) => ({
        ...o,
        order_items:
          typeof o.order_items === "string"
            ? JSON.parse(o.order_items)
            : Array.isArray(o.order_items)
            ? o.order_items
            : [],
      }));

      conn.release();
      return NextResponse.json({ success: true, data: parsed });
    } catch (err) {
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

// POST /api/orders — buat pesanan baru (multi-item dari cart)
export async function POST(req: NextRequest) {
  let connection;
  try {
    const body = await req.json();
    const {
      items,
      customer_name,
      customer_contact,
      customer_address,
      payment_method,
      shipping_destination_id,
      shipping_destination_label,
      shipping_courier,
      shipping_service,
      shipping_cost,
      shipping_etd,
    } = body;

    if (
      !items?.length || !customer_name || !customer_contact ||
      !customer_address || !shipping_destination_id ||
      !shipping_courier || shipping_cost === undefined
    ) {
      return NextResponse.json(
        { success: false, message: "Data pesanan tidak lengkap" },
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

    await connection.beginTransaction();

    const productIds = items.map((i: any) => i.product_id);
    const [productRows]: any = await connection.execute(
      `SELECT id, name, price, inventory, status FROM products WHERE id IN (${productIds.map(() => "?").join(",")})`,
      productIds
    );

    if (productRows.length !== productIds.length) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, message: "Satu atau lebih produk tidak ditemukan" },
        { status: 404 }
      );
    }

    let itemsTotal = 0;
    const enrichedItems = items.map((item: any) => {
      const product = productRows.find((p: any) => p.id === item.product_id);
      itemsTotal += Number(product.price) * item.quantity;
      return { ...item, product };
    });

    const totalPrice = itemsTotal + Number(shipping_cost);
    const initialPaymentStatus = payment_method === "pakasir" ? "pending" : "not_required";

    // 1) Insert orders
    const [orderResult]: any = await connection.execute(
      `INSERT INTO orders
        (customer_name, customer_contact, customer_address, total_price,
         payment_method, payment_status, order_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
      [customer_name, customer_contact, customer_address, totalPrice, payment_method, initialPaymentStatus]
    );
    const orderId = orderResult.insertId;

    // 2) Insert order_items
    for (const item of enrichedItems) {
      await connection.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product.id, item.product.name, item.quantity, item.product.price]
      );
    }

    // 3) Insert order_shipping
    await connection.execute(
      `INSERT INTO order_shipping
        (order_id, destination_id, destination_label, courier, service, cost, etd, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [orderId, shipping_destination_id, shipping_destination_label,
       shipping_courier, shipping_service, shipping_cost, shipping_etd || null]
    );

    await connection.commit();

    // Ambil nomor WA admin
    const [settingRows]: any = await connection.execute(
      `SELECT setting_value FROM settings WHERE setting_key = 'whatsapp_number' LIMIT 1`
    );
    const waNumber = settingRows.length
      ? settingRows[0].setting_value.replace(/^\+/, "")
      : "";

    // Kirim email notifikasi (non-blocking)
    sendOrderEmail({
      orderId,
      customerName: customer_name,
      customerContact: customer_contact,
      customerAddress: customer_address,
      items: enrichedItems.map((i: any) => ({
        product_name: i.product.name,
        quantity: i.quantity,
        price: Number(i.product.price),
      })),
      shippingDestination: shipping_destination_label,
      shippingCourier: shipping_courier,
      shippingService: shipping_service,
      shippingCost: Number(shipping_cost),
      shippingEtd: shipping_etd || "-",
      totalPrice,
      paymentMethod: payment_method,
    } as any).catch((err) => console.error("Email error:", err));

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        totalPrice,
        waNumber,
        itemCount: items.length,
      },
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    console.error("orders create error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}