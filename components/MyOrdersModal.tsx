"use client";
import { useState } from "react";

interface Props {
  onClose: () => void;
}

interface Order {
  id: number;
  customer_name: string;
  total_price: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  courier: string;
  service: string;
  destination_label: string;
  shipping_cost: number;
  etd: string;
}

const ORDER_STATUS_COLOR: Record<string, string> = {
  Pending:      "#f6ad55",
  Dikonfirmasi: "#63b3ed",
  Selesai:      "#48bb78",
  Dibatalkan:   "#fc8181",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending:      "Belum Dibayar",
  paid:         "Lunas",
  completed:    "Lunas",
  expired:      "Kadaluarsa",
  cancelled:    "Dibatalkan",
  not_required: "Via WhatsApp",
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  pending:      "#f6ad55",
  paid:         "#48bb78",
  completed:    "#48bb78",
  expired:      "#fc8181",
  cancelled:    "#fc8181",
  not_required: "#a0aec0",
};

export default function MyOrdersModal({ onClose }: Props) {
  const [contact, setContact] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [visible, setVisible] = useState(true);

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  async function handleSearch() {
    if (!contact.trim()) { setError("Masukkan nomor WhatsApp dulu"); return; }
    setLoading(true);
    setError("");
    setSearched(false);
    try {
      const res = await fetch(`/api/orders/my-orders?contact=${encodeURIComponent(contact.trim())}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setOrders(data.data);
      setSearched(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <>
      <style>{modalStyles}</style>
      <div className={`mo-overlay${visible ? " mo-visible" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="mo-modal" onClick={(e) => e.stopPropagation()}>

          <div className="mo-header">
            <h3 className="mo-title">📦 Cek Pesanan Saya</h3>
            <button className="mo-close" onClick={close}>✕</button>
          </div>

          <div className="mo-search-row">
            <input
              className="mo-input"
              type="tel"
              placeholder="Nomor WhatsApp, cth: 08123456789"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="mo-search-btn" onClick={handleSearch} disabled={loading}>
              {loading ? "..." : "Cari"}
            </button>
          </div>

          {error && <p className="mo-error">{error}</p>}

          {searched && orders.length === 0 && (
            <div className="mo-empty">
              <p>Tidak ada pesanan ditemukan untuk nomor ini.</p>
              <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>Pastikan nomor WA yang dipakai saat checkout sama persis.</p>
            </div>
          )}

          {orders.length > 0 && (
            <div className="mo-list">
              {orders.map((o) => (
                <a key={o.id} href={`/order/${o.id}`} className="mo-card">
                  <div className="mo-card-top">
                    <div>
                      <span className="mo-order-num">Pesanan #{o.id}</span>
                      <span className="mo-date">{fmtDate(o.created_at)}</span>
                    </div>
                    <span
                      className="mo-status-badge"
                      style={{ color: ORDER_STATUS_COLOR[o.order_status] || "#a0aec0" }}
                    >
                      {o.order_status}
                    </span>
                  </div>

                  <div className="mo-card-mid">
                    <span className="mo-name">{o.customer_name}</span>
                    {o.destination_label && (
                      <span className="mo-dest">→ {o.destination_label.split(",")[0]}</span>
                    )}
                  </div>

                  <div className="mo-card-bot">
                    <span className="mo-total">Rp {fmt(Number(o.total_price))}</span>
                    <span
                      className="mo-pay-status"
                      style={{ color: PAYMENT_STATUS_COLOR[o.payment_status] || "#a0aec0" }}
                    >
                      {PAYMENT_STATUS_LABEL[o.payment_status] || o.payment_status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

const modalStyles = `
  .mo-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    z-index: 2000; padding: 16px;
    opacity: 0; transition: opacity 0.3s;
  }
  .mo-overlay.mo-visible { opacity: 1; }
  .mo-modal {
    background: var(--modal-bg, #1a1a1a);
    border: 2px solid var(--border-color, #333);
    border-radius: 16px;
    width: 100%; max-width: 480px;
    max-height: 85vh;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .mo-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 18px 20px 0;
    flex-shrink: 0;
  }
  .mo-title {
    font-family: 'Anton', sans-serif;
    font-size: 1.1rem; letter-spacing: 1px;
    text-transform: uppercase; margin: 0;
    color: var(--text-color);
  }
  .mo-close {
    background: transparent; border: none;
    color: var(--text-color-secondary, #aaa);
    font-size: 1rem; cursor: pointer; padding: 4px 8px;
    border-radius: 6px; transition: all 0.2s;
  }
  .mo-close:hover { color: var(--text-color); background: var(--border-color, #333); }
  .mo-search-row {
    display: flex; gap: 8px;
    padding: 16px 20px;
    flex-shrink: 0;
  }
  .mo-input {
    flex: 1; padding: 11px 14px;
    border: 2px solid var(--border-color, #444);
    border-radius: 8px;
    background: var(--bg-color, #111);
    color: var(--text-color);
    font-size: 0.9rem; outline: none;
    transition: border-color 0.2s;
  }
  .mo-input:focus { border-color: var(--primary-color, #667eea); }
  .mo-search-btn {
    padding: 11px 20px;
    background: var(--primary-color, #667eea);
    color: #fff; border: none; border-radius: 8px;
    font-weight: 700; font-size: 0.9rem;
    cursor: pointer; transition: filter 0.2s;
    white-space: nowrap;
  }
  .mo-search-btn:hover:not(:disabled) { filter: brightness(1.1); }
  .mo-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .mo-error {
    color: #fc8181; font-size: 0.85rem;
    padding: 0 20px 12px; margin: 0;
    flex-shrink: 0;
  }
  .mo-empty {
    text-align: center; padding: 32px 20px;
    color: var(--text-color-secondary, #aaa);
    font-size: 0.9rem; flex-shrink: 0;
  }
  .mo-list {
    overflow-y: auto; padding: 0 20px 20px;
    display: flex; flex-direction: column; gap: 10px;
    flex: 1;
  }
  .mo-list::-webkit-scrollbar { width: 4px; }
  .mo-list::-webkit-scrollbar-track { background: transparent; }
  .mo-list::-webkit-scrollbar-thumb { background: var(--border-color, #444); border-radius: 4px; }
  .mo-card {
    display: block; text-decoration: none;
    background: var(--bg-color, #111);
    border: 1.5px solid var(--border-color, #333);
    border-radius: 10px; padding: 14px;
    transition: all 0.2s; color: inherit;
  }
  .mo-card:hover { border-color: var(--primary-color, #667eea); transform: translateY(-1px); }
  .mo-card-top {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 8px;
  }
  .mo-order-num {
    display: block; font-weight: 700;
    font-size: 0.9rem; color: var(--text-color);
  }
  .mo-date {
    display: block; font-size: 0.75rem;
    color: var(--text-color-secondary, #aaa);
    margin-top: 2px;
  }
  .mo-status-badge {
    font-size: 0.78rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .mo-card-mid {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 10px; flex-wrap: wrap;
  }
  .mo-name { font-size: 0.85rem; color: var(--text-color); }
  .mo-dest { font-size: 0.8rem; color: var(--text-color-secondary, #aaa); }
  .mo-card-bot {
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid var(--border-color, #333);
    padding-top: 10px;
  }
  .mo-total {
    font-weight: 700; font-size: 0.95rem;
    color: var(--primary-color, #667eea);
  }
  .mo-pay-status { font-size: 0.8rem; font-weight: 700; }
`;