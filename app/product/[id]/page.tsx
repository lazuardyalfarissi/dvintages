"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useCart } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";
import CheckoutModal from "@/components/CheckoutModal";
import "@/styles/store.css";

interface Product {
  id: number; name: string; description: string; price: number;
  image_url: string[]; status: string; inventory: number; category: string;
}
interface Category { id: number; name: string; }

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem, totalItems } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mainImgIdx, setMainImgIdx] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [categories, setCategories] = useState<Category[]>([]);

  // Zoom & gesture state
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoomOrigin, setZoomOrigin] = useState("center center");
  const [isDragging, setIsDragging] = useState(false);
  const lastTap = useRef(0);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const isPinching = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved === "light") { setTheme("light"); document.body.classList.add("light-mode"); }
  }, []);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.data || []));
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setProduct(d.data); document.title = `DVINTAGES - ${d.data.name}`; }
        else setError(d.message);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [id]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.body.classList.toggle("light-mode");
    localStorage.setItem("theme", next);
  }

  function handleAddToCart() {
  if (!product) return;
  addItem({
    id: product.id,
    name: product.name,
    price: product.price,
    image_url: product.image_url[0] || "",
    inventory: product.inventory, // ← tambah ini
  });
    setAdded(true);
    setCartOpen(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setZoomOrigin("center center");
  }

  function clampPan(newPan: { x: number; y: number }, currentZoom: number) {
    if (!wrapperRef.current) return newPan;
    const { width, height } = wrapperRef.current.getBoundingClientRect();
    const maxX = (width * (currentZoom - 1)) / 2;
    const maxY = (height * (currentZoom - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, newPan.x)),
      y: Math.max(-maxY, Math.min(maxY, newPan.y)),
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || zoom <= 1) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan(clampPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy }, zoom));
  }
  function handleMouseEnd() { setIsDragging(false); }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      isPinching.current = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = zoom;
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / rect.width * 100;
        const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) / rect.height * 100;
        setZoomOrigin(`${cx}% ${cy}%`);
      }
      return;
    }
    isPinching.current = false;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    if (zoom > 1) {
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (zoom > 1) {
        resetZoom();
      } else {
        if (wrapperRef.current) {
          const rect = wrapperRef.current.getBoundingClientRect();
          const cx = (e.touches[0].clientX - rect.left) / rect.width * 100;
          const cy = (e.touches[0].clientY - rect.top) / rect.height * 100;
          setZoomOrigin(`${cx}% ${cy}%`);
        }
        setZoom(2.5);
      }
    }
    lastTap.current = now;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && isPinching.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newZoom = Math.min(4, Math.max(1, pinchStartZoom.current * (dist / pinchStartDist.current)));
      setZoom(newZoom);
      if (newZoom <= 1) setPan({ x: 0, y: 0 });
      return;
    }
    if (zoom > 1 && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setPan(clampPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy }, zoom));
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (isPinching.current) { isPinching.current = false; return; }
    if (zoom > 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) setMainImgIdx((i) => (i + 1) % images.length);
      else setMainImgIdx((i) => (i - 1 + images.length) % images.length);
    }
  }

  const isSoldOut = product
    ? product.status === "sold_out" || (product.status !== "inactive" && product.inventory <= 0)
    : false;

  const images = product?.image_url?.length
    ? product.image_url
    : ["https://placehold.co/1080x1440/222/f0f0f0?text=No+Image"];

  return (
    <>
      <style suppressHydrationWarning>{detailStyles}</style>

      {/* Navbar — pakai class dari store.css */}
      <header className="main-nav">
        <div className="container nav-content">
          <a href="/" className="nav-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://wmikyjdtklhvdrsfkqdq.supabase.co/storage/v1/object/public/dvintages/assets/logo.jpg"
              alt="DVINTAGES"
              className="header-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </a>
          <ul className="nav-links">
            <li><a href="/">Home</a></li>
            <li className="dropdown">
              <a href="javascript:void(0)" className="dropbtn">Products ▼</a>
              <div className="dropdown-content">
                <a href="/?category=all">All</a>
                {categories.map((cat) => (
                  <a key={cat.id} href={`/?category=${encodeURIComponent(cat.name)}`}>{cat.name}</a>
                ))}
              </div>
            </li>
            <div className="social-icons">
              <a href="https://instagram.com/dvintagesss" target="_blank" rel="noreferrer" className="instagram"><i className="fab fa-instagram" /></a>
              <a href="https://tiktok.com/@dvintages" target="_blank" rel="noreferrer" className="tiktok"><i className="fab fa-tiktok" /></a>
              <a href="https://wa.me/6285774497521" target="_blank" rel="noreferrer" className="whatsapp"><i className="fab fa-whatsapp" /></a>
            </div>
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Ganti tema">
              <i className="fas fa-sun" /><i className="fas fa-moon" />
            </button>
            <button className="cart-nav-btn" onClick={() => setCartOpen(true)}>
              🛒
              {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
            </button>
          </ul>
        </div>
      </header>

      <main className="product-detail-section">
        <div className="container">
          {loading ? (
            <div className="product-detail-grid skeleton-detail">
              <div className="product-detail-image-gallery">
                <div className="skeleton-detail-image" />
              </div>
              <div className="product-detail-info">
                <div className="skeleton-line-d w70" />
                <div className="skeleton-line-d w40" />
                <div className="skeleton-line-d w30" />
                <div className="skeleton-line-d w90" />
                <div className="skeleton-line-d w80" />
                <div className="skeleton-line-d w60" />
                <div className="skeleton-btn-d" />
              </div>
            </div>
          ) : error ? (
            <div className="error-container">❌ {error}</div>
          ) : product ? (
            <div className="product-detail-grid">
              {/* Image Gallery */}
              <div className="product-detail-image-gallery">
                {isSoldOut && <div className="product-detail-sold-out">Sold out</div>}
                <div
                  className="main-product-image-wrapper"
                  ref={wrapperRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseEnd}
                  onMouseLeave={handleMouseEnd}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={images[mainImgIdx]}
                    alt={product.name}
                    className="main-product-image"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                      transformOrigin: zoomOrigin,
                      cursor: zoom > 1 ? "grab" : "default",
                      transition: isDragging ? "none" : "transform 0.2s ease",
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/1080x1440/222/f0f0f0?text=Error"; }}
                    draggable={false}
                  />
                  {images.length > 1 && (
                    <div className="swipe-dots">
                      {images.map((_, i) => (
                        <span key={i} className={`swipe-dot${i === mainImgIdx ? " active" : ""}`} />
                      ))}
                    </div>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="thumbnail-container">
                    {images.map((url, i) => (
                      <div
                        key={i}
                        className={`thumbnail-item${i === mainImgIdx ? " active" : ""}`}
                        onClick={() => { setMainImgIdx(i); resetZoom(); }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`${product.name} ${i + 1}`}
                          onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/60x60/222/f0f0f0?text=Err"; }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="product-detail-info">
                <h1 className="product-detail-name">{product.name}</h1>
                <div className="product-detail-price">
                  Rp {new Intl.NumberFormat("id-ID").format(product.price)}
                </div>
                <div className="product-detail-stock">Stok: {product.inventory}</div>
                <div className="product-detail-description">
                  {product.description || "Tidak ada deskripsi tersedia."}
                </div>
                <button
                  className="product-detail-order-btn"
                  disabled={isSoldOut}
                  onClick={handleAddToCart}
                >
                  {isSoldOut ? "Stok Habis" : added ? "✅ Ditambahkan!" : "🛒 Tambah ke Keranjang"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <footer>
        <div className="container">
          <p>&copy; {new Date().getFullYear()} DVINTAGES</p>
          <p>Made by Lazuardy Al Farissi</p>
          <div className="footer-social">
            <a href="https://wa.me/6285774497521" target="_blank" rel="noreferrer"><i className="fab fa-whatsapp" /></a>
            <a href="https://instagram.com/dvintagesss" target="_blank" rel="noreferrer"><i className="fab fa-instagram" /></a>
            <a href="https://tiktok.com/@dvintages" target="_blank" rel="noreferrer"><i className="fab fa-tiktok" /></a>
          </div>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
      />
      {checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} />}
    </>
  );
}

// Catatan: semua CSS navbar (main-nav, nav-links, dropdown, social-icons,
// theme-toggle-btn, cart-nav-btn, cart-badge) sudah dihapus dari sini
// karena dihandle oleh store.css yang diimport di atas.
const detailStyles = `
  /* ── Main section ── */
  .product-detail-section { padding: 2rem 0; flex-grow: 1; }

  /* ── Grid ── */
  .product-detail-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
    max-width: 1000px;
    margin: 0 auto;
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: 0 10px 25px var(--shadow-color);
    border: 2px solid var(--border-color);
    overflow: visible;
    height: auto;
  }
  @media (min-width: 768px) {
    .product-detail-grid { grid-template-columns: 1.2fr 1fr; }
  }

  /* ── Image gallery ── */
  .product-detail-image-gallery {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 10px 10px 0 0;
    overflow: hidden;
  }
  @media (min-width: 768px) {
    .product-detail-image-gallery { border-radius: 10px 0 0 10px; }
  }

  .main-product-image-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    overflow: hidden;
    touch-action: none;
  }
  .main-product-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    user-select: none;
    -webkit-user-drag: none;
    will-change: transform;
  }

  /* ── Cart button ── */
  .cart-nav-btn { position: relative; background: transparent; border: none; font-size: 1.3rem; cursor: pointer; padding: 4px 8px; display: flex; align-items: center; }
  .cart-badge { position: absolute; top: -4px; right: -4px; background: #e53e3e; color: #fff; font-size: 0.65rem; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    
    /* Thumbnail */
  .thumbnail-container {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 10px 12px;
    background: var(--card-bg);
    border-top: 1px solid var(--border-color);
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .thumbnail-container::-webkit-scrollbar { display: none; }
  @media (min-width: 768px) {
    .thumbnail-container {
      position: absolute;
      bottom: 10px;
      left: 10px;
      right: 10px;
      border-top: none;
      background: transparent;
      padding: 5px 0;
      z-index: 10;
    }
  }
  .thumbnail-item { width: 60px; height: 60px; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: border-color 0.3s, transform 0.2s; flex-shrink: 0; }
  @media (min-width: 768px) { .thumbnail-item { width: 52px; height: 52px; } }
  .thumbnail-item.active, .thumbnail-item:hover { border-color: var(--primary-color); transform: translateY(-2px); }
  .thumbnail-item img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .product-detail-sold-out { position: absolute; top: 15px; left: 15px; padding: 6px 12px; background: #fff; color: #1a1a1a; font-size: 0.85rem; font-weight: 700; border-radius: 6px; z-index: 15; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }

  .swipe-dots { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; pointer-events: none; }
  .swipe-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.45); transition: all 0.3s; }
  .swipe-dot.active { background: #fff; width: 18px; border-radius: 3px; }
  @media (max-width: 767px) { .swipe-dots { display: flex; } }
  @media (min-width: 768px) { .swipe-dots { display: none; } }

  /* ── Product info ── */
  .product-detail-info {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: unset;
    overflow: visible;
  }
  .product-detail-name {
    font-family: 'Anton', sans-serif;
    font-size: clamp(1.4rem, 5vw, 3rem);
    margin-bottom: 1rem;
    color: var(--text-color);
    line-height: 1.2;
    text-transform: uppercase;
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    white-space: normal;
  }
  .product-detail-price { font-family: 'Anton', sans-serif; font-size: clamp(1.3rem, 4vw, 2.2rem); color: var(--primary-color); margin-bottom: 1rem; letter-spacing: 1px; }
  .product-detail-stock { font-size: 0.95rem; color: var(--text-color-subtle); margin-bottom: 1.5rem; }
  .product-detail-description { font-size: 0.95rem; color: var(--text-color-secondary); line-height: 1.7; margin-bottom: 2rem; white-space: pre-wrap; flex-grow: 1; word-break: break-word; }
  .product-detail-order-btn {
    width: 100%;
    padding: 16px;
    background: var(--primary-color);
    color: var(--text-on-primary);
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 0;
    flex-shrink: 0;
  }
  .product-detail-order-btn:hover { background: var(--text-color); color: var(--bg-color); transform: translateY(-3px); }
  .product-detail-order-btn:disabled { background: var(--disabled-bg); color: var(--disabled-text); cursor: not-allowed; transform: none; }

  /* ── Error ── */
  .error-container { text-align: center; padding: 50px; font-size: 1rem; color: #e53e3e; font-weight: bold; }

  /* ── Skeleton shimmer ── */
  .skeleton-detail { pointer-events: none; }
  .skeleton-detail-image,
  .skeleton-line-d,
  .skeleton-btn-d {
    background: linear-gradient(90deg, var(--border-color) 25%, var(--card-bg) 50%, var(--border-color) 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s infinite linear;
    border-radius: 6px;
  }
  .skeleton-detail-image { width: 100%; aspect-ratio: 3 / 4; border-radius: 0; }
  .skeleton-line-d { height: 16px; margin-bottom: 16px; }
  .skeleton-line-d.w70 { width: 70%; height: 36px; margin-bottom: 20px; }
  .skeleton-line-d.w40 { width: 40%; height: 28px; }
  .skeleton-line-d.w30 { width: 30%; }
  .skeleton-line-d.w90 { width: 90%; }
  .skeleton-line-d.w80 { width: 80%; }
  .skeleton-line-d.w60 { width: 60%; }
  .skeleton-btn-d { height: 52px; width: 100%; margin-top: 8px; border-radius: 10px; }

  @media (max-width: 600px) {
    .product-detail-info { padding: 1.25rem; }
  }
`;