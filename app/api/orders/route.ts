// app/api/orders/route.ts
//
// REVISI sesuai struktur DB asli kamu:
//   - orders          : data utama pesanan, total_price = harga produk + ongkir
//   - order_items     : detail produk (FK ke orders & products)
//   - order_shipping  : detail ongkir (FK ke orders, 1-to-1 lewat uniq_order_id)
//
// total_price di tabel `orders` SUDAH TERMASUK ongkir, karena itulah yang
// nanti dikirim sebagai `amount` ke Pakasir di /api/payment/create.

import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

export async function POST(req: NextRequest) {
  let connection;
  try {
    const body = await req.json();
    const {
      product_id,
      customer_name,
      customer_contact,
      customer_address,
      payment_method, // 'wa_manual' | 'pakasir'
      shipping_destination_id,
      shipping_destination_label,
      shipping_courier,
      shipping_service,
      shipping_cost,
      shipping_etd,
    } = body;

    if (
      !product_id ||
      !customer_name ||
      !customer_contact ||
      !customer_address ||
      !shipping_destination_id ||
      !shipping_courier ||
      shipping_cost === undefined
    ) {
      return NextResponse.json(
        { success: false, message: "Data pesanan tidak lengkap, termasuk tujuan pengiriman" },
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

    const [productRows]: any = await connection.execute(
      `SELECT id, name, price, inventory, status FROM products WHERE id = ? LIMIT 1`,
      [product_id]
    );

    if (!productRows.length) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    const product = productRows[0];
    const totalPrice = Number(product.price) + Number(shipping_cost);

    // payment_status awal: 'pending' kalau pakasir (nunggu dibuatkan transaksi),
    // 'not_required' kalau wa_manual (gak lewat payment gateway sama sekali)
    const initialPaymentStatus = payment_method === "pakasir" ? "pending" : "not_required";

    // 1) Insert ke orders
    const [orderResult]: any = await connection.execute(
      `INSERT INTO orders
        (customer_name, customer_contact, customer_address, total_price,
         payment_method, payment_status, order_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
      [customer_name, customer_contact, customer_address, totalPrice, payment_method, initialPaymentStatus]
    );

    const orderId = orderResult.insertId;

    // 2) Insert ke order_items
    await connection.execute(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase)
       VALUES (?, ?, ?, 1, ?)`,
      [orderId, product.id, product.name, product.price]
    );

    // 3) Insert ke order_shipping
    await connection.execute(
      `INSERT INTO order_shipping
        (order_id, destination_id, destination_label, courier, service, cost, etd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        orderId,
        shipping_destination_id,
        shipping_destination_label,
        shipping_courier,
        shipping_service,
        shipping_cost,
        shipping_etd || null,
      ]
    );

    await connection.commit();

    // Ambil nomor WA admin dari tabel settings
    const [settingRows]: any = await connection.execute(
      `SELECT setting_value FROM settings WHERE setting_key = 'whatsapp_number' LIMIT 1`
    );
    const waNumber = settingRows.length ? settingRows[0].setting_value.replace(/^\+/, "") : "";

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        productName: product.name,
        price: Number(product.price),       // harga produk saja
        shippingCost: Number(shipping_cost), // ongkir
        totalPrice,                          // harga + ongkir (ini yang masuk ke orders.total_price)
        waNumber,
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