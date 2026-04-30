import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await (db as any).query(
      "SELECT * FROM categories ORDER BY name ASC"
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) throw new Error("Nama kategori tidak boleh kosong");

    const [existing]: any = await (db as any).query(
      "SELECT id FROM categories WHERE name = ?", [name.trim()]
    );
    if (existing.length > 0) throw new Error("Kategori sudah ada");

    await (db as any).query(
      "INSERT INTO categories (name) VALUES (?)", [name.trim()]
    );
    return NextResponse.json({ success: true, message: "Kategori berhasil ditambahkan" });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 400 });
  }
}