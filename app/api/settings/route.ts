import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// GET /api/settings?key=whatsapp_number
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key") || "whatsapp_number";

    const [rows] = await pool.execute(
      "SELECT setting_value FROM settings WHERE setting_key = ?",
      [key]
    );
    const value = (rows as any[])[0]?.setting_value || "";
    return NextResponse.json({ success: true, data: value });
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
    await pool.execute(
      "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [key, value, value]
    );
    return NextResponse.json({ success: true, message: "Pengaturan berhasil disimpan" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
