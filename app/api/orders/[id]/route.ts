import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// PATCH /api/orders/[id] — update status (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const id = parseInt(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID pesanan tidak valid" },
        { status: 400 }
      );
    }

    const { status } = await req.json();

    // Update status, sinkron payment_status, dan pengurangan stok
    // jalan atomik di dalam fungsi DB update_order_status
    const { error } = await supabaseAdmin.rpc("update_order_status", {
      p_id: id,
      p_status: status,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("ORDER_NOT_FOUND")) {
        return NextResponse.json(
          { success: false, message: "Pesanan tidak ditemukan" },
          { status: 404 }
        );
      }
      if (msg.includes("INVALID_STATUS")) {
        return NextResponse.json(
          { success: false, message: "Status pesanan tidak valid" },
          { status: 400 }
        );
      }
      throw new Error(msg);
    }

    return NextResponse.json({
      success: true,
      message: "Status pesanan berhasil diupdate",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id] — hapus pesanan (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const id = parseInt(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID pesanan tidak valid" },
        { status: 400 }
      );
    }

    // order_items, order_payments, dan order_shipping punya FK ON DELETE CASCADE
    // ke orders, jadi semuanya ikut terhapus otomatis dalam satu perintah ini.
    const { data, error } = await supabaseAdmin
      .from("orders")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, message: "Pesanan tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Pesanan berhasil dihapus" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}