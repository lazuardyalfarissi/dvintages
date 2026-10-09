import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadFile, deleteFile } from "@/lib/supabase";

// GET /api/banners
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("banners")
      .select("id, image_url, title, description, created_at")
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? [] });
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
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || "";
    const file = formData.get("image") as File;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, message: "Gambar banner wajib diupload" },
        { status: 400 }
      );
    }

    const imageUrl = await uploadFile(file, "banners");

    const { error } = await supabaseAdmin
      .from("banners")
      .insert({ image_url: imageUrl, title, description });

    if (error) {
      // Row gagal masuk, jadi file yang barusan diupload dibersihkan
      await deleteFile(imageUrl);
      throw new Error(error.message);
    }

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
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || "";
    const existingUrl = formData.get("existing_image_url") as string;
    const file = formData.get("image") as File;

    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID banner tidak valid" },
        { status: 400 }
      );
    }

    let imageUrl = existingUrl;
    let uploadedNew = false;

    if (file && file.size > 0) {
      // Upload gambar baru
      imageUrl = await uploadFile(file, "banners");
      uploadedNew = true;
    }

    const { error } = await supabaseAdmin
      .from("banners")
      .update({ image_url: imageUrl, title, description })
      .eq("id", id);

    if (error) {
      // Update gagal, buang file baru biar nggak numpuk di bucket
      if (uploadedNew) await deleteFile(imageUrl);
      throw new Error(error.message);
    }

    // Hapus gambar lama setelah DB berhasil diupdate
    if (uploadedNew && existingUrl) await deleteFile(existingUrl);

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

    const { data: banner, error: findErr } = await supabaseAdmin
      .from("banners")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();

    if (findErr) throw new Error(findErr.message);
    if (!banner)
      return NextResponse.json(
        { success: false, message: "Banner tidak ditemukan" },
        { status: 404 }
      );

    const { error: delErr } = await supabaseAdmin
      .from("banners")
      .delete()
      .eq("id", id);

    if (delErr) throw new Error(delErr.message);

    await deleteFile(banner.image_url);

    return NextResponse.json({ success: true, message: "Banner berhasil dihapus" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}