import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool, { parseImageUrls } from "@/lib/db";
import { uploadFile, deleteFile } from "@/lib/supabase";

// GET /api/products?category=all
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "all";
    const adminMode = searchParams.get("admin") === "1";

    let sql: string;
    let params: string[] = [];

    if (adminMode) {
      // Admin: tampilkan semua produk termasuk inactive
      sql = "SELECT * FROM products ORDER BY id DESC";
    } else {
      // Public: hanya active dan sold_out
      sql =
        "SELECT * FROM products WHERE status IN ('active', 'sold_out') ORDER BY FIELD(status, 'active', 'sold_out'), id DESC";
      if (category !== "all") {
        sql =
          "SELECT * FROM products WHERE status IN ('active', 'sold_out') AND category = ? ORDER BY FIELD(status, 'active', 'sold_out'), id DESC";
        params = [category];
      }
    }

    const [rows] = await pool.execute(sql, params);
    const products = (rows as any[]).map((p) => ({
      ...p,
      image_url: parseImageUrls(p.image_url),
      price: Number(p.price),
    }));

    return NextResponse.json({ success: true, data: products });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/products — tambah produk baru (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string || "";
    const price = parseFloat((formData.get("price") as string).replace(/\./g, ""));
    const inventory = parseInt(formData.get("inventory") as string);
    const category = formData.get("category") as string;
    const status = formData.get("status") as string;

    if (!name || isNaN(price)) {
      return NextResponse.json(
        { success: false, message: "Nama dan harga wajib diisi" },
        { status: 400 }
      );
    }

    // Upload gambar baru
    const files = formData.getAll("images") as File[];
    const imageUrls: string[] = [];
    for (const file of files) {
      if (file && file.size > 0) {
        const url = await uploadFile(file, "products");
        imageUrls.push(url);
      }
    }

    const imageUrlStr = imageUrls.join(",");

    const [result] = await pool.execute(
      "INSERT INTO products (name, description, price, inventory, category, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, description, price, inventory, category, imageUrlStr, status]
    );

    return NextResponse.json({
      success: true,
      message: "Produk berhasil ditambahkan",
      data: { id: (result as any).insertId },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
