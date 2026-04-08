import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

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
    const { status } = await req.json();

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      await conn.execute("UPDATE orders SET order_status = ? WHERE id = ?", [
        status,
        id,
      ]);

      // Jika status 'Selesai', kurangi stok
      if (status === "Selesai") {
        const [items] = await conn.execute(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
          [id]
        );
        for (const item of items as any[]) {
          await conn.execute(
            "UPDATE products SET inventory = inventory - ? WHERE id = ?",
            [item.quantity, item.product_id]
          );
        }
      }

      await conn.commit();
      conn.release();

      return NextResponse.json({
        success: true,
        message: "Status pesanan berhasil diupdate",
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
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      await conn.execute("DELETE FROM order_items WHERE order_id = ?", [id]);
      const [result] = await conn.execute("DELETE FROM orders WHERE id = ?", [id]);

      if ((result as any).affectedRows === 0) {
        await conn.rollback();
        conn.release();
        return NextResponse.json(
          { success: false, message: "Pesanan tidak ditemukan" },
          { status: 404 }
        );
      }

      await conn.commit();
      conn.release();

      return NextResponse.json({ success: true, message: "Pesanan berhasil dihapus" });
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
