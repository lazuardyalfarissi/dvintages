# 🛍️ DVINTAGES — Modern Thrift Store & Inventory System

DVINTAGES adalah aplikasi web e-commerce untuk UMKM thrift store yang dibangun menggunakan Next.js 14 App Router. Sistem ini menyediakan manajemen produk, stok, dan pemesanan terintegrasi dengan WhatsApp untuk alur transaksi yang cepat dan efisien.

## ✨ Fitur

- High Performance (SSR)
- Secure Admin Dashboard (NextAuth.js)
- Real-time Inventory Management
- Cloud Image Storage (Supabase)
- Responsive Design (Mobile & Desktop)
- Dark & Light Mode
- WhatsApp Order Integration

## ⚙️ Tech Stack

- Next.js 14 (App Router)
- TypeScript
- MySQL
- NextAuth.js
- Supabase Storage
- CSS Modules

## 📁 Struktur Project

```
dvintages/
├── app/
│   ├── page.tsx
│   ├── product/[id]/page.tsx
│   ├── admin/
│   └── api/
├── lib/
├── types/
├── styles/
└── .env.local.example
```

## 🚀 Installation

```bash
git clone https://github.com/lazuardyalfarissi/dvintages.git
cd dvintages
npm install
```

## ⚙️ Environment Variables

```env
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=toko_online_mini

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
ADMIN_PASSWORD=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET=dvintages
```

## ▶️ Run

```bash
npm run dev
```

## 🔄 Migration

| Feature | PHP Native | Next.js |
|--------|------------|--------|
| Routing | product_detail.php?id=1 | /product/1 |
| Session | $_SESSION | NextAuth |
| Upload | move_uploaded_file | Supabase Storage |
| API | PHP API | Next.js API Routes |

## 👤 Author

Lazuardy Al Farissi
https://lazuardyalf.com