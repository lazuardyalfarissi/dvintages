import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/orders/my-orders?contact=08xxx
export async function GET(req: NextRequest) {
  const contact = req.nextUrl.searchParams.get("contact");

  if (!contact || contact.trim().length < 5)
    return NextResponse.json(
      { success: false, message: "Masukkan nomor WhatsApp yang valid" },
      { status: 400 }
    );

  // Normalisasi nomor: trim whitespace dan hapus semua spasi
  const normalized = contact.trim().replace(/\s/g, "");

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        `id, customer_name, total_price, payment_method, payment_status,
         order_status, created_at,
         order_shipping ( courier, service, destination_label, cost, etd )`
      )
      .eq("customer_contact", normalized)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    // Ratakan hasil join supaya bentuknya sama persis dengan versi MySQL lama
    const rows = (data ?? []).map((o: any) => {
      const s = Array.isArray(o.order_shipping) ? o.order_shipping[0] : o.order_shipping;
      return {
        id: o.id,
        customer_name: o.customer_name,
        total_price: Number(o.total_price),
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        order_status: o.order_status,
        created_at: o.created_at,
        courier: s?.courier ?? null,
        service: s?.service ?? null,
        destination_label: s?.destination_label ?? null,
        shipping_cost: s?.cost != null ? Number(s.cost) : null,
        etd: s?.etd ?? null,
      };
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}