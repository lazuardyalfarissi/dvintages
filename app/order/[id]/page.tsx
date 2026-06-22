"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface OrderItem {
  product_name: string;
  quantity: number;
  price_at_purchase: number;
}

interface Order {
  id: number;
  customer_name: string;
  customer_contact: string;
  customer_address: string;
  total_price: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  courier: string;
  service: string;
  cost: number;
  etd: string;
  destination_label: string;
  order_items: OrderItem[];
}

const ORDER_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  Pending:     { label: "Menunggu Konfirmasi", color: "#f6ad55", bg: "rgba(246,173,85,0.12)" },
  Diproses:    { label: "Sedang Diproses",    color: "#63b3ed", bg: "rgba(99,179,237,0.12)" },
  Dikirim:     { label: "Dalam Pengiriman",   color: "#667eea", bg: "rgba(102,126,234,0.12)" },
  Selesai:     { label: "Selesai",            color: "#48bb78", bg: "rgba(72,187,120,0.12)" },
  Dibatalkan:  { label: "Dibatalkan",         color: "#fc8181", bg: "rgba(252,129,129,0.12)" },
};

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:      { label: "Belum Dibayar",  color: "#f6ad55" },
  completed:    { label: "Lunas",          color: "#48bb78" },
  expired:      { label: "Kadaluarsa",     color: "#fc8181" },
  cancelled:    { label: "Dibatalkan",     color: "#fc8181" },
  not_required: { label: "Via WhatsApp",   color: "#a0aec0" },
};

export default function OrderTrackPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/orders/track?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setOrder(d.data);
        else setError(d.message);
        setLoading(false);
      })
      .catch(() => {
        setError("Gagal memuat pesanan");
        setLoading(false);
      });
  }, [id]);

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const orderStatus = order ? (ORDER_STATUS_MAP[order.order_status] ?? { label: order.order_status, color: "#a0aec0", bg: "rgba(160,174,192,0.12)" }) : null;
  const payStatus   = order ? (PAYMENT_STATUS_MAP[order.payment_status] ?? { label: order.payment_status, color: "#a0aec0" }) : null;

  const subtotal = order
    ? order.order_items.reduce((s, i) => s + Number(i.price_at_purchase) * i.quantity, 0)
    : 0;

  return (
    <>
      <style>{pageStyles}</style>

      {/* Navbar */}
      <header className="ot-nav">
        <div className="ot-nav-inner">
          <a href="/" className="ot-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://wmikyjdtklhvdrsfkqdq.supabase.co/storage/v1/object/public/dvintages/assets/logo.jpg"
              alt="DVINTAGES"
              className="ot-logo-img"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="ot-logo-text">DVINTAGES</span>
          </a>
          <a href="/" className="ot-back-btn">← Kembali ke Toko</a>
        </div>
      </header>

      <main className="ot-main">
        {loading && (
          <div className="ot-center">
            <div className="ot-spinner" />
            <p>Memuat status pesanan...</p>
          </div>
        )}

        {!loading && error && (
          <div className="ot-center">
            <div className="ot-error-icon">!</div>
            <h2>Pesanan tidak ditemukan</h2>
            <p style={{ color: "var(--text-color-secondary, #aaa)", marginTop: 8 }}>{error}</p>
            <a href="/" className="ot-btn-primary" style={{ marginTop: 24 }}>Kembali ke Toko</a>
          </div>
        )}

        {!loading && !error && order && (
          <div className="ot-container">

            {/* Header order */}
            <div className="ot-header-card">
              <div className="ot-header-top">
                <div>
                  <p className="ot-order-label">Nomor Pesanan</p>
                  <h1 className="ot-order-id">#{order.id}</h1>
                </div>
                <div
                  className="ot-status-badge"
                  style={{ color: orderStatus!.color, background: orderStatus!.bg, borderColor: orderStatus!.color + "44" }}
                >
                  {orderStatus!.label}
                </div>
              </div>
              <p className="ot-order-date">Dipesan {fmtDate(order.created_at)}</p>
            </div>

            <div className="ot-grid">

              {/* Kolom kiri */}
              <div className="ot-left">

                {/* Items */}
                <div className="ot-card">
                  <h2 className="ot-card-title">Item Pesanan</h2>
                  <div className="ot-items">
                    {order.order_items.map((item, i) => (
                      <div key={i} className="ot-item-row">
                        <div className="ot-item-info">
                          <span className="ot-item-name">{item.product_name}</span>
                          <span className="ot-item-qty">×{item.quantity}</span>
                        </div>
                        <span className="ot-item-price">
                          Rp {fmt(Number(item.price_at_purchase) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="ot-divider" />
                  <div className="ot-total-rows">
                    <div className="ot-total-row">
                      <span>Subtotal produk</span>
                      <span>Rp {fmt(subtotal)}</span>
                    </div>
                    {order.cost > 0 && (
                      <div className="ot-total-row">
                        <span>Ongkos kirim ({order.courier})</span>
                        <span>Rp {fmt(Number(order.cost))}</span>
                      </div>
                    )}
                    <div className="ot-total-row grand">
                      <span>Total</span>
                      <strong>Rp {fmt(Number(order.total_price))}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Kolom kanan */}
              <div className="ot-right">

                {/* Status pembayaran */}
                <div className="ot-card">
                  <h2 className="ot-card-title">Pembayaran</h2>
                  <div className="ot-info-rows">
                    <div className="ot-info-row">
                      <span className="ot-info-label">Metode</span>
                      <span className="ot-info-value">
                        {order.payment_method === "pakasir" ? "QRIS / Virtual Account" : "Chat WhatsApp"}
                      </span>
                    </div>
                    <div className="ot-info-row">
                      <span className="ot-info-label">Status</span>
                      <span className="ot-payment-badge" style={{ color: payStatus!.color }}>
                        {payStatus!.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info pengiriman */}
                <div className="ot-card">
                  <h2 className="ot-card-title">Pengiriman</h2>
                  <div className="ot-info-rows">
                    <div className="ot-info-row">
                      <span className="ot-info-label">Tujuan</span>
                      <span className="ot-info-value">{order.destination_label}</span>
                    </div>
                    <div className="ot-info-row">
                      <span className="ot-info-label">Kurir</span>
                      <span className="ot-info-value">{order.courier} – {order.service}</span>
                    </div>
                    {order.etd && (
                      <div className="ot-info-row">
                        <span className="ot-info-label">Estimasi</span>
                        <span className="ot-info-value">
                          {order.etd}{!/hari|day/i.test(order.etd) ? " hari" : ""}
                        </span>
                      </div>
                    )}
                    <div className="ot-info-row">
                      <span className="ot-info-label">Ongkir</span>
                      <span className="ot-info-value">Rp {fmt(Number(order.cost))}</span>
                    </div>
                  </div>
                </div>

                {/* Info pembeli */}
                <div className="ot-card">
                  <h2 className="ot-card-title">Detail Penerima</h2>
                  <div className="ot-info-rows">
                    <div className="ot-info-row">
                      <span className="ot-info-label">Nama</span>
                      <span className="ot-info-value">{order.customer_name}</span>
                    </div>
                    <div className="ot-info-row">
                      <span className="ot-info-label">WhatsApp</span>
                      <span className="ot-info-value">{order.customer_contact}</span>
                    </div>
                    <div className="ot-info-row align-start">
                      <span className="ot-info-label">Alamat</span>
                      <span className="ot-info-value">{order.customer_address}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer aksi */}
            <div className="ot-footer-actions">
              <a href="/" className="ot-btn-outline">← Lanjut Belanja</a>
              {order.payment_method === "wa_manual" && order.order_status !== "Selesai" && order.order_status !== "Dibatalkan" && (
                <a
                  href={`https://wa.me/6285774497521?text=${encodeURIComponent(`Halo, saya ingin menanyakan status pesanan #${order.id} atas nama ${order.customer_name}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ot-btn-wa"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Hubungi Admin
                </a>
              )}
            </div>

          </div>
        )}
      </main>

      <footer className="ot-foot">
        <p>© {new Date().getFullYear()} DVINTAGES · Made by Lazuardy Al Farissi</p>
      </footer>
    </>
  );
}

const pageStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body { background-color: var(--bg-color); color: var(--text-color); font-family: 'Montserrat', sans-serif; margin: 0; min-height: 100vh; display: flex; flex-direction: column; }

  .ot-nav { background-color: var(--nav-bg); backdrop-filter: blur(15px); border-bottom: 2px solid var(--border-color); position: sticky; top: 0; z-index: 100; padding: 10px 0; }
  .ot-nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 16px; display: flex; justify-content: space-between; align-items: center; }
  .ot-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .ot-logo-img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color-strong); }
  .ot-logo-text { font-family: 'Anton', sans-serif; font-size: 1.2rem; letter-spacing: 2px; color: var(--text-color); text-transform: uppercase; }
  .ot-back-btn { font-size: 0.85rem; font-weight: 700; color: var(--text-color-secondary, #aaa); text-decoration: none; padding: 6px 12px; border: 1.5px solid var(--border-color, #333); border-radius: 8px; transition: all 0.25s; }
  .ot-back-btn:hover { color: var(--text-color); border-color: var(--text-color); }

  .ot-main { flex: 1; padding: 32px 16px; }

  .ot-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 40vh; text-align: center; gap: 12px; }
  .ot-spinner { width: 36px; height: 36px; border: 3px solid var(--border-color, #333); border-top-color: var(--primary-color, #667eea); border-radius: 50%; animation: ot-spin 0.8s linear infinite; }
  @keyframes ot-spin { to { transform: rotate(360deg); } }
  .ot-error-icon { width: 52px; height: 52px; border-radius: 50%; background: rgba(252,129,129,0.12); border: 2px solid #fc8181; color: #fc8181; font-size: 1.4rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }

  .ot-container { max-width: 900px; margin: 0 auto; }

  .ot-header-card { background: var(--card-bg); border: 2px solid var(--border-color); border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; }
  .ot-header-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
  .ot-order-label { font-size: 0.78rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-color-secondary, #aaa); margin: 0 0 4px; }
  .ot-order-id { font-family: 'Anton', sans-serif; font-size: 2rem; letter-spacing: 1px; margin: 0; color: var(--text-color); }
  .ot-status-badge { font-size: 0.82rem; font-weight: 700; padding: 6px 14px; border-radius: 20px; border: 1.5px solid; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
  .ot-order-date { font-size: 0.83rem; color: var(--text-color-secondary, #aaa); margin: 10px 0 0; }

  .ot-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 680px) { .ot-grid { grid-template-columns: 1.3fr 1fr; } }

  .ot-left, .ot-right { display: flex; flex-direction: column; gap: 16px; }

  .ot-card { background: var(--card-bg); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 18px 20px; }
  .ot-card-title { font-family: 'Anton', sans-serif; font-size: 0.95rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-color); margin: 0 0 14px; }

  .ot-items { display: flex; flex-direction: column; gap: 10px; }
  .ot-item-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .ot-item-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
  .ot-item-name { font-size: 0.88rem; font-weight: 600; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ot-item-qty { font-size: 0.8rem; color: var(--text-color-secondary, #aaa); white-space: nowrap; }
  .ot-item-price { font-size: 0.88rem; font-weight: 700; color: var(--primary-color, #667eea); white-space: nowrap; }

  .ot-divider { border: none; border-top: 1px solid var(--border-color); margin: 14px 0; }

  .ot-total-rows { display: flex; flex-direction: column; gap: 8px; }
  .ot-total-row { display: flex; justify-content: space-between; font-size: 0.88rem; color: var(--text-color-secondary, #aaa); }
  .ot-total-row.grand { font-size: 1rem; color: var(--text-color); border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 2px; }
  .ot-total-row.grand strong { color: var(--primary-color, #667eea); font-size: 1.1rem; }

  .ot-info-rows { display: flex; flex-direction: column; gap: 10px; }
  .ot-info-row { display: flex; justify-content: space-between; gap: 12px; font-size: 0.87rem; }
  .ot-info-row.align-start { align-items: flex-start; }
  .ot-info-label { color: var(--text-color-secondary, #aaa); white-space: nowrap; flex-shrink: 0; }
  .ot-info-value { color: var(--text-color); text-align: right; word-break: break-word; }
  .ot-payment-badge { font-weight: 700; }

  .ot-footer-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; margin-top: 24px; }
  .ot-btn-outline { padding: 11px 20px; border: 2px solid var(--border-color, #444); border-radius: 10px; font-size: 0.88rem; font-weight: 700; color: var(--text-color-secondary, #aaa); text-decoration: none; transition: all 0.25s; }
  .ot-btn-outline:hover { border-color: var(--text-color); color: var(--text-color); }
  .ot-btn-wa { display: flex; align-items: center; gap: 8px; padding: 11px 20px; background: #25d366; border: 2px solid #25d366; border-radius: 10px; font-size: 0.88rem; font-weight: 700; color: #fff; text-decoration: none; transition: all 0.25s; }
  .ot-btn-wa:hover { background: #1ebe5d; border-color: #1ebe5d; }
  .ot-btn-primary { padding: 11px 24px; background: var(--primary-color, #667eea); border: none; border-radius: 10px; font-size: 0.9rem; font-weight: 700; color: #fff; text-decoration: none; cursor: pointer; }

  .ot-foot { text-align: center; padding: 20px 16px; border-top: 1.5px solid var(--border-color); font-size: 0.82rem; color: var(--text-color-secondary, #aaa); }
`;