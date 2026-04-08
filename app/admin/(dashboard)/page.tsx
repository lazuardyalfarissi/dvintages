"use client";
import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

type Tab = "add-product" | "products" | "orders" | "banners" | "whatsapp" | "sales-report";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Product {
  id: number; name: string; description: string; price: number;
  image_url: string[]; status: string; inventory: number; category: string;
}
interface OrderItem { product_name: string; quantity: number; }
interface Order {
  id: number; customer_name: string; customer_contact: string;
  total_price: number; order_status: string; created_at: string;
  order_items: OrderItem[];
}
interface Banner { id: number; image_url: string; title: string; description: string; }
interface MonthlySale { sale_month: string; monthly_revenue: number; monthly_orders: number; }

// ─── Notification ─────────────────────────────────────────────────────────────
function useNotification() {
  const [notif, setNotif] = useState({ msg: "", type: "", show: false });
  const show = (msg: string, type: "success" | "error" = "success") => {
    setNotif({ msg, type, show: true });
    setTimeout(() => setNotif((n) => ({ ...n, show: false })), 3000);
  };
  return { notif, show };
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="modal-overlay visible">
      <div className="modal-content">
        <h3>{title}</h3>
        <p style={{ color: "#e0e0e0", marginBottom: 25 }}>{message}</p>
        <div className="modal-buttons">
          <button className="btn-primary" style={{ background: "#4a5568" }} onClick={onCancel}>Batal</button>
          <button className="btn-danger" onClick={onConfirm}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const { notif, show: showNotif } = useNotification();
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "", description: "", price: "", inventory: "10",
    category: "Baju", status: "active",
  });
  const [retainedImages, setRetainedImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const productFileRef = useRef<HTMLInputElement>(null);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);

  // Banners state
  const [banners, setBanners] = useState<Banner[]>([]);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerForm, setBannerForm] = useState({ title: "", description: "" });
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  // WhatsApp
  const [waNumber, setWaNumber] = useState("");

  // Sales Report
  const [salesData, setSalesData] = useState<{
    summary: { total_revenue: number; total_orders: number };
    monthly_sales: MonthlySale[];
  } | null>(null);

  // ── Tab switching ──────────────────────────────────────────────────────────
  function switchTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "orders") loadOrders();
    else if (tab === "products") loadProducts();
    else if (tab === "banners") { loadBanners(); resetBannerForm(); }
    else if (tab === "add-product") resetProductForm();
    else if (tab === "whatsapp") loadWaNumber();
    else if (tab === "sales-report") loadSalesReport();
  }

  useEffect(() => { loadOrders(); }, []);

  // ── API helpers ────────────────────────────────────────────────────────────
  async function apiFetch(url: string, options?: RequestInit) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Terjadi kesalahan");
    return data;
  }

  // ── Products ───────────────────────────────────────────────────────────────
  async function loadProducts() {
    try {
      const data = await apiFetch("/api/products?admin=1");
      setProducts(data.data);
    } catch (e: any) { showNotif(e.message, "error"); }
  }

  function resetProductForm() {
    setEditingProduct(null);
    setProductForm({ name: "", description: "", price: "", inventory: "10", category: "Baju", status: "active" });
    setRetainedImages([]);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    if (productFileRef.current) productFileRef.current.value = "";
  }

  function handleProductFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setNewImageFiles((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setNewImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }

  function removeRetainedImage(url: string) {
    setRetainedImages((prev) => prev.filter((u) => u !== url));
  }
  function removeNewImage(idx: number) {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append("name", productForm.name);
      fd.append("description", productForm.description);
      fd.append("price", productForm.price.replace(/\./g, ""));
      fd.append("inventory", productForm.inventory);
      fd.append("category", productForm.category);
      fd.append("status", productForm.status);
      fd.append("retained_image_urls", JSON.stringify(retainedImages));
      newImageFiles.forEach((f) => fd.append("images", f));

      if (editingProduct) {
        await apiFetch(`/api/products/${editingProduct.id}`, { method: "PUT", body: fd });
        showNotif("Produk berhasil diupdate!");
      } else {
        await apiFetch("/api/products", { method: "POST", body: fd });
        showNotif("Produk berhasil ditambahkan!");
      }
      resetProductForm();
      if (activeTab === "products") loadProducts();
    } catch (e: any) { showNotif(e.message, "error"); }
  }

  function editProduct(p: Product) {
    setEditingProduct(p);
    setProductForm({
      name: p.name, description: p.description || "",
      price: new Intl.NumberFormat("id-ID").format(p.price),
      inventory: String(p.inventory), category: p.category, status: p.status,
    });
    setRetainedImages(p.image_url);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    if (productFileRef.current) productFileRef.current.value = "";
    setActiveTab("add-product");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteProduct(p: Product) {
    setConfirm({
      title: "Hapus Produk",
      message: `Yakin ingin menghapus produk "${p.name}"?`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await apiFetch(`/api/products/${p.id}`, { method: "DELETE" });
          showNotif("Produk berhasil dihapus!");
          loadProducts();
        } catch (e: any) { showNotif(e.message, "error"); }
      },
    });
  }

  // ── Orders ─────────────────────────────────────────────────────────────────
  async function loadOrders() {
    try {
      const data = await apiFetch("/api/orders");
      setOrders(data.data);
    } catch (e: any) { showNotif(e.message, "error"); }
  }

  async function updateOrderStatus(id: number, status: string) {
    try {
      await apiFetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      showNotif("Status pesanan berhasil diupdate!");
      setEditingStatusId(null);
      loadOrders();
    } catch (e: any) { showNotif(e.message, "error"); }
  }

  function deleteOrder(o: Order) {
    setConfirm({
      title: "Hapus Pesanan",
      message: `Yakin ingin menghapus pesanan dari "${o.customer_name}" (#${o.id})?`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await apiFetch(`/api/orders/${o.id}`, { method: "DELETE" });
          showNotif("Pesanan berhasil dihapus!");
          loadOrders();
        } catch (e: any) { showNotif(e.message, "error"); }
      },
    });
  }

  // ── Banners ────────────────────────────────────────────────────────────────
  async function loadBanners() {
    try {
      const data = await apiFetch("/api/banners");
      setBanners(data.data);
    } catch (e: any) { showNotif(e.message, "error"); }
  }

  function resetBannerForm() {
    setEditingBanner(null);
    setBannerForm({ title: "", description: "" });
    setBannerFile(null);
    if (bannerFileRef.current) bannerFileRef.current.value = "";
  }

  async function handleBannerSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append("title", bannerForm.title);
      fd.append("description", bannerForm.description);
      if (bannerFile) fd.append("image", bannerFile);
      if (editingBanner) {
        fd.append("id", String(editingBanner.id));
        fd.append("existing_image_url", editingBanner.image_url);
        await apiFetch("/api/banners", { method: "PUT", body: fd });
        showNotif("Banner berhasil diupdate!");
      } else {
        await apiFetch("/api/banners", { method: "POST", body: fd });
        showNotif("Banner berhasil ditambahkan!");
      }
      resetBannerForm();
      loadBanners();
    } catch (e: any) { showNotif(e.message, "error"); }
  }

  function editBanner(b: Banner) {
    setEditingBanner(b);
    setBannerForm({ title: b.title || "", description: b.description || "" });
    setBannerFile(null);
    if (bannerFileRef.current) bannerFileRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteBanner(b: Banner) {
    setConfirm({
      title: "Hapus Banner",
      message: `Yakin ingin menghapus banner "${b.title || "ini"}"?`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await apiFetch(`/api/banners?id=${b.id}`, { method: "DELETE" });
          showNotif("Banner berhasil dihapus!");
          loadBanners();
        } catch (e: any) { showNotif(e.message, "error"); }
      },
    });
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  async function loadWaNumber() {
    try {
      const data = await apiFetch("/api/settings?key=whatsapp_number");
      setWaNumber(data.data || "");
    } catch { setWaNumber(""); }
  }

  async function saveWaNumber() {
    try {
      await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "whatsapp_number", value: waNumber }),
      });
      showNotif("Nomor WhatsApp berhasil disimpan!");
    } catch (e: any) { showNotif(e.message, "error"); }
  }

  // ── Sales Report ───────────────────────────────────────────────────────────
  async function loadSalesReport() {
    try {
      const data = await apiFetch("/api/sales-report");
      setSalesData(data.data);
    } catch (e: any) { showNotif(e.message, "error"); }
  }

  // ── Price formatting ───────────────────────────────────────────────────────
  function formatPrice(val: string) {
    const num = val.replace(/\D/g, "");
    return num ? new Intl.NumberFormat("id-ID").format(Number(num)) : "";
  }

  const statusColors: Record<string, string> = {
    Pending: "#f6ad55", Dikonfirmasi: "#63b3ed", Selesai: "#48bb78", Dibatalkan: "#e53e3e",
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{adminStyles}</style>

      <div className="container">
        {/* Header */}
        <header className="admin-header">
          <div className="header-top">
            <h1 className="header-title">Dvintages Dashboard</h1>
            <button className="logout-btn" onClick={() => signOut({ callbackUrl: "/admin/login" })}>
              Logout
            </button>
          </div>
          <nav className="nav-tabs">
            {(["add-product", "products", "orders", "banners", "whatsapp", "sales-report"] as Tab[]).map((tab) => {
              const labels: Record<Tab, string> = {
                "add-product": "➕ Tambah Produk", products: "📦 Produk",
                orders: "🧾 Pesanan", banners: "🖼️ Banner",
                whatsapp: "📞 WhatsApp", "sales-report": "📈 Laporan",
              };
              return (
                <button key={tab} className={`nav-tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => switchTab(tab)}>
                  {labels[tab]}
                </button>
              );
            })}
          </nav>
        </header>

        <main>
          {/* ── TAB: Add/Edit Product ── */}
          {activeTab === "add-product" && (
            <section className="admin-form">
              <h3 className="form-title">{editingProduct ? "✏️ Edit Produk" : "➕ Tambah Produk"}</h3>
              <form onSubmit={handleProductSubmit}>
                <div className="form-group">
                  <label className="form-label">Nama Produk</label>
                  <input className="form-input" value={productForm.name} required
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi</label>
                  <textarea className="form-input" rows={4} value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga (Rp)</label>
                  <input className="form-input" value={productForm.price} required placeholder="100.000"
                    onChange={(e) => setProductForm({ ...productForm, price: formatPrice(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stok</label>
                  <input className="form-input" type="number" value={productForm.inventory} required
                    onChange={(e) => setProductForm({ ...productForm, inventory: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-input" value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>
                    <option value="Baju">Baju</option>
                    <option value="Celana">Celana</option>
                    <option value="Jacket">Jacket</option>
                    <option value="Vest">Vest</option>
                    <option value="Sepatu">Sepatu</option>
                    <option value="Tas">Tas</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Gambar Produk</label>
                  <input type="file" className="form-input" accept="image/*" multiple ref={productFileRef}
                    onChange={handleProductFileChange} />
                  <div className="image-previews">
                    {retainedImages.length === 0 && newImagePreviews.length === 0 && (
                      <p style={{ color: "#aaa", fontSize: "0.9em" }}>Tidak ada gambar.</p>
                    )}
                    {retainedImages.map((url) => (
                      <div key={url} className="preview-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="retained" />
                        <button type="button" className="remove-img-btn" onClick={() => removeRetainedImage(url)}>×</button>
                      </div>
                    ))}
                    {newImagePreviews.map((src, i) => (
                      <div key={i} className="preview-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`new-${i}`} />
                        <button type="button" className="remove-img-btn" onClick={() => removeNewImage(i)}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={productForm.status}
                    onChange={(e) => setProductForm({ ...productForm, status: e.target.value })}>
                    <option value="active">Aktif</option>
                    <option value="inactive">Non-aktif</option>
                    <option value="sold_out">Terjual</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <button type="submit" className="btn-primary">💾 Simpan Produk</button>
                  {editingProduct && (
                    <button type="button" className="btn-primary" style={{ background: "#4a5568" }}
                      onClick={resetProductForm}>Batal Edit</button>
                  )}
                </div>
              </form>
            </section>
          )}

          {/* ── TAB: Products List ── */}
          {activeTab === "products" && (
            <>
              <h2 className="section-title">📦 Daftar Produk</h2>
              <div className="list-container">
                {products.length === 0 ? (
                  <div className="empty-state">Belum ada produk.</div>
                ) : products.map((p) => (
                  <div key={p.id} className="list-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image_url[0] || "https://placehold.co/50x50/222/f0f0f0?text=N/A"}
                      alt={p.name} className="list-img"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/50x50/222/f0f0f0?text=Err"; }} />
                    <div className="list-info">
                      <strong>{p.name}</strong>
                      <small>Rp {new Intl.NumberFormat("id-ID").format(p.price)} · Stok: {p.inventory} · {p.category}</small>
                    </div>
                    <div className="list-actions">
                      <span style={{ color: p.status === "active" ? "#48bb78" : p.status === "sold_out" ? "#f6ad55" : "#f56565", fontSize: "0.8rem", fontWeight: 700 }}>
                        {p.status}
                      </span>
                      <button className="btn-primary btn-sm" onClick={() => editProduct(p)}>✏️</button>
                      <button className="btn-danger btn-sm" onClick={() => deleteProduct(p)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── TAB: Orders ── */}
          {activeTab === "orders" && (
            <>
              <h2 className="section-title">🧾 Daftar Pesanan</h2>
              <div className="table-responsive">
                {orders.length === 0 ? (
                  <div className="empty-state">Belum ada pesanan masuk.</div>
                ) : (
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>ID</th><th>Pelanggan</th><th>Produk</th>
                        <th>Total</th><th>Status</th><th>Tanggal</th><th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td data-label="ID">#{o.id}</td>
                          <td data-label="Pelanggan">
                            {o.customer_name}<br />
                            <small><a href={`https://wa.me/${o.customer_contact}`} target="_blank" rel="noreferrer">{o.customer_contact}</a></small>
                          </td>
                          <td data-label="Produk">
                            {o.order_items?.map((i, idx) => (
                              <span key={idx}>{i.product_name} ({i.quantity})<br /></span>
                            ))}
                          </td>
                          <td data-label="Total">Rp {new Intl.NumberFormat("id-ID").format(o.total_price)}</td>
                          <td data-label="Status">
                            {editingStatusId === o.id ? (
                              <select className="form-input" style={{ fontSize: "0.85rem", padding: "0.4rem" }}
                                defaultValue={o.order_status}
                                onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                                onBlur={() => setEditingStatusId(null)}>
                                <option value="Pending">Pending</option>
                                <option value="Dikonfirmasi">Dikonfirmasi</option>
                                <option value="Selesai">Selesai</option>
                                <option value="Dibatalkan">Dibatalkan</option>
                              </select>
                            ) : (
                              <span className="status-badge" style={{ background: statusColors[o.order_status] || "#444", cursor: "pointer" }}
                                onClick={() => setEditingStatusId(o.id)}>
                                {o.order_status}
                              </span>
                            )}
                          </td>
                          <td data-label="Tanggal">{new Date(o.created_at).toLocaleString("id-ID")}</td>
                          <td data-label="Aksi">
                            <button className="btn-danger btn-sm" onClick={() => deleteOrder(o)}>Hapus</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ── TAB: Banners ── */}
          {activeTab === "banners" && (
            <>
              <section className="admin-form">
                <h3 className="form-title">{editingBanner ? "✏️ Edit Banner" : "➕ Tambah Banner"}</h3>
                <form onSubmit={handleBannerSubmit}>
                  <div className="form-group">
                    <label className="form-label">Judul Banner</label>
                    <input className="form-input" value={bannerForm.title}
                      onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deskripsi</label>
                    <textarea className="form-input" rows={3} value={bannerForm.description}
                      onChange={(e) => setBannerForm({ ...bannerForm, description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gambar Banner {editingBanner && "(kosongkan jika tidak ganti)"}</label>
                    <input type="file" className="form-input" accept="image/*" ref={bannerFileRef}
                      onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
                  </div>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button type="submit" className="btn-primary">💾 Simpan Banner</button>
                    {editingBanner && (
                      <button type="button" className="btn-primary" style={{ background: "#4a5568" }}
                        onClick={resetBannerForm}>Batal Edit</button>
                    )}
                  </div>
                </form>
              </section>
              <h2 className="section-title">🖼️ Daftar Banner</h2>
              <div className="list-container">
                {banners.length === 0 ? (
                  <div className="empty-state">Belum ada banner.</div>
                ) : banners.map((b) => (
                  <div key={b.id} className="list-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.image_url} alt={b.title} className="list-img"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/50x50/222/f0f0f0?text=Err"; }} />
                    <div className="list-info">
                      <strong>{b.title || "Tidak ada judul"}</strong>
                      <small>{b.description || "Tidak ada deskripsi"}</small>
                    </div>
                    <div className="list-actions">
                      <button className="btn-primary btn-sm" onClick={() => editBanner(b)}>✏️</button>
                      <button className="btn-danger btn-sm" onClick={() => deleteBanner(b)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── TAB: WhatsApp ── */}
          {activeTab === "whatsapp" && (
            <section className="admin-form">
              <h3 className="form-title">📱 Pengaturan WhatsApp</h3>
              <div className="form-group">
                <label className="form-label">Nomor WhatsApp</label>
                <input className="form-input" placeholder="628123456789" value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={saveWaNumber}>💾 Simpan Nomor</button>
            </section>
          )}

          {/* ── TAB: Sales Report ── */}
          {activeTab === "sales-report" && (
            <section className="admin-form">
              <h3 className="form-title">📈 Laporan Penjualan</h3>
              {!salesData ? (
                <div className="empty-state">⏳ Memuat laporan...</div>
              ) : salesData.summary.total_orders === 0 ? (
                <div className="empty-state">Belum ada data penjualan yang selesai.</div>
              ) : (
                <>
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <p style={{ fontSize: "1.5rem", color: "#48bb78", fontWeight: 700 }}>
                      Total Pendapatan: Rp {new Intl.NumberFormat("id-ID").format(salesData.summary.total_revenue)}
                    </p>
                    <p style={{ color: "#aaa" }}>Pesanan Selesai: {salesData.summary.total_orders}</p>
                  </div>
                  {salesData.monthly_sales.length > 0 && (
                    <table className="orders-table">
                      <thead>
                        <tr><th>Bulan</th><th>Pendapatan</th><th>Pesanan</th></tr>
                      </thead>
                      <tbody>
                        {salesData.monthly_sales.map((m) => (
                          <tr key={m.sale_month}>
                            <td>{m.sale_month}</td>
                            <td>Rp {new Intl.NumberFormat("id-ID").format(m.monthly_revenue)}</td>
                            <td>{m.monthly_orders}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Notification */}
      <div className={`notification ${notif.type} ${notif.show ? "show" : ""}`}>
        {notif.msg}
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.title} message={confirm.message}
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const adminStyles = `
  body { background-color: #1a1a1a; color: #f0f0f0; font-family: 'Inter', sans-serif; }
  .container { max-width: 1200px; margin: 0 auto; padding: 1rem; }
  .admin-header { background: #222; padding: 1.5rem; border-radius: 20px; border: 1px solid #333; margin-bottom: 2rem; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
  .header-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
  .header-title { font-size: 2rem; font-weight: 800; }
  .logout-btn { background: #e53e3e; color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer; text-decoration: none; }
  .logout-btn:hover { background: #c53030; }
  .nav-tabs { display: flex; gap: 0.5rem; border-top: 1px solid #333; padding-top: 1.5rem; margin-top: 1.5rem; overflow-x: auto; flex-wrap: wrap; }
  .nav-tab { padding: 0.75rem 1.5rem; background: #333; border: none; border-radius: 50px; color: #aaa; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.3s; white-space: nowrap; }
  .nav-tab.active, .nav-tab:hover { background: #667eea; color: white; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
  .section-title { text-align: center; margin-bottom: 2rem; font-size: 1.5rem; }
  .admin-form { background: #222; padding: 1.5rem; border-radius: 15px; margin-bottom: 2rem; border: 1px solid #333; }
  .form-title { font-size: 1.25rem; margin-bottom: 1.5rem; border-bottom: 1px solid #333; padding-bottom: 0.75rem; }
  .form-group { margin-bottom: 1.5rem; }
  .form-label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #aaa; }
  .form-input { width: 100%; padding: 0.75rem; border: 1px solid #444; border-radius: 8px; font-size: 1rem; background: #1a1a1a; color: #f0f0f0; outline: none; }
  .form-input:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
  .btn-primary { background: #667eea; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.3s, transform 0.2s; }
  .btn-primary:hover { background: #5a67d8; transform: translateY(-2px); }
  .btn-danger { background: #e53e3e; color: white; border: none; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: background 0.3s; }
  .btn-danger:hover { background: #c53030; }
  .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.8rem; }
  .list-container { background: #222; border-radius: 15px; overflow: hidden; border: 1px solid #333; }
  .list-item { display: grid; grid-template-columns: 60px 1fr auto; align-items: center; padding: 1rem; border-bottom: 1px solid #333; gap: 1rem; }
  .list-img { width: 50px; height: 50px; border-radius: 8px; object-fit: cover; }
  .list-info strong { display: block; font-size: 0.95rem; margin-bottom: 0.25rem; }
  .list-info small { font-size: 0.8rem; color: #aaa; }
  .list-actions { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end; }
  .empty-state { text-align: center; padding: 2.5rem; color: #aaa; }
  .image-previews { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; border: 1px dashed #444; padding: 10px; border-radius: 8px; min-height: 80px; align-items: center; background: #1a1a1a; }
  .preview-item { position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #555; }
  .preview-item img { width: 100%; height: 100%; object-fit: cover; }
  .remove-img-btn { position: absolute; top: 2px; right: 2px; background: rgba(229,62,62,0.85); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; }
  .table-responsive { overflow-x: auto; }
  .orders-table { width: 100%; border-collapse: collapse; }
  .orders-table th, .orders-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #333; font-size: 0.9rem; }
  .orders-table th { background: #2a2a2a; font-weight: 600; }
  .orders-table a { color: #667eea; text-decoration: none; }
  .status-badge { display: inline-block; padding: 0.3em 0.6em; border-radius: 5px; font-weight: 600; font-size: 0.85rem; color: white; }
  .notification { position: fixed; bottom: -100px; left: 50%; transform: translateX(-50%); padding: 1rem 1.5rem; border-radius: 8px; color: white; font-weight: 600; box-shadow: 0 4px 20px rgba(0,0,0,0.3); transition: bottom 0.5s ease-in-out; z-index: 2000; max-width: 90%; text-align: center; }
  .notification.show { bottom: 1rem; }
  .notification.success { background: #48bb78; }
  .notification.error { background: #e53e3e; }
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; opacity: 0; pointer-events: none; transition: opacity 0.4s; }
  .modal-overlay.visible { opacity: 1; pointer-events: auto; }
  .modal-content { background: #2d3748; padding: 35px; border-radius: 20px; max-width: 450px; text-align: center; box-shadow: 0 15px 30px rgba(0,0,0,0.6); }
  .modal-content h3 { font-size: 1.8rem; margin-bottom: 25px; }
  .modal-buttons { display: flex; justify-content: center; gap: 20px; margin-top: 30px; }
  .modal-buttons button { padding: 12px 25px; border: none; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; }
  @media (max-width: 480px) {
    .list-item { grid-template-columns: 1fr; text-align: center; }
    .list-actions { flex-direction: row; justify-content: center; }
  }
`;
