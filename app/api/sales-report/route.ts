import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// GET /api/sales-report — admin only
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  try {
    const [summaryRows] = await pool.execute(
      "SELECT SUM(total_price) AS total_revenue, COUNT(id) AS total_orders FROM orders WHERE order_status = 'Selesai'"
    );
    const summary = (summaryRows as any[])[0];

    const [monthlyRows] = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS sale_month,
              SUM(total_price) AS monthly_revenue,
              COUNT(id) AS monthly_orders
       FROM orders WHERE order_status = 'Selesai'
       GROUP BY sale_month ORDER BY sale_month ASC`
    );

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_revenue: Number(summary?.total_revenue || 0),
          total_orders: Number(summary?.total_orders || 0),
        },
        monthly_sales: (monthlyRows as any[]).map((r) => ({
          ...r,
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
