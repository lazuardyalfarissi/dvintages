import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Biar daftar kategori selalu fresh, nggak di-cache statis saat build
export const dynamic = "force-dynamic";

// GET /api/categories
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

// POST /api/categories — tambah kategori (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const { name } = await req.json();
    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName) throw new Error("Nama kategori tidak boleh kosong");

    const { error } = await supabaseAdmin
      .from("categories")
      .insert({ name: cleanName });

    if (error) {
      // 23505 = unique violation (kolom name sudah UNIQUE)
      if (error.code === "23505") throw new Error("Kategori sudah ada");
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, message: "Kategori berhasil ditambahkan" });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 400 });
  }
}