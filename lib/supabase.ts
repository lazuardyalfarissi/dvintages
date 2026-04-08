import { createClient } from "@supabase/supabase-js";

// Client untuk server-side (pakai service role key agar bisa upload)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Client untuk public (read-only, untuk generate URL)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = process.env.SUPABASE_BUCKET || "dvintages";

/**
 * Upload file ke Supabase Storage
 * @param file - File object dari FormData
 * @param folder - Subfolder di bucket (misal: 'products', 'banners')
 * @returns Public URL file yang diupload
 */
export async function uploadFile(
  file: File,
  folder: "products" | "banners" = "products"
): Promise<string> {
  const ext = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Upload gagal: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * Hapus file dari Supabase Storage berdasarkan URL publik
 * @param publicUrl - URL publik file yang akan dihapus
 */
export async function deleteFile(publicUrl: string): Promise<void> {
  try {
    const url = new URL(publicUrl);
    // Extract path setelah /storage/v1/object/public/{bucket}/
    const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`);
    if (pathParts.length < 2) return;
    const filePath = pathParts[1];

    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
  } catch {
    // Jika gagal hapus (misal file tidak ada), lanjutkan saja
    console.warn("Gagal menghapus file dari storage:", publicUrl);
  }
}
