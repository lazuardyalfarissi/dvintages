"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

interface Product {
  id: number; name: string; description: string; price: number;
  image_url: string[]; status: string; inventory: number; category: string;
}
interface Category { id: number; name: string; }

function OrderModal({ productId, onClose }: { productId: number; onClose: () => void }) {
  const [name, setName] = useState(""); const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, customer_name: name, customer_contact: contact }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const { orderId, productName, waNumber } = data.data;

      const productUrl = `${window.location.origin}/product/${productId}`;
      const msg = `Halo, saya sudah membuat pesanan #${orderId}.\n\nNama: ${name}\nProduk: ${productName}\nLink Produk: ${productUrl}\n\nMohon info untuk pembayaran. Terima kasih.`;

      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
      onClose();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
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

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mainImgIdx, setMainImgIdx] = useState(0);
  const [showOrderModal, setShowOrderModal] = useState(false);
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
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []));
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

  // Mouse events (desktop drag saat zoom)
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

  // Touch events
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

    // Double tap to zoom
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
      return;
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
      <style>{detailStyles}</style>

      {/* Navbar */}
      <header className="main-nav">
        <div className="container nav-content">
          <a href="/" className="nav-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://wmikyjdtklhvdrsfkqdq.supabase.co/storage/v1/object/public/dvintages/assets/logo.jpg" alt="DVINTAGES" className="header-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
          </ul>
        </div>
      </header>

      <main className="container product-detail-section">
        {loading ? (
          <div className="loading-container">⏳ Memuat detail produk...</div>
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
                {/* Dot indicator - hanya mobile */}
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
                    <div key={i} className={`thumbnail-item${i === mainImgIdx ? " active" : ""}`}
                      onClick={() => { setMainImgIdx(i); resetZoom(); }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`${product.name} ${i + 1}`}
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/60x60/222/f0f0f0?text=Err"; }} />
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
              <button className="product-detail-order-btn" disabled={isSoldOut}
                onClick={() => setShowOrderModal(true)}>
                {isSoldOut ? "Stok Habis" : "Pesan Sekarang"}
              </button>
            </div>
          </div>
        ) : null}
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

      {showOrderModal && product && (
        <OrderModal productId={product.id} onClose={() => setShowOrderModal(false)} />
      )}
    </>
  );
}

const detailStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { overflow-x: hidden; max-width: 100vw; }
  body { background-color: var(--bg-color); color: var(--text-color); font-family: 'Montserrat', sans-serif; display: flex; flex-direction: column; min-height: 100vh; }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 16px; width: 100%; }

  /* ===== NAVBAR ===== */
  .main-nav { background-color: var(--nav-bg); backdrop-filter: blur(15px); padding: 10px 0; border-bottom: 2px solid var(--border-color); position: sticky; top: 0; z-index: 1000; box-shadow: 0 5px 20px var(--shadow-color); }
  .nav-content { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .nav-logo { display: flex; align-items: center; text-decoration: none; flex-shrink: 0; }
  .header-logo { height: 40px; width: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color-strong); transition: transform 0.3s; }
  .header-logo:hover { transform: rotate(360deg); }
  .nav-links { list-style: none; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 0; padding: 0; }
  .nav-links a { text-decoration: none; color: var(--text-color-secondary); font-weight: 700; transition: all 0.3s; padding: 6px 8px; border-radius: 6px; font-family: 'Anton', sans-serif; font-size: 1rem; letter-spacing: 1px; text-transform: uppercase; }
  .nav-links a:hover { color: var(--primary-color); }
  .dropdown { position: relative; }
  .dropdown-content { display: none; position: absolute; top: 120%; left: 50%; transform: translateX(-50%); background: var(--dropdown-bg); min-width: 160px; box-shadow: 0 12px 25px var(--shadow-color-strong); z-index: 1; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); }
  .dropdown-content a { color: var(--text-color-secondary); padding: 10px 16px; display: block; font-weight: 500; font-size: 0.95rem; cursor: pointer; }
  .dropdown:hover .dropdown-content { display: block; }
  .social-icons { display: flex; gap: 8px; align-items: center; }
  .social-icons a { color: var(--text-color-secondary); font-size: 1.1rem; transition: all 0.3s; padding: 6px; }
  .social-icons a:hover { transform: translateY(-3px); }
  .social-icons .instagram:hover { color: var(--social-instagram); }
  .social-icons .tiktok:hover { color: var(--social-tiktok); }
  .social-icons .whatsapp:hover { color: var(--social-whatsapp); }
  .theme-toggle-btn { background: transparent; border: none; color: var(--text-color-secondary); width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: all 0.3s; overflow: hidden; position: relative; flex-shrink: 0; }
  .theme-toggle-btn i { position: absolute; transition: transform 0.4s, opacity 0.4s; }
  .theme-toggle-btn .fa-sun { transform: translateY(150%); opacity: 0; }
  body.light-mode .theme-toggle-btn .fa-sun { transform: translateY(0); opacity: 1; }
  body.light-mode .theme-toggle-btn .fa-moon { transform: translateY(-150%); opacity: 0; }

  /* ===== PRODUCT DETAIL ===== */
  .product-detail-section { padding: 2rem 0; flex-grow: 1; }
  .product-detail-grid { display: grid; grid-template-columns: 1fr; gap: 0; max-width: 1000px; margin: 0 auto; background: var(--card-bg); border-radius: 12px; box-shadow: 0 10px 25px var(--shadow-color); border: 2px solid var(--border-color); overflow: hidden; }
  @media (min-width: 768px) { .product-detail-grid { grid-template-columns: 1.2fr 1fr; } }

  /* ===== IMAGE GALLERY ===== */
  .product-detail-image-gallery { position: relative; width: 100%; display: flex; flex-direction: column; }
  .main-product-image-wrapper { position: relative; width: 100%; aspect-ratio: 3 / 4; overflow: hidden; touch-action: none; }
  .main-product-image { width: 100%; height: 100%; object-fit: cover; display: block; user-select: none; -webkit-user-drag: none; will-change: transform; }
  .thumbnail-container { position: absolute; bottom: 10px; left: 10px; right: 10px; display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; padding: 5px 0; z-index: 10; scrollbar-width: none; -ms-overflow-style: none; }
  .thumbnail-container::-webkit-scrollbar { display: none; }
  .thumbnail-item { width: 52px; height: 52px; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: border-color 0.3s, transform 0.2s; flex-shrink: 0; }
  .thumbnail-item.active, .thumbnail-item:hover { border-color: var(--primary-color); transform: translateY(-2px); }
  .thumbnail-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .product-detail-sold-out { position: absolute; top: 15px; left: 15px; padding: 6px 12px; background: #fff; color: #1a1a1a; font-size: 0.85rem; font-weight: 700; border-radius: 6px; z-index: 15; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }

  /* ===== SWIPE DOTS ===== */
  .swipe-dots { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; pointer-events: none; }
  .swipe-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.45); transition: all 0.3s; }
  .swipe-dot.active { background: #fff; width: 18px; border-radius: 3px; }

  /* Mobile: thumbnail keluar dari overlay, dots tampil */
  @media (max-width: 767px) {
    .thumbnail-container { position: static; padding: 10px 12px; background: var(--card-bg); border-top: 1px solid var(--border-color); }
    .thumbnail-item { width: 60px; height: 60px; }
    .swipe-dots { display: flex; }
  }
  /* Desktop: dots disembunyikan */
  @media (min-width: 768px) {
    .swipe-dots { display: none; }
  }

  /* ===== PRODUCT INFO ===== */
  .product-detail-info { padding: 1.5rem; display: flex; flex-direction: column; }
  .product-detail-name { font-family: 'Anton', sans-serif; font-size: clamp(1.8rem, 5vw, 3rem); margin-bottom: 1rem; color: var(--text-color); line-height: 1.2; text-transform: uppercase; word-break: break-word; }
  .product-detail-price { font-family: 'Anton', sans-serif; font-size: clamp(1.3rem, 4vw, 2.2rem); color: var(--primary-color); margin-bottom: 1rem; letter-spacing: 1px; }
  .product-detail-stock { font-size: 0.95rem; color: var(--text-color-subtle); margin-bottom: 1.5rem; }
  .product-detail-description { font-size: 0.95rem; color: var(--text-color-secondary); line-height: 1.7; margin-bottom: 2rem; white-space: pre-wrap; flex-grow: 1; word-break: break-word; }
  .product-detail-order-btn { width: 100%; padding: 16px; background: var(--primary-color); color: var(--text-on-primary); border: none; border-radius: 10px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.3s; text-transform: uppercase; letter-spacing: 1px; margin-top: auto; }
  .product-detail-order-btn:hover { background: var(--text-color); color: var(--bg-color); transform: translateY(-3px); }
  .product-detail-order-btn:disabled { background: var(--disabled-bg); color: var(--disabled-text); cursor: not-allowed; transform: none; }

  /* ===== LOADING/ERROR ===== */
  .loading-container, .error-container { text-align: center; padding: 50px; font-size: 1rem; color: var(--text-color-secondary); }
  .error-container { color: #e53e3e; font-weight: bold; }

  /* ===== FOOTER ===== */
  footer { background-color: var(--footer-bg); color: var(--text-color-subtle); text-align: center; padding: 2rem 16px; font-size: 0.85rem; border-top: 2px solid var(--border-color); margin-top: auto; }
  footer p { margin-bottom: 10px; }
  .footer-social { margin-top: 20px; }
  .footer-social a { color: var(--text-color-subtle); font-size: 1.4rem; margin: 0 10px; transition: all 0.3s; display: inline-block; }
  .footer-social a:hover { color: var(--primary-color); transform: translateY(-3px); }

  /* ===== MODAL ===== */
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 2000; opacity: 0; pointer-events: none; transition: opacity 0.4s; padding: 16px; }
  .modal-overlay.visible { opacity: 1; pointer-events: auto; }
  .modal-content { background: var(--modal-bg); padding: 30px 24px; border-radius: 15px; max-width: 450px; width: 100%; text-align: center; transform: scale(0.9); transition: transform 0.4s cubic-bezier(0.18,0.89,0.32,1.28); box-shadow: 0 20px 50px var(--shadow-color-strong); border: 2px solid var(--border-color-strong); }
  .modal-overlay.visible .modal-content { transform: scale(1); }
  .modal-content h3 { font-family: 'Anton', sans-serif; text-transform: uppercase; font-size: 1.6rem; margin-bottom: 24px; }
  .order-form { text-align: left; }
  .form-group { margin-bottom: 20px; }
  .form-label { display: block; margin-bottom: 8px; font-weight: 700; color: var(--text-color); font-size: 0.9rem; }
  .form-input { width: 100%; padding: 13px; border: 2px solid var(--border-color-strong); border-radius: 8px; font-size: 1rem; background: var(--input-bg); color: var(--text-color); outline: none; transition: all 0.3s; }
  .form-input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px var(--primary-shadow); }
  .modal-buttons { display: flex; justify-content: space-between; gap: 12px; margin-top: 24px; }
  .modal-buttons button { flex: 1; padding: 12px 16px; border: 2px solid; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: all 0.3s; text-transform: uppercase; }
  .modal-btn-cancel { background: transparent; border-color: var(--disabled-bg); color: var(--text-color-secondary); }
  .modal-btn-submit { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-on-primary); }
  .modal-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ===== MOBILE RESPONSIVE ===== */
  @media (max-width: 600px) {
    .nav-content { flex-direction: row; align-items: center; }
    .nav-links { gap: 4px; }
    .nav-links > li > a, .nav-links > li.dropdown > a { font-size: 0.85rem; padding: 5px 6px; }
    .social-icons a { font-size: 1rem; padding: 5px; }
    .product-detail-info { padding: 1.25rem; }
    .modal-content { padding: 24px 18px; }
    .modal-content h3 { font-size: 1.4rem; }
    .modal-buttons { flex-direction: column; }
    .modal-buttons button { width: 100%; }
  }
`;