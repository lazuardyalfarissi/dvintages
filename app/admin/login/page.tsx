"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      router.push("/admin");
    } else {
      setError("Kata sandi salah!");
    }
  }

  return (
    <>
      <style>{`
        body { background-color: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .login-container { background: #222; padding: 2rem; border-radius: 20px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; width: 100%; max-width: 400px; }
        h1 { color: #f0f0f0; margin-bottom: 1.5rem; font-size: 1.8rem; }
        .form-input { width: 100%; padding: 1rem; border: 1px solid #444; border-radius: 10px; font-size: 1rem; background-color: #1a1a1a; color: #f0f0f0; margin-bottom: 1rem; outline: none; }
        .btn-primary { background: #667eea; color: white; border: none; padding: 1rem; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .error-message { color: #f56565; margin-top: 1rem; font-size: 0.9rem; }
      `}</style>
      <div className="login-container">
        <h1>Dvintages Login</h1>
        <form onSubmit={handleSubmit}>
          <input type="password" className="form-input" placeholder="Masukkan Kata Sandi"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Memverifikasi..." : "Login"}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </>
  );
}