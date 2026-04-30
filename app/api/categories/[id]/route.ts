import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) throw new Error("Nama kategori tidak boleh kosong");

    const [existing]: any = await (db as any).query(
      "SELECT id FROM categories WHERE name = ? AND id != ?", [name.trim(), params.id]
    );
    if (existing.length > 0) throw new Error("Nama kategori sudah dipakai");

    await (db as any).query(
      "UPDATE categories SET name = ? WHERE id = ?", [name.trim(), params.id]
    );
    return NextResponse.json({ success: true, message: "Kategori berhasil diupdate" });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await (db as any).query(
      "DELETE FROM categories WHERE id = ?", [params.id]
    );
    return NextResponse.json({ success: true, message: "Kategori berhasil dihapus" });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}