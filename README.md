🛍️ DVINTAGES — Modern Thrift Store & Inventory System
DVINTAGES adalah transformasi dari sistem PHP Native menjadi aplikasi web modern berbasis Next.js 14 App Router. Proyek ini dirancang untuk UMKM yang membutuhkan platform e-commerce cepat, responsif, dan terintegrasi langsung dengan manajemen stok serta pemesanan via WhatsApp.✨ 
Fitur Utama
1. 🚀 High Performance: Server-side Rendering (SSR) untuk SEO yang lebih baik.
2. 🔐 Secure Admin Dashboard: Manajemen produk, banner, dan pesanan terlindungi oleh NextAuth.js. 
3. 📦 Real-time Inventory: Pantau stok produk secara akurat.
4. 🖼️ Cloud Image Storage: Integrasi Supabase Storage untuk handling gambar tanpa membebani server.
5. 📱 Responsive & Mobile Fit: Tampilan yang sudah dioptimasi untuk Android dan iOS (No Horizontal Scroll).
6. 🌓 Theme Toggle: Dukungan Dark Mode dan Light Mode yang nyaman di mata.
7. 💬 WhatsApp Integration: Alur pemesanan yang langsung terhubung ke admin via WhatsApp API.

⚡ Tech Stack
Kebutuhan dan Solusi
Framework Next.js 14 (App Router)
Language TypeScript 
Database MySQL (Remote Access Ready)
Auth System NextAuth.js (JWT + Session)
File Hosting Supabase Storage
Styling CSS Modules & Global Styling

📁 Struktur ProjectPlaintextdvintages/

├── app/
│   ├── page.tsx                # Storefront (Home)
│   ├── product/[id]/page.tsx   # Detail Produk
│   ├── admin/                  # Dashboard Area (Protected)
│   └── api/                    # Backend API Routes
├── lib/                        # Konfigurasi DB, Auth, & Supabase
├── types/                      # TypeScript Definitions
├── styles/                     # CSS Modules & Store Styling
└── .env.local.example          # Template Environment Variables

🚀 Setup & Installation

1. Kloning Repo & Install Bashgit clone https://github.com/lazuardyalfarissi/dvintages.git
cd dvintages
npm install

2. Konfigurasi Environment VariablesBuat file .env.local dan isi sesuai kredensial Anda:Cuplikan kode# Database
DB_HOST=your-mysql-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=toko_online_mini

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=pake_openssl_buat_generate
ADMIN_PASSWORD=admin123

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx
SUPABASE_BUCKET=dvintages

3. Jalankan di LokalBashnpm run dev
Buka http://localhost:3000 untuk melihat hasilnya.🔄 Mapping: Migrasi dari PHP ke Next.jsFiturPHP Native (Old)Next.js 14 (New)Routingproduct_detail.php?id=1/product/1 (Dynamic Routes)Session$_SESSION['admin']useSession() (NextAuth)Uploadmove_uploaded_file()supabase.storage.upload()APIapi/get_products.php/api/products/route.ts👤 AuthorLazuardy Al Farissi Fullstack Developer | Coder | Hustler 🌐 Portfolio: lazuardyalf.com