import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/settings?key=whatsapp_number
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key") || "whatsapp_number";

    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("setting_value")
      .eq("setting_key", key)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data?.setting_value || "" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/settings
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const { key, value } = await req.json();

    if (typeof key !== "string" || !key.trim() || value === undefined || value === null) {
      return NextResponse.json(
        { success: false, message: "Key dan value wajib diisi" },
        { status: 400 }
      );
    }

    // Pengganti "ON DUPLICATE KEY UPDATE": insert, kalau setting_key sudah ada maka update
    const { error } = await supabaseAdmin
      .from("settings")
      .upsert(
        { setting_key: key.trim(), setting_value: String(value) },
        { onConflict: "setting_key" }
      );

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: "Pengaturan berhasil disimpan" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}