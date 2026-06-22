// app/api/shipping/search-city/route.ts
//
// Endpoint internal buat autocomplete kota tujuan di form order.
// Manggil RajaOngkir (Komerce) destination search, lalu diteruskan
// ke client. API key disimpan di server, gak pernah nyampe ke browser.
//
// ENV yang dibutuhkan (.env / Vercel Environment Variables):
//   RAJAONGKIR_API_KEY=xxxxxxxxxxxx

import { NextRequest, NextResponse } from "next/server";

const RAJAONGKIR_BASE = "https://rajaongkir.komerce.id/api/v1";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();

    if (!q || q.length < 3) {
      return NextResponse.json(
        { success: false, message: "Ketik minimal 3 huruf nama kota/kecamatan" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RAJAONGKIR_API_KEY;
    if (!apiKey) {
      console.error("RAJAONGKIR_API_KEY belum di-set di environment variables");
      return NextResponse.json(
        { success: false, message: "Layanan ongkir belum dikonfigurasi" },
        { status: 500 }
      );
    }

    const url = `${RAJAONGKIR_BASE}/destination/domestic-destination?search=${encodeURIComponent(
      q
    )}&limit=10`;

    const res = await fetch(url, {
      headers: { key: apiKey },
      // Hasil pencarian kota gak sering berubah, boleh sedikit di-cache
      next: { revalidate: 3600 },
    });

    const json = await res.json();

    if (!res.ok || json.meta?.code !== 200) {
      return NextResponse.json(
        { success: false, message: json.meta?.message || "Gagal mencari kota" },
        { status: 502 }
      );
    }

    // Bentuk respons Komerce: { data: [{ id, label, subdistrict_name, city_name, ... }] }
    const results = (json.data || []).map((d: any) => ({
      id: d.id,
      label: d.label,
      city: d.city_name,
      province: d.province_name,
    }));

    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    console.error("search-city error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat mencari kota" },
      { status: 500 }
    );
  }
}