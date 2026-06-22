// app/api/shipping/cost/route.ts
//
// Endpoint internal buat hitung ongkir dari toko (Lenteng Agung, Jagakarsa,
// Jakarta Selatan) ke kota tujuan. Berat dipukul rata 1000 gram (1kg) per
// produk sesuai keputusan bisnis. Kurir dibatasi ke JNE, J&T (jnt), SiCepat.
//
// PENTING — endpoint yang dipakai: /calculate/domestic-cost (BUKAN
// /calculate/district/domestic-cost). Ini "Direct Search" method dari
// Komerce, yang cocok dipasangkan dengan ID hasil endpoint
// /destination/domestic-destination (yang levelnya subdistrict/kelurahan).
// Endpoint /calculate/district/domestic-cost itu untuk "Step-by-Step
// Method" yang minta district ID (kecamatan), beda granularity — makanya
// sebelumnya selalu error "Origin or Destination not found".
//
// ENV yang dibutuhkan:
//   RAJAONGKIR_API_KEY=xxxxxxxxxxxx
//   RAJAONGKIR_ORIGIN_ID=17533   <-- subdistrict ID dari domestic-destination search

import { NextRequest, NextResponse } from "next/server";

const RAJAONGKIR_BASE = "https://rajaongkir.komerce.id/api/v1";
const ALLOWED_COURIERS = ["jne", "jnt", "sicepat"];
const FLAT_WEIGHT_GRAM = 1000; // 1kg flat per produk, sesuai keputusan

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { destination_id, qty } = body as { destination_id: number | string; qty?: number };

    if (!destination_id) {
      return NextResponse.json(
        { success: false, message: "Kota tujuan wajib diisi" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RAJAONGKIR_API_KEY;
    const originId = process.env.RAJAONGKIR_ORIGIN_ID;

    if (!apiKey || !originId) {
      console.error("RAJAONGKIR_API_KEY atau RAJAONGKIR_ORIGIN_ID belum di-set");
      return NextResponse.json(
        { success: false, message: "Layanan ongkir belum dikonfigurasi" },
        { status: 500 }
      );
    }

    const weight = FLAT_WEIGHT_GRAM * Math.max(1, qty || 1);

    const form = new URLSearchParams({
      origin: String(originId),
      destination: String(destination_id),
      weight: String(weight),
      courier: ALLOWED_COURIERS.join(":"),
      price: "lowest",
    });

    const res = await fetch(`${RAJAONGKIR_BASE}/calculate/domestic-cost`, {
      method: "POST",
      headers: {
        key: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const json = await res.json();

    if (!res.ok || json.meta?.code !== 200) {
      return NextResponse.json(
        { success: false, message: json.meta?.message || "Gagal menghitung ongkir" },
        { status: 502 }
      );
    }

    // Bentuk respons Komerce: { data: [{ name, code, service, description, cost, etd }] }
    // Filter keluar JNE Trucking (JTR / JTR<130 / JTR>130 / JTR>200) — layanan
    // cargo untuk barang besar/berat, tidak relevan untuk produk fashion DVINTAGES
    // dan harganya bisa sampai ratusan ribu yang membingungkan customer.
    const EXCLUDED_SERVICES = ["jtr", "jtr<130", "jtr>130", "jtr>200"];

    const options = (json.data || [])
      .filter((d: any) => ALLOWED_COURIERS.includes((d.code || "").toLowerCase()))
      .filter((d: any) => !EXCLUDED_SERVICES.includes((d.service || "").toLowerCase()))
      .map((d: any) => ({
        courier: (d.code || "").toUpperCase(),
        service: d.service,
        description: d.description,
        cost: d.cost,
        etd: d.etd,
      }))
      .sort((a: any, b: any) => a.cost - b.cost);

    return NextResponse.json({ success: true, data: options });
  } catch (err: any) {
    console.error("shipping/cost error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat menghitung ongkir" },
      { status: 500 }
    );
  }
}

/*
  CATATAN origin yang sudah terverifikasi jalan untuk DVINTAGES:

  RAJAONGKIR_ORIGIN_ID=17533
  (LENTENG AGUNG, JAGAKARSA, JAKARTA SELATAN, DKI JAKARTA, 12630)

  Diverifikasi lewat curl langsung ke:
  https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost
  dan berhasil mengembalikan daftar layanan JNE dengan cost yang valid.
*/