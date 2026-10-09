import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendOrderEmail } from "@/lib/mailer";

// GET /api/orders — ambil semua pesanan (admin only)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        `id, customer_name, customer_contact, customer_address, total_price,
         payment_method, payment_status, order_status, created_at,
         order_items ( product_name, quantity )`
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const parsed = (data ?? []).map((o: any) => ({
      ...o,
      order_items: Array.isArray(o.order_items) ? o.order_items : [],
    }));

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/orders — buat pesanan baru (multi-item dari cart)
export async function POST(req: NextRequest) {
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

    // Rapikan item: hanya product_id & quantity yang dipakai (harga diambil dari DB)
    const cleanItems = items.map((i: any) => ({
      product_id: Number(i.product_id),
      quantity: Number(i.quantity),
    }));

    if (
      cleanItems.some(
        (i: any) =>
          !Number.isInteger(i.product_id) ||
          !Number.isInteger(i.quantity) ||
          i.quantity <= 0
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Data item pesanan tidak valid" },
        { status: 400 }
      );
    }

    // Semua insert (orders, order_items, order_shipping) jalan atomik di dalam fungsi DB
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("create_order", {
      p_items: cleanItems,
      p_customer_name: customer_name,
      p_customer_contact: customer_contact,
      p_customer_address: customer_address,
      p_payment_method: payment_method,
      p_destination_id: String(shipping_destination_id),
      p_destination_label: shipping_destination_label ?? "",
      p_courier: shipping_courier,
      p_service: shipping_service ?? "",
      p_shipping_cost: Number(shipping_cost),
      p_etd: shipping_etd || null,
    });

    if (rpcError) {
      const msg = rpcError.message || "";
      if (msg.includes("PRODUCT_NOT_FOUND")) {
        return NextResponse.json(
          { success: false, message: "Satu atau lebih produk tidak ditemukan" },
          { status: 404 }
        );
      }
      if (msg.includes("INVALID_QUANTITY") || msg.includes("INVALID_ITEMS")) {
        return NextResponse.json(
          { success: false, message: "Data item pesanan tidak valid" },
          { status: 400 }
        );
      }
      throw rpcError;
    }

    const orderId: number = result.order_id;
    const totalPrice: number = Number(result.total_price);
    const orderItems: any[] = result.items ?? [];

    // Ambil nomor WA admin
    const { data: setting } = await supabaseAdmin
      .from("settings")
      .select("setting_value")
      .eq("setting_key", "whatsapp_number")
      .maybeSingle();

    const waNumber = setting?.setting_value
      ? String(setting.setting_value).replace(/^\+/, "")
      : "";

    // Kirim email notifikasi (non-blocking)
    sendOrderEmail({
      orderId,
      customerName: customer_name,
      customerContact: customer_contact,
      customerAddress: customer_address,
      items: orderItems.map((i: any) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        price: Number(i.price),
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
    console.error("orders create error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}