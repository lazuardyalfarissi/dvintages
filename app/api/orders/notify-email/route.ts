// app/api/orders/notify-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendOrderEmail, type OrderEmailData } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      orderId,
      customerName,
      customerEmail,
      customerContact,
      customerAddress,
      items,
      subtotal,
      shippingCost,
      shippingCourier,
      shippingService,
      shippingDestination,
      shippingEtd,
      paymentMethod,
      grandTotal,
      pakasirInstructions, // ← baru, opsional — hanya ada kalau paymentMethod === "pakasir"
    } = body;

    // Validasi field wajib
    if (!orderId || !customerEmail || !customerName) {
      return NextResponse.json(
        { success: false, message: "Data tidak lengkap" },
        { status: 400 }
      );
    }

    const emailData: OrderEmailData = {
      orderId,
      customerName,
      customerEmail,
      customerContact,
      customerAddress,
      items,
      subtotal,
      shippingCost,
      shippingCourier,
      shippingService,
      shippingDestination,
      shippingEtd,
      paymentMethod,
      grandTotal,
      pakasirInstructions, // ← undefined kalau wa_manual, tidak masalah
    };

    await sendOrderEmail(emailData);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[notify-email] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Gagal mengirim email" },
      { status: 500 }
    );
  }
}