"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Product {
  id: number; name: string; description: string; price: number;
  image_url: string[]; status: string; inventory: number; category: string;
}

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
      const msg = `Halo, saya sudah membuat pesanan #${orderId}.\n\nNama: ${name}\nProduk: ${productName}\n\nMohon info untuk pembayaran. Terima kasih.`;
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

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved === "light") { setTheme("light"); document.body.classList.add("light-mode"); }
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
            <img src="/assets/logo.jpg" alt="DVINTAGES" className="header-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </a>
          <ul className="nav-links">
            <li><a href="/">Home</a></li>
            <li className="dropdown">
              <a href="javascript:void(0)" className="dropbtn">Products ▼</a>
              <div className="dropdown-content">
                {["all", "Baju", "Celana", "Jacket", "Vest", "Sepatu", "Tas"].map((cat) => (
                  <a key={cat} href={`/?category=${cat}`}>{cat === "all" ? "All" : cat}</a>
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
              <div className="main-product-image-wrapper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[mainImgIdx]}
                  alt={product.name}
                  className="main-product-image"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/1080x1440/222/f0f0f0?text=Error"; }}
                />
              </div>
              {images.length > 1 && (
                <div className="thumbnail-container">
                  {images.map((url, i) => (
                    <div key={i} className={`thumbnail-item${i === mainImgIdx ? " active" : ""}`}
                      onClick={() => setMainImgIdx(i)}>
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
  body { background-color: var(--bg-color); color: var(--text-color); font-family: 'Montserrat', sans-serif; display: flex; flex-direction: column; min-height: 100vh; }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
  .main-nav { background-color: var(--nav-bg); backdrop-filter: blur(15px); padding: 10px 0; border-bottom: 2px solid var(--border-color); position: sticky; top: 0; z-index: 1000; box-shadow: 0 5px 20px var(--shadow-color); }
  .nav-content { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
  .nav-logo { display: flex; align-items: center; text-decoration: none; }
  .header-logo { height: 45px; width: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color-strong); transition: transform 0.3s; }
  .header-logo:hover { transform: rotate(360deg); }
  .nav-links { list-style: none; display: flex; gap: 25px; align-items: center; }
  .nav-links a { text-decoration: none; color: var(--text-color-secondary); font-weight: 700; transition: all 0.3s; padding: 8px 12px; border-radius: 6px; font-family: 'Anton', sans-serif; font-size: 1.2rem; letter-spacing: 1px; text-transform: uppercase; }
  .nav-links a:hover { color: var(--primary-color); }
  .dropdown { position: relative; }
  .dropdown-content { display: none; position: absolute; top: 120%; left: 50%; transform: translateX(-50%); background: var(--dropdown-bg); min-width: 200px; box-shadow: 0 12px 25px var(--shadow-color-strong); z-index: 1; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); }
  .dropdown-content a { color: var(--text-color-secondary); padding: 12px 20px; display: block; font-weight: 500; font-size: 1rem; }
  .dropdown:hover .dropdown-content { display: block; }
  .social-icons { display: flex; gap: 15px; align-items: center; margin-left: 20px; }
  .social-icons a { color: var(--text-color-secondary); font-size: 1.3rem; transition: all 0.3s; padding: 8px; }
  .social-icons a:hover { transform: translateY(-3px); }
  .social-icons .instagram:hover { color: var(--social-instagram); }
  .social-icons .tiktok:hover { color: var(--social-tiktok); }
  .social-icons .whatsapp:hover { color: var(--social-whatsapp); }
  .theme-toggle-btn { background: transparent; border: none; color: var(--text-color-secondary); width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: all 0.3s; overflow: hidden; position: relative; margin-left: 15px; }
  .theme-toggle-btn i { position: absolute; transition: transform 0.4s, opacity 0.4s; }
  .theme-toggle-btn .fa-sun { transform: translateY(150%); opacity: 0; }
  body.light-mode .theme-toggle-btn .fa-sun { transform: translateY(0); opacity: 1; }
  body.light-mode .theme-toggle-btn .fa-moon { transform: translateY(-150%); opacity: 0; }
  .product-detail-section { padding: 4rem 0; flex-grow: 1; }
  .product-detail-grid { display: grid; grid-template-columns: 1fr; gap: 2rem; max-width: 1000px; margin: 0 auto; background: var(--card-bg); border-radius: 12px; box-shadow: 0 10px 25px var(--shadow-color); border: 2px solid var(--border-color); overflow: hidden; }
  @media (min-width: 768px) { .product-detail-grid { grid-template-columns: 1.2fr 1fr; } }
  .product-detail-image-gallery { position: relative; padding-top: 133.33%; overflow: hidden; }
  .main-product-image-wrapper { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  .main-product-image { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.3s; }
  .thumbnail-container { position: absolute; bottom: 10px; left: 10px; right: 10px; display: flex; gap: 8px; overflow-x: auto; padding: 5px 0; z-index: 10; }
  .thumbnail-item { width: 60px; height: 60px; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: border-color 0.3s, transform 0.2s; flex-shrink: 0; }
  .thumbnail-item.active, .thumbnail-item:hover { border-color: var(--primary-color); transform: translateY(-2px); }
  .thumbnail-item img { width: 100%; height: 100%; object-fit: cover; }
  .product-detail-sold-out { position: absolute; top: 15px; left: 15px; padding: 8px 15px; background: #fff; color: #1a1a1a; font-size: 0.9rem; font-weight: 700; border-radius: 6px; z-index: 15; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
  .product-detail-info { padding: 2rem; display: flex; flex-direction: column; }
  .product-detail-name { font-family: 'Anton', sans-serif; font-size: 3rem; margin-bottom: 1rem; color: var(--text-color); line-height: 1.2; text-transform: uppercase; }
  .product-detail-price { font-family: 'Anton', sans-serif; font-size: 2.2rem; color: var(--primary-color); margin-bottom: 1rem; letter-spacing: 1px; }
  .product-detail-stock { font-size: 1rem; color: var(--text-color-subtle); margin-bottom: 1.5rem; }
  .product-detail-description { font-size: 1rem; color: var(--text-color-secondary); line-height: 1.7; margin-bottom: 2rem; white-space: pre-wrap; flex-grow: 1; }
  .product-detail-order-btn { width: 100%; padding: 18px; background: var(--primary-color); color: var(--text-on-primary); border: none; border-radius: 10px; font-weight: 700; font-size: 1.1rem; cursor: pointer; transition: all 0.3s; text-transform: uppercase; letter-spacing: 1px; margin-top: auto; }
  .product-detail-order-btn:hover { background: var(--text-color); color: var(--bg-color); transform: translateY(-3px); }
  .product-detail-order-btn:disabled { background: var(--disabled-bg); color: var(--disabled-text); cursor: not-allowed; transform: none; }
  .loading-container, .error-container { text-align: center; padding: 50px; font-size: 1.2rem; color: var(--text-color-secondary); }
  .error-container { color: #e53e3e; font-weight: bold; }
  footer { background-color: var(--footer-bg); color: var(--text-color-subtle); text-align: center; padding: 2.5rem 20px; font-size: 0.9rem; border-top: 2px solid var(--border-color); margin-top: auto; }
  footer p { margin-bottom: 10px; }
  .footer-social { margin-top: 20px; }
  .footer-social a { color: var(--text-color-subtle); font-size: 1.6rem; margin: 0 12px; transition: all 0.3s; }
  .footer-social a:hover { color: var(--primary-color); transform: translateY(-3px); }
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 2000; opacity: 0; pointer-events: none; transition: opacity 0.4s; }
  .modal-overlay.visible { opacity: 1; pointer-events: auto; }
  .modal-content { background: var(--modal-bg); padding: 40px; border-radius: 15px; max-width: 450px; width: 90%; text-align: center; transform: scale(0.9); transition: transform 0.4s cubic-bezier(0.18,0.89,0.32,1.28); box-shadow: 0 20px 50px var(--shadow-color-strong); border: 2px solid var(--border-color-strong); }
  .modal-overlay.visible .modal-content { transform: scale(1); }
  .modal-content h3 { font-family: 'Anton', sans-serif; text-transform: uppercase; font-size: 2rem; margin-bottom: 30px; }
  .order-form { text-align: left; }
  .form-group { margin-bottom: 25px; }
  .form-label { display: block; margin-bottom: 10px; font-weight: 700; color: var(--text-color); }
  .form-input { width: 100%; padding: 15px; border: 2px solid var(--border-color-strong); border-radius: 8px; font-size: 1.1rem; background: var(--input-bg); color: var(--text-color); outline: none; transition: all 0.3s; }
  .form-input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px var(--primary-shadow); }
  .modal-buttons { display: flex; justify-content: space-between; gap: 20px; margin-top: 30px; }
  .modal-buttons button { flex-grow: 1; padding: 12px 20px; border: 2px solid; border-radius: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.3s; text-transform: uppercase; }
  .modal-btn-cancel { background: transparent; border-color: var(--disabled-bg); color: var(--text-color-secondary); }
  .modal-btn-submit { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-on-primary); }
  .modal-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  @media (max-width: 768px) {
    .product-detail-name { font-size: 2.5rem; }
    .product-detail-info { padding: 1.5rem; }
    .nav-content { flex-direction: column; gap: 15px; }
  }
  @media (max-width: 480px) {
    .product-detail-name { font-size: 2rem; }
    .product-detail-price { font-size: 1.5rem; }
  }
`;
