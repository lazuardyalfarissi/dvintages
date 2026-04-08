import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { uploadFile, deleteFile } from "@/lib/supabase";

// GET /api/banners
export async function GET() {
  try {
    const [rows] = await pool.execute(
      "SELECT id, image_url, title, description, created_at FROM banners ORDER BY id ASC"
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/banners — tambah banner (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string || "";
    const description = formData.get("description") as string || "";
    const file = formData.get("image") as File;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, message: "Gambar banner wajib diupload" },
        { status: 400 }
      );
    }

    const imageUrl = await uploadFile(file, "banners");

    await pool.execute(
      "INSERT INTO banners (image_url, title, description) VALUES (?, ?, ?)",
      [imageUrl, title, description]
    );

    return NextResponse.json({ success: true, message: "Banner berhasil ditambahkan" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/banners — update banner (admin only)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const id = parseInt(formData.get("id") as string);
    const title = formData.get("title") as string || "";
    const description = formData.get("description") as string || "";
    const existingUrl = formData.get("existing_image_url") as string;
    const file = formData.get("image") as File;

    let imageUrl = existingUrl;

    if (file && file.size > 0) {
      // Upload gambar baru
      imageUrl = await uploadFile(file, "banners");
      // Hapus gambar lama
      if (existingUrl) await deleteFile(existingUrl);
    }

    await pool.execute(
      "UPDATE banners SET image_url=?, title=?, description=? WHERE id=?",
      [imageUrl, title, description, id]
    );

    return NextResponse.json({ success: true, message: "Banner berhasil diupdate" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/banners?id=X (admin only)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "0");

    const [rows] = await pool.execute(
      "SELECT image_url FROM banners WHERE id = ?",
      [id]
    );
    const banner = (rows as any[])[0];
    if (!banner)
      return NextResponse.json(
        { success: false, message: "Banner tidak ditemukan" },
        { status: 404 }
      );

    await pool.execute("DELETE FROM banners WHERE id = ?", [id]);
    await deleteFile(banner.image_url);

    return NextResponse.json({ success: true, message: "Banner berhasil dihapus" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
