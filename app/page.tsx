"use client";
import { useState, useEffect, useRef } from "react";
import "@/styles/store.css";

interface Product {
  id: number; name: string; description: string; price: number;
  image_url: string[]; status: string; inventory: number; category: string;
}
interface Banner { id: number; image_url: string; title: string; description: string; }

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ onCategoryChange }: { onCategoryChange: (cat: string) => void }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved === "light") { setTheme("light"); document.body.classList.add("light-mode"); }
    const onScroll = () => {
      const cur = window.scrollY;
      setHidden(cur > lastScroll.current && cur > 150);
      lastScroll.current = cur;
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.body.classList.toggle("light-mode");
    localStorage.setItem("theme", next);
  }

  return (
    <header className={`main-nav${hidden ? " navbar-hidden" : ""}`}>
      <div className="container nav-content">
        <a href="/" className="nav-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://wmikyjdtklhvdrsfkqdq.supabase.co/storage/v1/object/public/dvintages/assets/logo.jpg" alt="DVINTAGES" className="header-logo"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </a>
        <ul className="nav-links">
          <li><a href="/">Home</a></li>
          <li className="dropdown">
            <a href="#" className="dropbtn">Products ▼</a>
            <div className="dropdown-content">
              {["all", "Baju", "Celana", "Jacket", "Vest", "Sepatu", "Tas"].map((cat) => (
                <a key={cat} onClick={() => onCategoryChange(cat)} style={{ cursor: "pointer" }}>
                  {cat === "all" ? "All" : cat}
                </a>
              ))}
            </div>
          </li>
          <div className="social-icons">
            <a href="https://instagram.com/dvintagesss" target="_blank" rel="noreferrer" className="instagram" title="Instagram">
              <i className="fab fa-instagram" />
            </a>
            <a href="https://tiktok.com/@dvintages" target="_blank" rel="noreferrer" className="tiktok" title="TikTok">
              <i className="fab fa-tiktok" />
            </a>
            <a href="https://wa.me/6285774497521" target="_blank" rel="noreferrer" className="whatsapp" title="WhatsApp">
              <i className="fab fa-whatsapp" />
            </a>
          </div>
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Ganti tema">
            <i className="fas fa-sun" />
            <i className="fas fa-moon" />
          </button>
        </ul>
      </div>
    </header>
  );
}

// ─── Banner Carousel ──────────────────────────────────────────────────────────
function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length > 1)
      timerRef.current = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000);
  }

  useEffect(() => { resetTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [banners.length]);

  function scrollToProducts(e: React.MouseEvent) {
    e.preventDefault();
    document.getElementById("product-section")?.scrollIntoView({ behavior: "smooth" });
  }

  if (banners.length === 0) {
    return (
      <section className="banner-carousel-container">
        <div className="banner-slides">
          <div className="banner-slide" style={{ backgroundImage: "url('https://wmikyjdtklhvdrsfkqdq.supabase.co/storage/v1/object/public/dvintages/assets/banner.jpg')" }}>
            <h1>DVINTAGES</h1>
            <p>Bikin Gaya Lo Makin Kalcer Abiss!</p>
            <a href="#product-section" className="cta-button" onClick={scrollToProducts}>Shop</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="banner-carousel-container">
      <div className="banner-slides" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {banners.map((b) => (
          <div key={b.id} className="banner-slide" style={{ backgroundImage: `url('${b.image_url}')` }}>
            <h1>{b.title || "DVINTAGES"}</h1>
            <p>{b.description || "Koleksi vintage streetwear terbaik!"}</p>
            <a href="#product-section" className="cta-button" onClick={scrollToProducts}>Shop</a>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="carousel-dots">
          {banners.map((_, i) => (
            <span key={i} className={`dot${i === idx ? " active" : ""}`}
              onClick={() => { setIdx(i); resetTimer(); }} />
          ))}
        </div>
      )}
      <div className="scroll-indicator"><i className="fas fa-chevron-down" /></div>
    </section>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ p, onOrder }: { p: Product; onOrder: (id: number) => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  const isSoldOut = p.status === "sold_out" || (p.status !== "inactive" && p.inventory <= 0);
  const images = p.image_url.length > 0 ? p.image_url : ["https://placehold.co/1080x1440/222/f0f0f0?text=DVINTAGES"];

  return (
    <div className="product-card">
      {isSoldOut && <div className="sold-out-overlay">Sold out</div>}
      <div className="product-image-carousel">
        <div className="product-image-wrapper" style={{ transform: `translateX(-${imgIdx * 100}%)` }}>
          {images.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt={p.name} className="product-image-slide"
              onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/1080x1440/222/f0f0f0?text=Error"; }} />
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button className="product-carousel-btn left" onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i - 1 + images.length) % images.length); }}>
              <i className="fas fa-chevron-left" />
            </button>
            <button className="product-carousel-btn right" onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i + 1) % images.length); }}>
              <i className="fas fa-chevron-right" />
            </button>
            <div className="product-carousel-dots">
              {images.map((_, i) => (
                <span key={i} className={`product-dot${i === imgIdx ? " active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setImgIdx(i); }} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="product-info">
        <a href={`/product/${p.id}`} className="product-name-link">
          <div className="product-name">{p.name}</div>
        </a>
        <div className="product-price">Rp {new Intl.NumberFormat("id-ID").format(p.price)}</div>
        {p.description && <div className="product-description">{p.description}</div>}
        <div className="product-stock">Stok: {p.inventory}</div>
        <button className="order-btn" disabled={isSoldOut} onClick={() => onOrder(p.id)}>
          {isSoldOut ? "Stok Habis" : "Pesan Sekarang"}
        </button>
      </div>
    </div>
  );
}

// ─── Order Modal ──────────────────────────────────────────────────────────────
function OrderModal({ productId, onClose }: { productId: number; onClose: () => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, customer_name: name, customer_contact: contact }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const { orderId, productName, waNumber } = data.data;
      const msg = `Halo, saya sudah membuat pesanan #${orderId}.\n\nNama: ${name}\nProduk: ${productName}\n\nMohon info untuk pembayaran. Terima kasih.`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay visible" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <h3>Lengkapi Data Pesanan</h3>
        <form className="order-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nama Lengkap</label>
            <input className="form-input" required placeholder="Nama kamu" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nomor WhatsApp</label>
            <input className="form-input" type="tel" required placeholder="08123456xxxx" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          {error && <p style={{ color: "#f56565", marginBottom: 12 }}>{error}</p>}
          <div className="modal-buttons">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit" disabled={loading}>
              {loading ? "Memproses..." : "Lanjut ke WhatsApp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [orderProductId, setOrderProductId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/banners").then((r) => r.json()).then((d) => setBanners(d.data || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products?category=${category}`)
      .then((r) => r.json())
      .then((d) => { setProducts(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category]);

  const title = category === "all" ? "All Products" : category;

  return (
    <>
      <Navbar onCategoryChange={setCategory} />
      <BannerCarousel banners={banners} />

      <main id="product-section" className="product-section container">
        <h2 className="section-title">{title}</h2>
        <div className="products-grid">
          {loading ? (
            <div className="loading">⏳ Memuat produk...</div>
          ) : products.length === 0 ? (
            <div className="empty-state">📦 Belum ada produk di kategori ini.</div>
          ) : (
            products.map((p) => (
              <ProductCard key={p.id} p={p} onOrder={setOrderProductId} />
            ))
          )}
        </div>
      </main>

      <footer>
        <div className="container">
          <p suppressHydrationWarning>&copy; {new Date().getFullYear()} DVINTAGES</p>
          <p>Made by Lazuardy Al Farissi</p>
          <div className="footer-social">
            <a href="https://wa.me/6285774497521" target="_blank" rel="noreferrer"><i className="fab fa-whatsapp" /></a>
            <a href="https://instagram.com/dvintagesss" target="_blank" rel="noreferrer"><i className="fab fa-instagram" /></a>
            <a href="https://tiktok.com/@dvintages" target="_blank" rel="noreferrer"><i className="fab fa-tiktok" /></a>
          </div>
        </div>
      </footer>

      {orderProductId !== null && (
        <OrderModal productId={orderProductId} onClose={() => setOrderProductId(null)} />
      )}
    </>
  );
}