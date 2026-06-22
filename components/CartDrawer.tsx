"use client";
import { useCart } from "@/context/CartContext";

interface Props {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

// Inventory per product ID — diambil dari CartContext item (perlu tambah field)
// Solusi: kita fetch inventory dari API saat drawer dibuka, atau simpan di cart item

export default function CartDrawer({ open, onClose, onCheckout }: Props) {
  const { items, removeItem, updateQty, totalPrice, totalItems } = useCart();

  return (
    <>
      <style>{cartStyles}</style>
      <div className={`cart-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`cart-drawer${open ? " open" : ""}`}>
        <div className="cart-header">
          <h3>🛒 Keranjang ({totalItems})</h3>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        <div className="cart-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <p>🛍️ Keranjang kamu kosong</p>
              <small>Yuk tambahin produk dulu!</small>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="cart-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt={item.name} className="cart-item-img"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/60x60/222/f0f0f0?text=N/A"; }} />
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">
                    Rp {new Intl.NumberFormat("id-ID").format(item.price)}
                  </div>
                  <div className="cart-qty-control">
                    <button
                      onClick={() => updateQty(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >−</button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.id, item.quantity + 1)}
                      disabled={item.inventory !== undefined && item.quantity >= item.inventory}
                      title={item.inventory !== undefined && item.quantity >= item.inventory ? `Stok hanya ${item.inventory}` : ""}
                    >+</button>
                  </div>
                  {item.inventory !== undefined && item.quantity >= item.inventory && (
                    <div className="cart-stock-warning">⚠️ Stok maks ({item.inventory})</div>
                  )}
                </div>
                <button className="cart-item-remove" onClick={() => removeItem(item.id)}>🗑️</button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Subtotal</span>
              <strong>Rp {new Intl.NumberFormat("id-ID").format(totalPrice)}</strong>
            </div>
            <p className="cart-shipping-note">* Ongkir dihitung saat checkout</p>
            <button className="cart-checkout-btn" onClick={() => { onClose(); onCheckout(); }}>
              Checkout →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const cartStyles = `
  .cart-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1400; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
  .cart-overlay.open { opacity: 1; pointer-events: auto; }
  .cart-drawer { position: fixed; top: 0; right: -100%; width: min(400px, 100vw); height: 100%; background: var(--modal-bg, #1a1a1a); z-index: 1500; display: flex; flex-direction: column; transition: right 0.35s cubic-bezier(0.4,0,0.2,1); box-shadow: -10px 0 40px rgba(0,0,0,0.5); border-left: 1px solid var(--border-color, #333); }
  .cart-drawer.open { right: 0; }
  .cart-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--border-color, #333); flex-shrink: 0; }
  .cart-header h3 { font-size: 1.2rem; font-weight: 700; margin: 0; }
  .cart-close { background: none; border: none; font-size: 1.3rem; cursor: pointer; color: var(--text-color, #f0f0f0); padding: 4px 8px; border-radius: 6px; }
  .cart-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
  .cart-empty { text-align: center; padding: 40px 20px; color: var(--text-color-secondary, #aaa); }
  .cart-empty p { font-size: 1.1rem; margin-bottom: 8px; }
  .cart-item { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 10px; border: 1px solid var(--border-color, #333); background: var(--card-bg, #222); }
  .cart-item-img { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
  .cart-item-info { flex: 1; min-width: 0; }
  .cart-item-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cart-item-price { font-size: 0.85rem; color: var(--primary-color, #667eea); margin-bottom: 8px; }
  .cart-qty-control { display: flex; align-items: center; gap: 8px; }
  .cart-qty-control button { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border-color, #444); background: var(--bg-color, #1a1a1a); color: var(--text-color, #f0f0f0); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; }
  .cart-qty-control button:disabled { opacity: 0.3; cursor: not-allowed; }
  .cart-qty-control span { font-weight: 600; min-width: 20px; text-align: center; }
  .cart-item-remove { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 4px; flex-shrink: 0; opacity: 0.7; transition: opacity 0.2s; }
  .cart-item-remove:hover { opacity: 1; }
  .cart-stock-warning { font-size: 0.75rem; color: #e53e3e; margin-top: 4px; }

  /* Footer — KEY FIX: padding-bottom pakai env(safe-area-inset-bottom) buat mobile */
  .cart-footer {
    padding: 16px 20px;
    padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
    border-top: 1px solid var(--border-color, #333);
    flex-shrink: 0;
    background: var(--modal-bg, #1a1a1a);
  }
  .cart-total { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 1rem; }
  .cart-total strong { font-size: 1.1rem; color: var(--primary-color, #667eea); }
  .cart-shipping-note { font-size: 0.78rem; color: var(--text-color-subtle, #888); margin-bottom: 12px; }
  .cart-checkout-btn { width: 100%; padding: 14px; background: var(--primary-color, #667eea); color: #fff; border: none; border-radius: 10px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.3s; text-transform: uppercase; letter-spacing: 1px; display: block; }
  .cart-checkout-btn:hover { filter: brightness(1.1); transform: translateY(-2px); }

  @media (max-width: 480px) {
    .cart-footer { padding: 12px 16px; padding-bottom: max(12px, env(safe-area-inset-bottom, 12px)); }
    .cart-checkout-btn { padding: 14px; font-size: 0.95rem; }
  }
`;