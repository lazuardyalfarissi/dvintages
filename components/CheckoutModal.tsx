"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useCart } from "@/context/CartContext";
import { PAKASIR_PAYMENT_LABELS_CLIENT, type PakasirMethodClient } from "@/lib/pakasir-client";

interface Props { onClose: () => void; }

type Step = "form" | "choose-channel" | "pay" | "success";
type PaymentStatus = "pending" | "completed" | "expired" | "cancelled";

interface CityOption {
  id: number;
  label: string;
  city: string;
  province: string;
}

interface ShippingOption {
  courier: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

export default function CheckoutModal({ onClose }: Props) {
  const { items, totalPrice, clearCart } = useCart();

  const [step, setStep] = useState<Step>("form");

  // ── Form fields ───────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"wa_manual" | "pakasir">("wa_manual");

  // ── City autocomplete ─────────────────────────────────────────────────
  const [citySearch, setCitySearch] = useState("");
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const cityDebounce = useRef<NodeJS.Timeout | null>(null);
  const cityBoxRef = useRef<HTMLDivElement>(null);

  // ── Ongkir ────────────────────────────────────────────────────────────
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  // ── Order result ──────────────────────────────────────────────────────
  const [orderId, setOrderId] = useState<number | null>(null);
  const [waNumber, setWaNumber] = useState("");

  // ── Saved order total (disimpan sebelum clearCart) ────────────────────
  const [savedOrderTotal, setSavedOrderTotal] = useState(0);
  const [savedItems, setSavedItems] = useState<typeof items>([]);
  const [savedShipping, setSavedShipping] = useState<ShippingOption | null>(null);
  const [savedCity, setSavedCity] = useState<CityOption | null>(null);

  // ── Pakasir payment state ─────────────────────────────────────────────
  const [channel, setChannel] = useState<PakasirMethodClient>("qris");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentFee, setPaymentFee] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [expiredAt, setExpiredAt] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");

  // ── Countdown ─────────────────────────────────────────────────────────
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const totalDurationMs = useRef<number | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "warning" | "critical">("normal");

  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── City autocomplete debounce ────────────────────────────────────────
  useEffect(() => {
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (!citySearch || citySearch.length < 3 || selectedCity?.label === citySearch) {
      setCityOptions([]);
      return;
    }
    cityDebounce.current = setTimeout(async () => {
      setCityLoading(true);
      try {
        const res = await fetch(`/api/shipping/search-city?q=${encodeURIComponent(citySearch)}`);
        const data = await res.json();
        setCityOptions(data.success ? data.data : []);
      } catch { setCityOptions([]); }
      finally { setCityLoading(false); }
    }, 400);
    return () => { if (cityDebounce.current) clearTimeout(cityDebounce.current); };
  }, [citySearch, selectedCity]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node))
        setShowCityDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handlePickCity(city: CityOption) {
    setSelectedCity(city);
    setCitySearch(city.label);
    setShowCityDropdown(false);
    setSelectedShipping(null);
    setShippingOptions([]);
  }

  // ── Hitung ongkir ─────────────────────────────────────────────────────
  async function handleCalculateShipping() {
    if (!selectedCity) return;
    setShippingLoading(true);
    setShippingError("");
    setShippingOptions([]);
    setSelectedShipping(null);
    try {
      const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
      const res = await fetch("/api/shipping/cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination_id: selectedCity.id, qty: totalQty }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      if (!data.data.length) throw new Error("Tidak ada layanan kurir untuk kota ini");
      setShippingOptions(data.data);
    } catch (e: any) { setShippingError(e.message); }
    finally { setShippingLoading(false); }
  }

  const orderTotal = totalPrice + (selectedShipping?.cost || 0);

  function close() {
    setVisible(false);
    setTimeout(onClose, 350);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    if (step === "pay" && paymentStatus === "pending") return;
    close();
  }

  // ── Step 1: submit form ───────────────────────────────────────────────
  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCity) { setError("Pilih kota tujuan terlebih dahulu"); return; }
    if (!selectedShipping) { setError("Pilih layanan kurir terlebih dahulu"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          customer_email: email,
          customer_contact: contact,
          customer_address: address,
          payment_method: paymentChoice,
          items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          shipping_destination_id: selectedCity.id,
          shipping_destination_label: selectedCity.label,
          shipping_courier: selectedShipping.courier,
          shipping_service: selectedShipping.service,
          shipping_cost: selectedShipping.cost,
          shipping_etd: selectedShipping.etd,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const { orderId: newOrderId, waNumber: wa } = data.data;
      setOrderId(newOrderId);
      setWaNumber(wa);

      // Simpan ke localStorage supaya bisa diakses setelah refresh
      localStorage.setItem("last_order_id", String(newOrderId));

      // ── Simpan semua data yang dibutuhkan SEBELUM clearCart ───────────
      const currentOrderTotal = orderTotal;
      setSavedOrderTotal(currentOrderTotal);
      setSavedItems([...items]);
      setSavedShipping(selectedShipping);
      setSavedCity(selectedCity);

      clearCart();

      if (paymentChoice === "wa_manual") {
        fetch("/api/orders/notify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: newOrderId,
            customerName: name,
            customerEmail: email,
            customerContact: contact,
            customerAddress: address,
            items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, imageUrl: i.image_url })),
            subtotal: totalPrice,
            shippingCost: selectedShipping.cost,
            shippingCourier: selectedShipping.courier,
            shippingService: selectedShipping.service,
            shippingDestination: selectedCity.label,
            shippingEtd: selectedShipping.etd,
            paymentMethod: "wa_manual",
            grandTotal: currentOrderTotal,
          }),
        }).catch(() => {});

        const itemLines = items
          .map((i) => `- ${i.name} x${i.quantity} = Rp ${new Intl.NumberFormat("id-ID").format(i.price * i.quantity)}`)
          .join("\n");
        const msg =
          `Halo, saya sudah membuat pesanan #${newOrderId}.\n\n` +
          `Nama: ${name}\n` +
          `Alamat: ${address}\n` +
          `Tujuan: ${selectedCity.label}\n` +
          `Kurir: ${selectedShipping.courier} - ${selectedShipping.service} (Rp ${new Intl.NumberFormat("id-ID").format(selectedShipping.cost)})\n\n` +
          `Produk:\n${itemLines}\n\n` +
          `Total: Rp ${new Intl.NumberFormat("id-ID").format(currentOrderTotal)}\n\n` +
          `Mohon info untuk pembayaran. Terima kasih.`;
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
        setStep("success");

      } else {
        setStep("choose-channel");
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // ── Step 2: create Pakasir transaction ────────────────────────────────
  async function handleCreatePayment() {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, method: channel }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const { paymentNumber: pn, fee, baseAmount: base, totalPayment: total, expiredAt: exp } = data.data;

      setPaymentNumber(pn);
      setPaymentFee(fee);
      setBaseAmount(base);
      setTotalPayment(total);
      setExpiredAt(exp);
      setPaymentStatus("pending");
      totalDurationMs.current = null;
      setStep("pay");

      fetch("/api/orders/notify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          customerName: name,
          customerEmail: email,
          customerContact: contact,
          customerAddress: address,
          items: savedItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, imageUrl: i.image_url })),
          subtotal: savedOrderTotal - (savedShipping?.cost || 0),
          shippingCost: savedShipping?.cost || 0,
          shippingCourier: savedShipping?.courier || "",
          shippingService: savedShipping?.service || "",
          shippingDestination: savedCity?.label || "",
          shippingEtd: savedShipping?.etd || "",
          paymentMethod: "pakasir",
          grandTotal: savedOrderTotal,
          pakasirInstructions: {
            channel: PAKASIR_PAYMENT_LABELS_CLIENT[channel],
            totalPayment: total,
            fee,
            expiredAt: exp,
          },
        }),
      }).catch(() => {});

    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // ── Polling status pembayaran ─────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/payment/status?order_id=${orderId}`);
      const data = await res.json();
      if (data.success) {
        const newStatus: PaymentStatus = data.data.status;
        setPaymentStatus(newStatus);
        if (newStatus === "completed" || newStatus === "expired" || newStatus === "cancelled") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }
    } catch {}
  }, [orderId]);

  useEffect(() => {
    if (step !== "pay") return;
    pollStatus();
    pollRef.current = setInterval(pollStatus, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, pollStatus]);

  // ── Countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "pay" || !expiredAt) return;
    if (totalDurationMs.current === null)
      totalDurationMs.current = new Date(expiredAt).getTime() - Date.now();

    function tick() {
      const diff = new Date(expiredAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Kadaluarsa"); setUrgency("critical");
        if (countdownRef.current) clearInterval(countdownRef.current);
        return;
      }
      const total = totalDurationMs.current || diff;
      const ratio = diff / total;
      if (ratio <= 0.1) setUrgency("critical");
      else if (ratio <= 0.25) setUrgency("warning");
      else setUrgency("normal");

      const totalSeconds = Math.floor(diff / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      setTimeLeft(h > 0
        ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
        : `${m}:${s.toString().padStart(2, "0")}`);
    }
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [step, expiredAt]);

  function isVA(m: PakasirMethodClient) { return m !== "qris"; }

  return (
    <>
      <style>{checkoutStyles}</style>
      <div className={`modal-overlay${visible ? " visible" : ""}`} onClick={handleOverlayClick}>
        <div className="modal-content checkout-modal" onClick={(e) => e.stopPropagation()}>

          {/* ── STEP: Form ───────────────────────────────────────── */}
          {step === "form" && (
            <>
              <h3>🛒 Checkout</h3>

              <div className="checkout-items">
                {items.map((item) => (
                  <div key={item.id} className="checkout-item-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image_url} alt={item.name} className="checkout-item-img"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/40x40/222/f0f0f0?text=N/A"; }} />
                    <span className="checkout-item-name">{item.name} x{item.quantity}</span>
                    <span className="checkout-item-subtotal">
                      Rp {new Intl.NumberFormat("id-ID").format(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <form className="order-form" onSubmit={handleSubmitForm}>

                <div className="form-group">
                  <label className="form-label">Nama Lengkap</label>
                  <input className="form-input" required placeholder="Nama kamu"
                    value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email <span className="label-badge">Notifikasi pesanan dikirim ke sini</span>
                  </label>
                  <input className="form-input" type="email" required placeholder="kamu@email.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Nomor WhatsApp</label>
                  <input className="form-input" type="tel" required placeholder="08123456xxxx"
                    value={contact} onChange={(e) => setContact(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Alamat Lengkap</label>
                  <textarea className="form-input" required rows={3}
                    placeholder="Jalan, no. rumah, kelurahan, kecamatan, kota, kode pos"
                    value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Kota / Kecamatan Tujuan</label>
                  <div className="city-autocomplete" ref={cityBoxRef}>
                    <input className="form-input" required
                      placeholder="Ketik nama kota/kecamatan, mis. Kebayoran"
                      value={citySearch}
                      onChange={(e) => {
                        setCitySearch(e.target.value);
                        setSelectedCity(null);
                        setShowCityDropdown(true);
                        setSelectedShipping(null);
                        setShippingOptions([]);
                      }}
                      onFocus={() => setShowCityDropdown(true)}
                    />
                    {showCityDropdown && citySearch.length >= 3 && (
                      <div className="city-dropdown">
                        {cityLoading ? (
                          <div className="city-dropdown-empty">Mencari...</div>
                        ) : cityOptions.length === 0 ? (
                          <div className="city-dropdown-empty">Kota tidak ditemukan</div>
                        ) : cityOptions.map((c) => (
                          <div key={c.id} className="city-dropdown-item" onClick={() => handlePickCity(c)}>
                            {c.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {selectedCity && (
                  <div className="form-group">
                    <button type="button" className="shipping-calc-btn"
                      onClick={handleCalculateShipping} disabled={shippingLoading}>
                      {shippingLoading ? "Menghitung ongkir..." : "Cek Ongkos Kirim"}
                    </button>
                    {shippingError && <p className="form-error">{shippingError}</p>}
                    {shippingOptions.length > 0 && (
                      <div className="shipping-options">
                        {shippingOptions.map((opt, i) => (
                          <label key={`${opt.courier}-${opt.service}-${i}`}
                            className={`shipping-option${
                              selectedShipping?.courier === opt.courier && selectedShipping?.service === opt.service ? " active" : ""
                            }`}>
                            <input type="radio" name="shipping_option"
                              checked={selectedShipping?.courier === opt.courier && selectedShipping?.service === opt.service}
                              onChange={() => setSelectedShipping(opt)} />
                            <div>
                              <strong>{opt.courier} - {opt.service}</strong>
                              <span>
                                {opt.description}
                                {opt.etd && opt.etd.trim() !== "" && (
                                  <> &middot; Estimasi {opt.etd}{!/hari|day/i.test(opt.etd) ? " hari" : ""}</>
                                )}
                              </span>
                            </div>
                            <div className="shipping-option-cost">
                              Rp {new Intl.NumberFormat("id-ID").format(opt.cost)}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Metode Pemesanan</label>
                  <div className="payment-choice-group">
                    <label className={`payment-choice${paymentChoice === "wa_manual" ? " active" : ""}`}>
                      <input type="radio" name="payment_choice" checked={paymentChoice === "wa_manual"}
                        onChange={() => setPaymentChoice("wa_manual")} />
                      <div>
                        <strong>Chat WhatsApp</strong>
                        <span>Konfirmasi &amp; bayar manual lewat chat admin</span>
                      </div>
                    </label>
                    <label className={`payment-choice${paymentChoice === "pakasir" ? " active" : ""}`}>
                      <input type="radio" name="payment_choice" checked={paymentChoice === "pakasir"}
                        onChange={() => setPaymentChoice("pakasir")} />
                      <div>
                        <strong>Bayar Online</strong>
                        <span>QRIS / Virtual Account, otomatis terverifikasi. Ada biaya admin dari payment gateway.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {selectedShipping && (
                  <div className="checkout-total-box">
                    <div className="checkout-total-row">
                      <span>Subtotal produk</span>
                      <span>Rp {new Intl.NumberFormat("id-ID").format(totalPrice)}</span>
                    </div>
                    <div className="checkout-total-row">
                      <span>Ongkos kirim ({selectedShipping.courier})</span>
                      <span>Rp {new Intl.NumberFormat("id-ID").format(selectedShipping.cost)}</span>
                    </div>
                    {paymentChoice === "pakasir" && (
                      <p className="order-summary-note">
                        *Biaya admin payment gateway akan ditambahkan di langkah berikutnya
                      </p>
                    )}
                    <div className="checkout-total-row grand">
                      <span>{paymentChoice === "pakasir" ? "Subtotal" : "Total"}</span>
                      <strong>Rp {new Intl.NumberFormat("id-ID").format(orderTotal)}</strong>
                    </div>
                  </div>
                )}

                {error && <p className="form-error">{error}</p>}

                <div className="modal-buttons">
                  <button type="button" className="modal-btn-cancel" onClick={close}>Batal</button>
                  <button type="submit" className="modal-btn-submit" disabled={loading}>
                    {loading ? "Memproses..." : paymentChoice === "wa_manual" ? "Lanjut ke WhatsApp" : "Lanjutkan"}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── STEP: Pilih channel Pakasir ──────────────────────── */}
          {step === "choose-channel" && (
            <>
              <h3>Pilih Metode Pembayaran</h3>
              <p className="modal-subtext">
                Subtotal: <strong>Rp {new Intl.NumberFormat("id-ID").format(savedOrderTotal)}</strong><br />
                <span style={{ fontSize: "0.8rem" }}>+ biaya admin sesuai metode yang dipilih</span>
              </p>
              <div className="channel-list">
                {(Object.keys(PAKASIR_PAYMENT_LABELS_CLIENT) as PakasirMethodClient[]).map((m) => (
                  <label key={m} className={`channel-item${channel === m ? " active" : ""}`}>
                    <input type="radio" name="pakasir_channel" checked={channel === m} onChange={() => setChannel(m)} />
                    <span>{PAKASIR_PAYMENT_LABELS_CLIENT[m]}</span>
                  </label>
                ))}
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-buttons">
                <button type="button" className="modal-btn-cancel"
                  onClick={() => { setError(""); setStep("form"); }}>Kembali</button>
                <button type="button" className="modal-btn-submit" disabled={loading} onClick={handleCreatePayment}>
                  {loading ? "Memproses..." : "Buat Pembayaran"}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: Pay ────────────────────────────────────────── */}
          {step === "pay" && (
            <>
              {paymentStatus === "completed" ? (
                <div className="payment-result">
                  <div className="payment-result-icon success">✓</div>
                  <h3>Pembayaran Berhasil!</h3>
                  <p className="modal-subtext">
                    Pesanan #{orderId} sudah kami terima dan akan segera diproses.<br />
                    <span style={{ fontSize: "0.85rem" }}>Cek inbox email <strong>{email}</strong> untuk detail pesanan.</span>
                  </p>
                  <div className="modal-buttons">
                    <a href={`/order/${orderId}`} className="modal-btn-submit"
                      style={{ textDecoration: "none", textAlign: "center" }}>
                      Lihat Status Pesanan
                    </a>
                    <button type="button" className="modal-btn-cancel" onClick={close}>Tutup</button>
                  </div>
                </div>

              ) : paymentStatus === "expired" ? (
                <div className="payment-result">
                  <div className="payment-result-icon expired">!</div>
                  <h3>Waktu Pembayaran Habis</h3>
                  <p className="modal-subtext">
                    Pesanan #{orderId} belum dibayar. Silakan hubungi admin via WhatsApp.
                  </p>
                  <div className="modal-buttons">
                    <button type="button" className="modal-btn-cancel" onClick={close}>Tutup</button>
                    <a className="modal-btn-submit" style={{ textDecoration: "none", textAlign: "center" }}
                      href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo, saya ingin melanjutkan pembayaran pesanan #${orderId} yang sudah kadaluarsa.`)}`}
                      target="_blank" rel="noreferrer">
                      Hubungi Admin
                    </a>
                  </div>
                </div>

              ) : (
                <>
                  <h3>Selesaikan Pembayaran</h3>
                  <div className="checkout-total-box">
                    <div className="checkout-total-row">
                      <span>Subtotal produk + ongkir</span>
                      <span>Rp {new Intl.NumberFormat("id-ID").format(baseAmount)}</span>
                    </div>
                    <div className="checkout-total-row">
                      <span>Biaya admin payment gateway</span>
                      <span>Rp {new Intl.NumberFormat("id-ID").format(paymentFee)}</span>
                    </div>
                    <div className="checkout-total-row grand">
                      <span>Total Bayar</span>
                      <strong>Rp {new Intl.NumberFormat("id-ID").format(totalPayment)}</strong>
                    </div>
                  </div>

                  {timeLeft && (
                    <p className={`countdown-text urgency-${urgency}`}>
                      {urgency === "critical" && "⚠️ "}
                      Bayar sebelum: <strong>{timeLeft}</strong>
                      {urgency === "critical" && " — segera bayar!"}
                      {urgency === "warning" && " — waktu hampir habis"}
                    </p>
                  )}

                  {!isVA(channel) ? (
                    <div className="qris-box">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(paymentNumber)}`}
                        alt="QRIS Pembayaran" className="qris-image" />
                      <p className="modal-subtext">Scan dengan aplikasi e-wallet atau m-banking apa saja</p>
                    </div>
                  ) : (
                    <div className="va-box">
                      <span className="va-label">{PAKASIR_PAYMENT_LABELS_CLIENT[channel]}</span>
                      <div className="va-number">{paymentNumber}</div>
                      <button type="button" className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(paymentNumber)}>
                        Salin Nomor
                      </button>
                    </div>
                  )}

                  <p className="payment-waiting-text">⏳ Menunggu pembayaran... halaman ini akan otomatis update</p>
                  {error && <p className="form-error">{error}</p>}
                  <div className="modal-buttons">
                    <button type="button" className="modal-btn-cancel" onClick={close}>Tutup</button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── STEP: Success WA manual ──────────────────────────── */}
          {step === "success" && (
            <div className="payment-result">
              <div className="payment-result-icon success">✓</div>
              <h3>Pesanan Dibuat!</h3>
              <p className="modal-subtext">
                Pesanan #{orderId} berhasil dibuat.<br />
                Detail pesanan sudah dikirim ke <strong>{email}</strong>.<br />
                Lanjutkan konfirmasi pembayaran di WhatsApp yang baru terbuka.
              </p>
              <div className="modal-buttons">
                <a href={`/order/${orderId}`} className="modal-btn-submit"
                  style={{ textDecoration: "none", textAlign: "center" }}>
                  Lihat Status Pesanan
                </a>
                <button type="button" className="modal-btn-cancel" onClick={close}>Tutup</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

const checkoutStyles = `
  .checkout-modal { max-width: 500px !important; }
  .checkout-items { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; padding: 12px; background: var(--bg-color, #111); border-radius: 10px; border: 1px solid var(--border-color, #333); }
  .checkout-item-row { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }
  .checkout-item-img { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
  .checkout-item-name { flex: 1; font-weight: 600; font-size: 0.85rem; }
  .checkout-item-subtotal { font-weight: 700; color: var(--primary-color, #667eea); white-space: nowrap; }
  .label-badge { display: inline-block; margin-left: 8px; padding: 2px 8px; background: rgba(102,126,234,0.15); color: #667eea; border-radius: 20px; font-size: 0.72rem; font-weight: 600; vertical-align: middle; }
  .city-autocomplete { position: relative; }
  .city-dropdown { position: absolute; left: 0; right: 0; background: var(--modal-bg, #2a2a2a); border: 1px solid var(--border-color, #444); border-radius: 8px; z-index: 100; max-height: 180px; overflow-y: auto; box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
  .city-dropdown-item { padding: 10px 14px; cursor: pointer; font-size: 0.9rem; transition: background 0.2s; }
  .city-dropdown-item:hover { background: var(--border-color, #333); }
  .city-dropdown-empty { padding: 10px 14px; font-size: 0.85rem; color: var(--text-color-secondary, #aaa); }
  .shipping-calc-btn { width: 100%; padding: 11px; background: transparent; border: 2px solid var(--primary-color, #667eea); color: var(--primary-color, #667eea); border-radius: 8px; font-weight: 700; cursor: pointer; margin-bottom: 12px; transition: all 0.3s; }
  .shipping-calc-btn:hover:not(:disabled) { background: var(--primary-color, #667eea); color: #fff; }
  .shipping-calc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .shipping-options { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .shipping-option { display: flex; align-items: center; gap: 10px; padding: 12px; border: 2px solid var(--border-color, #444); border-radius: 8px; cursor: pointer; transition: all 0.25s; }
  .shipping-option input[type="radio"] { flex-shrink: 0; accent-color: var(--primary-color, #667eea); }
  .shipping-option div { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .shipping-option div strong { font-size: 0.9rem; }
  .shipping-option div span { font-size: 0.8rem; color: var(--text-color-secondary, #aaa); }
  .shipping-option.active { border-color: var(--primary-color, #667eea); background: rgba(102,126,234,0.1); }
  .shipping-option-cost { font-weight: 700; color: var(--primary-color, #667eea); white-space: nowrap; font-size: 0.9rem; }
  .payment-choice-group { display: flex; flex-direction: column; gap: 8px; }
  .payment-choice { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 2px solid var(--border-color, #444); border-radius: 8px; cursor: pointer; transition: all 0.25s; }
  .payment-choice input[type="radio"] { flex-shrink: 0; margin-top: 3px; accent-color: var(--primary-color, #667eea); }
  .payment-choice div { display: flex; flex-direction: column; gap: 2px; }
  .payment-choice div strong { font-size: 0.9rem; }
  .payment-choice div span { font-size: 0.8rem; color: var(--text-color-secondary, #aaa); }
  .payment-choice.active { border-color: var(--primary-color, #667eea); background: rgba(102,126,234,0.1); }
  .checkout-total-box { background: var(--bg-color, #111); border-radius: 10px; padding: 14px; margin: 16px 0; border: 1px solid var(--border-color, #333); display: flex; flex-direction: column; gap: 8px; }
  .checkout-total-row { display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-color-secondary, #aaa); }
  .checkout-total-row.grand { font-size: 1rem; color: var(--text-color, #f0f0f0); border-top: 1px solid var(--border-color, #333); padding-top: 8px; margin-top: 4px; }
  .checkout-total-row.grand strong { color: var(--primary-color, #667eea); font-size: 1.1rem; }
  .order-summary-note { font-size: 0.78rem; color: var(--text-color-secondary, #aaa); margin: 2px 0; font-style: italic; }
  .channel-list { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
  .channel-item { display: flex; align-items: center; gap: 10px; padding: 12px; border: 2px solid var(--border-color, #444); border-radius: 8px; cursor: pointer; transition: all 0.25s; }
  .channel-item input[type="radio"] { accent-color: var(--primary-color, #667eea); }
  .channel-item.active { border-color: var(--primary-color, #667eea); background: rgba(102,126,234,0.1); }
  .qris-box { display: flex; flex-direction: column; align-items: center; gap: 12px; margin: 16px 0; }
  .qris-image { width: 200px; height: 200px; border-radius: 12px; }
  .va-box { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 16px 0; padding: 16px; background: var(--bg-color, #111); border-radius: 10px; border: 1px solid var(--border-color, #333); }
  .va-label { font-size: 0.85rem; color: var(--text-color-secondary, #aaa); }
  .va-number { font-size: 1.4rem; font-weight: 700; letter-spacing: 2px; font-family: monospace; }
  .copy-btn { padding: 8px 20px; background: var(--primary-color, #667eea); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: filter 0.2s; }
  .copy-btn:hover { filter: brightness(1.1); }
  .countdown-text { text-align: center; font-size: 0.95rem; margin: 8px 0; padding: 8px; border-radius: 8px; }
  .countdown-text.urgency-normal { color: var(--text-color-secondary, #aaa); }
  .countdown-text.urgency-warning { color: #f6ad55; background: rgba(246,173,85,0.1); }
  .countdown-text.urgency-critical { color: #fc8181; background: rgba(252,129,129,0.1); }
  .payment-waiting-text { text-align: center; font-size: 0.85rem; color: var(--text-color-secondary, #aaa); margin-top: 8px; }
  .payment-result { text-align: center; padding: 10px 0; }
  .payment-result-icon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 16px; }
  .payment-result-icon.success { background: rgba(72,187,120,0.15); color: #48bb78; border: 2px solid #48bb78; }
  .payment-result-icon.expired { background: rgba(252,129,129,0.15); color: #fc8181; border: 2px solid #fc8181; }
  .form-error { color: #fc8181; font-size: 0.85rem; margin-top: 6px; }
  .modal-subtext { font-size: 0.9rem; color: var(--text-color-secondary, #aaa); margin-bottom: 16px; text-align: center; }
`;