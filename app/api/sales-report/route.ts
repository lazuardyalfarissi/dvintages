import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET /api/sales-report — admin only
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin.rpc("sales_report");
    if (error) throw new Error(error.message);

    const summary = data?.summary ?? {};
    const monthly: any[] = data?.monthly_sales ?? [];

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_revenue: Number(summary.total_revenue || 0),
          total_orders: Number(summary.total_orders || 0),
        },
        monthly_sales: monthly.map((r) => ({
          sale_month: r.sale_month,
          monthly_revenue: Number(r.monthly_revenue),
          monthly_orders: Number(r.monthly_orders),
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}