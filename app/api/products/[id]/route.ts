import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseImageUrls } from "@/lib/images";
import { deleteFile, uploadFile } from "@/lib/supabase";

// GET /api/products/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "ID produk tidak valid" },
        { status: 400 }
      );
    }

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...product,
          image_url: parseImageUrls(product.image_url),
          price: Number(product.price),
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] — update produk (admin only)
export async function PUT(
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
        { success: false, message: "ID produk tidak valid" },
        { status: 400 }
      );
    }

    const formData = await req.formData();

    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || "";
    const price = parseFloat((formData.get("price") as string).replace(/\./g, ""));
    const inventoryRaw = parseInt(formData.get("inventory") as string);
    const inventory = Number.isNaN(inventoryRaw) ? 0 : inventoryRaw;
    const category = formData.get("category") as string;
    const status = formData.get("status") as string;

    if (!name || isNaN(price)) {
      return NextResponse.json(
        { success: false, message: "Nama dan harga wajib diisi" },
        { status: 400 }
      );
    }

    // URL gambar yang masih dipertahankan dari frontend
    const retainedUrlsRaw = formData.get("retained_image_urls") as string;
    const retainedUrls: string[] = retainedUrlsRaw
      ? JSON.parse(retainedUrlsRaw)
      : [];

    // Ambil gambar lama dari DB
    const { data: oldProduct, error: oldErr } = await supabaseAdmin
      .from("products")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();

    if (oldErr) throw new Error(oldErr.message);
    if (!oldProduct) {
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }
    const oldUrls = parseImageUrls(oldProduct.image_url);

    // Upload gambar baru
    const files = formData.getAll("images") as File[];
    const newUrls: string[] = [];
    for (const file of files) {
      if (file && file.size > 0) {
        const url = await uploadFile(file, "products");
        newUrls.push(url);
      }
    }

    // Final URLs = retained + new
    const finalUrls = [...retainedUrls, ...newUrls];

    // Hapus gambar lama yang tidak dipertahankan
    for (const oldUrl of oldUrls) {
      if (!retainedUrls.includes(oldUrl)) {
        await deleteFile(oldUrl);
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from("products")
      .update({
        name,
        description,
        price,
        inventory,
        category,
        image_url: finalUrls.join(","),
        status,
      })
      .eq("id", id);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ success: true, message: "Produk berhasil diupdate" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] — hapus produk (admin only)
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
        { success: false, message: "ID produk tidak valid" },
        { status: 400 }
      );
    }

    // Ambil URL gambar dulu sebelum dihapus
    const { data: product, error: findErr } = await supabaseAdmin
      .from("products")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();

    if (findErr) throw new Error(findErr.message);
    if (!product)
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan" },
        { status: 404 }
      );

    const { error: delErr } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", id);

    if (delErr) {
      // 23503 = foreign key violation (produk sudah pernah dipesan, ada di order_items)
      if (delErr.code === "23503") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Produk ini sudah pernah dipesan jadi nggak bisa dihapus. Ubah statusnya jadi inactive aja.",
          },
          { status: 409 }
        );
      }
      throw new Error(delErr.message);
    }

    // Hapus semua gambar dari Supabase Storage (setelah row berhasil dihapus)
    const urls = parseImageUrls(product.image_url);
    for (const url of urls) {
      await deleteFile(url);
    }

    return NextResponse.json({ success: true, message: "Produk berhasil dihapus" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}