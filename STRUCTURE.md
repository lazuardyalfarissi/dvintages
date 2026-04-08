# Dvintages - Next.js Project Structure

```
dvintages/
├── app/
│   ├── (store)/                    # Public storefront
│   │   ├── page.tsx                # Home (index.php)
│   │   └── product/[id]/page.tsx  # Product detail
│   ├── admin/                      # Admin dashboard
│   │   ├── layout.tsx
│   │   └── page.tsx               # Admin dashboard (admin.php)
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── products/route.ts
│   │   ├── products/[id]/route.ts
│   │   ├── banners/route.ts
│   │   ├── orders/route.ts
│   │   ├── orders/[id]/route.ts
│   │   ├── settings/route.ts
│   │   ├── sales-report/route.ts
│   │   └── upload/route.ts
│   └── layout.tsx
├── lib/
│   ├── db.ts                       # MySQL connection (mysql2)
│   ├── supabase.ts                 # Supabase storage client
│   └── auth.ts                     # NextAuth config
├── types/
│   └── index.ts
├── .env.local
├── next.config.js
└── package.json
```
