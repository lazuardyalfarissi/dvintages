import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseImageUrls } from "@/lib/images";
import { uploadFile } from "@/lib/supabase";

// GET /api/products?category=all
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "all";
    const adminMode = searchParams.get("admin") === "1";

    let query = supabaseAdmin.from("products").select("*").order("id", { ascending: false });

    if (!adminMode) {
      // Public: hanya active dan sold_out
      query = query.in("status", ["active", "sold_out"]);
      if (category !== "all") query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let rows = data ?? [];

    // Pengganti ORDER BY FIELD(status, 'active', 'sold_out'): active dulu, lalu sold_out, id terbaru di atas
    if (!adminMode) {
      const rank = (s: string) => (s === "active" ? 0 : 1);
      rows = [...rows].sort((a, b) => rank(a.status) - rank(b.status) || b.id - a.id);
    }

    const products = rows.map((p) => ({
      ...p,
      image_url: parseImageUrls(p.image_url),
      price: Number(p.price),
    }));

    return NextResponse.json(
      { success: true, data: products },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } }
    );
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

    // Upload gambar baru
    const files = formData.getAll("images") as File[];
    const imageUrls: string[] = [];
    for (const file of files) {
      if (file && file.size > 0) {
        const url = await uploadFile(file, "products");
        imageUrls.push(url);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .insert({
        name,
        description,
        price,
        inventory,
        category,
        image_url: imageUrls.join(","),
        status,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      message: "Produk berhasil ditambahkan",
      data: { id: data.id },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}