import mysql from "mysql2/promise";

// Gunakan connection pool agar efisien di serverless environment (Vercel)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Penting untuk serverless: jangan pakai persistent connection
  enableKeepAlive: false,
});

export default pool;

/**
 * Helper: parsing image_url dari string comma-separated ke array
 */
export function parseImageUrls(imageUrl: string | null | undefined): string[] {
  if (!imageUrl) return [];
  return imageUrl
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}
