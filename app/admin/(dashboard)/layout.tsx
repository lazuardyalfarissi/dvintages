import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  
  // Harus "/login" agar sama dengan isi lib/auth.ts
  if (!session) redirect("/login");

  return <>{children}</>;
}