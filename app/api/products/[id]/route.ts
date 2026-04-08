import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool, { parseImageUrls } from "@/lib/db";
import { uploadFile, deleteFile } from "@/lib/supabase";

// GET /api/products/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const [rows] = await pool.execute("SELECT * FROM products WHERE id = ?", [id]);
    const product = (rows as any[])[0];

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        image_url: parseImageUrls(product.image_url),
        price: Number(product.price),
      },
    });
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
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string || "";
    const price = parseFloat((formData.get("price") as string).replace(/\./g, ""));
    const inventory = parseInt(formData.get("inventory") as string);
    const category = formData.get("category") as string;
    const status = formData.get("status") as string;

    // URL gambar yang masih dipertahankan dari frontend
    const retainedUrlsRaw = formData.get("retained_image_urls") as string;
    const retainedUrls: string[] = retainedUrlsRaw
      ? JSON.parse(retainedUrlsRaw)
      : [];

    // Ambil gambar lama dari DB
    const [oldRows] = await pool.execute(
      "SELECT image_url FROM products WHERE id = ?",
      [id]
    );
    const oldProduct = (oldRows as any[])[0];
    const oldUrls = parseImageUrls(oldProduct?.image_url);

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

    await pool.execute(
      "UPDATE products SET name=?, description=?, price=?, inventory=?, category=?, image_url=?, status=? WHERE id=?",
      [name, description, price, inventory, category, finalUrls.join(","), status, id]
    );

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

    // Ambil URL gambar dulu sebelum dihapus
    const [rows] = await pool.execute(
      "SELECT image_url FROM products WHERE id = ?",
      [id]
    );
    const product = (rows as any[])[0];
    if (!product)
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan" },
        { status: 404 }
      );

    await pool.execute("DELETE FROM products WHERE id = ?", [id]);

    // Hapus semua gambar dari Supabase
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
