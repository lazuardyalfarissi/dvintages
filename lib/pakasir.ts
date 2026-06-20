/**
 * lib/pakasir.ts
 * Helper tipis untuk integrasi Pakasir Payment Gateway.
 * Docs: https://pakasir.com/p/docs
 *
 * Catatan penting:
 * - Project & API key sekarang masih SANDBOX (KYC belum selesai).
 *   Nanti setelah KYC kelar, tinggal ganti PAKASIR_PROJECT_SLUG &
 *   PAKASIR_API_KEY di env — TIDAK ADA perubahan kode yang diperlukan.
 * - Selama sandbox, gunakan `simulatePayment()` untuk mengetes webhook
 *   tanpa harus benar-benar transfer.
 */

const PAKASIR_BASE_URL = "https://app.pakasir.com";

const PROJECT_SLUG = process.env.PAKASIR_PROJECT_SLUG;
const API_KEY = process.env.PAKASIR_API_KEY;

export type PakasirPaymentMethod =
  | "qris"
  | "cimb_niaga_va"
  | "bni_va"
  | "sampoerna_va"
  | "bnc_va"
  | "maybank_va"
  | "permata_va"
  | "atm_bersama_va"
  | "artha_graha_va"
  | "bri_va";

// Label ramah-pengguna untuk ditampilkan di UI pemilihan metode bayar
export const PAKASIR_PAYMENT_LABELS: Record<PakasirPaymentMethod, string> = {
  qris: "QRIS (semua e-wallet & m-banking)",
  bri_va: "BRI Virtual Account",
  bni_va: "BNI Virtual Account",
  permata_va: "Permata Virtual Account",
  cimb_niaga_va: "CIMB Niaga Virtual Account",
  maybank_va: "Maybank Virtual Account",
  atm_bersama_va: "ATM Bersama Virtual Account",
  artha_graha_va: "Artha Graha Virtual Account",
  bnc_va: "BNC Virtual Account",
  sampoerna_va: "Sampoerna Virtual Account",
};

function assertConfigured() {
  if (!PROJECT_SLUG || !API_KEY) {
    throw new Error(
      "PAKASIR_PROJECT_SLUG / PAKASIR_API_KEY belum di-set di environment variables"
    );
  }
}

interface PakasirCreateResponse {
  payment: {
    project: string;
    order_id: string;
    amount: number;
    fee: number;
    total_payment: number;
    payment_method: string;
    payment_number: string;
    expired_at: string;
  };
}

interface PakasirDetailResponse {
  transaction: {
    amount: number;
    order_id: string;
    project: string;
    status: "pending" | "completed" | "expired" | "cancelled";
    payment_method: string;
    completed_at?: string;
  };
}

/**
 * Membuat transaksi baru di Pakasir (mendapatkan QR string / nomor VA).
 */
export async function createPakasirTransaction(params: {
  orderId: string | number;
  amount: number;
  method: PakasirPaymentMethod;
}): Promise<PakasirCreateResponse["payment"]> {
  assertConfigured();

  const res = await fetch(
    `${PAKASIR_BASE_URL}/api/transactioncreate/${params.method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: PROJECT_SLUG,
        order_id: String(params.orderId),
        amount: params.amount,
        api_key: API_KEY,
      }),
      // Jangan cache respons pembuatan transaksi
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok || !data?.payment) {
    throw new Error(data?.message || "Gagal membuat transaksi Pakasir");
  }

  return data.payment;
}

/**
 * Cek status transaksi langsung ke Pakasir (lebih valid daripada
 * hanya mengandalkan webhook — sesuai rekomendasi dokumentasi mereka).
 */
export async function getPakasirTransactionDetail(params: {
  orderId: string | number;
  amount: number;
}): Promise<PakasirDetailResponse["transaction"]> {
  assertConfigured();

  const url = new URL(`${PAKASIR_BASE_URL}/api/transactiondetail`);
  url.searchParams.set("project", PROJECT_SLUG!);
  url.searchParams.set("amount", String(params.amount));
  url.searchParams.set("order_id", String(params.orderId));
  url.searchParams.set("api_key", API_KEY!);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();

  if (!res.ok || !data?.transaction) {
    throw new Error(data?.message || "Gagal mengambil detail transaksi Pakasir");
  }

  return data.transaction;
}

/**
 * Batalkan transaksi (jarang dipakai, tapi disediakan sesuai docs).
 */
export async function cancelPakasirTransaction(params: {
  orderId: string | number;
  amount: number;
}): Promise<void> {
  assertConfigured();

  const res = await fetch(`${PAKASIR_BASE_URL}/api/transactioncancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: PROJECT_SLUG,
      order_id: String(params.orderId),
      amount: params.amount,
      api_key: API_KEY,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || "Gagal membatalkan transaksi Pakasir");
  }
}

/**
 * KHUSUS SANDBOX: simulasikan pembayaran supaya webhook ke-trigger,
 * tanpa harus transfer beneran. Hapus pemanggilan ini dari UI produksi
 * begitu project sudah lolos KYC (atau biarkan saja — di mode production
 * endpoint ini otomatis tidak berlaku/ditolak oleh Pakasir).
 */
export async function simulatePakasirPayment(params: {
  orderId: string | number;
  amount: number;
}): Promise<void> {
  assertConfigured();

  const res = await fetch(`${PAKASIR_BASE_URL}/api/paymentsimulation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: PROJECT_SLUG,
      order_id: String(params.orderId),
      amount: params.amount,
      api_key: API_KEY,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || "Gagal melakukan simulasi pembayaran");
  }
}