export function parseImageUrls(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);

  const str = String(raw).trim();
  if (str.startsWith("[")) {
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
    } catch {}
  }
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}