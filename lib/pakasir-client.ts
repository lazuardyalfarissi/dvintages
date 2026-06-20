/**
 * lib/pakasir-client.ts
 *
 * Versi "aman untuk client" dari daftar metode pembayaran Pakasir.
 * Dipisah dari lib/pakasir.ts karena file itu membaca PAKASIR_API_KEY
 * (server-only env var tanpa prefix NEXT_PUBLIC_) — kalau diimport ke
 * komponen "use client", Next.js akan gagal build / membocorkan asumsi
 * yang salah soal env. File ini cuma berisi data statis, tidak ada
 * panggilan API maupun secret apa pun.
 */

export type PakasirMethodClient =
  | "qris"
  | "bri_va"
  | "bni_va"
  | "permata_va"
  | "cimb_niaga_va"
  | "maybank_va"
  | "atm_bersama_va"
  | "artha_graha_va"
  | "bnc_va"
  | "sampoerna_va";

export const PAKASIR_PAYMENT_LABELS_CLIENT: Record<PakasirMethodClient, string> = {
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