"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { PAKASIR_PAYMENT_LABELS_CLIENT, type PakasirMethodClient } from "@/lib/pakasir-client";
import "@/styles/pakasir-additions.css";

type Step = "form" | "choose-channel" | "pay" | "success";
type PaymentStatus = "pending" | "completed" | "expired" | "cancelled";

interface OrderModalProps {
  productId: number;
  onClose: () => void;
}

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

export default function OrderModal({ productId, onClose }: OrderModalProps) {
  const [step, setStep] = useState<Step>("form");

  // Form fields
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"wa_manual" | "pakasir">("wa_manual");

  // ── Ongkir state ──────────────────────────────────────────────────────
  const [citySearch, setCitySearch] = useState("");
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const cityDebounce = useRef<NodeJS.Timeout | null>(null);
  const cityBoxRef = useRef<HTMLDivElement>(null);

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Order result
  const [orderId, setOrderId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState(0);
  const [waNumber, setWaNumber] = useState("");

  // ── Detail produk — diambil saat modal dibuka ─────────────────────────
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState("");

  // Pakasir payment state
  const [channel, setChannel] = useState<PakasirMethodClient>("qris");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentFee, setPaymentFee] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [expiredAt, setExpiredAt] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");

  // Countdown
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const totalDurationMs = useRef<number | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "warning" | "critical">("normal");

  // ── Ambil detail produk saat modal dibuka ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setProductLoading(true);
      setProductError("");
      try {
        const res = await fetch(`/api/products/${productId}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        if (!cancelled) {
          setPrice(data.data.price);
          setProductName(data.data.name);
        }
      } catch (e: any) {
        if (!cancelled) setProductError(e.message || "Gagal memuat data produk");
      } finally {
        if (!cancelled) setProductLoading(false);
      }
    }

    loadProduct();
    return () => { cancelled = true; };
  }, [productId]);

  // ── Cari kota tujuan (debounced) ───────────────────────────────────────
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
      } catch {
        setCityOptions([]);
      } finally {
        setCityLoading(false);
      }
    }, 400);

    return () => { if (cityDebounce.current) clearTimeout(cityDebounce.current); };
  }, [citySearch, selectedCity]);

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false);
      }
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

  // ── Hitung ongkir setelah kota dipilih ─────────────────────────────────
  async function handleCalculateShipping() {
    if (!selectedCity) return;
    setShippingLoading(true);
    setShippingError("");
    setShippingOptions([]);
    setSelectedShipping(null);
    try {
      const res = await fetch("/api/shipping/cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination_id: selectedCity.id, qty: 1 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      if (!data.data.length) throw new Error("Tidak ada layanan kurir untuk kota ini");
      setShippingOptions(data.data);
    } catch (e: any) {
      setShippingError(e.message);
    } finally {
      setShippingLoading(false);
    }
  }

  const orderTotal = price + (selectedShipping?.cost || 0);

  // ── Step 1: submit form ────────────────────────────────────────────────
  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedCity) {
      setError("Pilih kota tujuan terlebih dahulu");
      return;
    }
    if (!selectedShipping) {
      setError("Pilih layanan kurir terlebih dahulu");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          customer_name: name,
          customer_contact: contact,
          customer_address: address,
          payment_method: paymentChoice,
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

      const { orderId: newOrderId, productName: pName, price: pPrice, waNumber: wa } = data.data;
      setOrderId(newOrderId);
      setProductName(pName);
      setPrice(pPrice);
      setWaNumber(wa);

      if (paymentChoice === "wa_manual") {
        const productUrl = `${window.location.origin}/product/${productId}`;
        const msg =
          `Halo, saya sudah membuat pesanan #${newOrderId}.\n\n` +
          `Nama: ${name}\n` +
          `Alamat: ${address}\n` +
          `Tujuan: ${selectedCity.label}\n` +
          `Kurir: ${selectedShipping.courier} - ${selectedShipping.service} (Rp ${new Intl.NumberFormat("id-ID").format(selectedShipping.cost)})\n` +
          `Produk: ${pName}\n` +
          `Link Produk: ${productUrl}\n\n` +
          `Mohon info untuk pembayaran. Terima kasih.`;
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
        setStep("success");
      } else {
        setStep("choose-channel");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
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

      setPaymentNumber(data.data.paymentNumber);
      setPaymentFee(data.data.fee);
      setBaseAmount(data.data.baseAmount);
      setTotalPayment(data.data.totalPayment);
      setExpiredAt(data.data.expiredAt);
      setPaymentStatus("pending");
      totalDurationMs.current = null;
      setStep("pay");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
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
        if (
          newStatus === "completed" ||
          newStatus === "expired" ||
          newStatus === "cancelled"
        ) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }
    } catch {
      // Network hiccup — coba lagi di interval berikutnya
    }
  }, [orderId]);

  useEffect(() => {
    if (step !== "pay") return;
    pollStatus();
    pollRef.current = setInterval(pollStatus, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, pollStatus]);

  // ── Countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "pay" || !expiredAt) return;

    if (totalDurationMs.current === null) {
      totalDurationMs.current = new Date(expiredAt).getTime() - Date.now();
    }

    function tick() {
      const diff = new Date(expiredAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Kadaluarsa");
        setUrgency("critical");
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
      setTimeLeft(
        h > 0
          ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
          : `${m}:${s.toString().padStart(2, "0")}`
      );
    }

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [step, expiredAt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function isVA(m: PakasirMethodClient) {
    return m !== "qris";
  }

  // Tutup modal — kalau step "pay" dan masih pending, tidak bisa ditutup
  // dengan klik overlay (harus pakai tombol Tutup)
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    if (step === "pay" && paymentStatus === "pending") return;
    onClose();
  }

  return (
    <div className="modal-overlay visible" onClick={handleOverlayClick}>
      <div className="modal-content">

        {/* ── STEP: Form ─────────────────────────────────────────── */}
        {step === "form" && (
          <>
            <h3>Lengkapi Data Pesanan</h3>
            <form className="order-form" onSubmit={handleSubmitForm}>

              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input
                  className="form-input"
                  required
                  placeholder="Nama kamu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nomor WhatsApp</label>
                <input
                  className="form-input"
                  type="tel"
                  required
                  placeholder="08123456xxxx"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alamat Lengkap (untuk pengiriman)</label>
                <textarea
                  className="form-input"
                  required
                  rows={3}
                  placeholder="Jalan, no. rumah, kelurahan, kecamatan, kota, kode pos"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              {/* ── Kota tujuan (autocomplete) ──────────────────────── */}
              <div className="form-group">
                <label className="form-label">Kota / Kecamatan Tujuan</label>
                <div className="city-autocomplete" ref={cityBoxRef}>
                  <input
                    className="form-input"
                    required
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
                      ) : (
                        cityOptions.map((c) => (
                          <div
                            key={c.id}
                            className="city-dropdown-item"
                            onClick={() => handlePickCity(c)}
                          >
                            {c.label}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Tombol & hasil hitung ongkir ─────────────────────── */}
              {selectedCity && (
                <div className="form-group">
                  <button
                    type="button"
                    className="shipping-calc-btn"
                    onClick={handleCalculateShipping}
                    disabled={shippingLoading}
                  >
                    {shippingLoading ? "Menghitung ongkir..." : "Cek Ongkos Kirim"}
                  </button>

                  {shippingError && <p className="form-error">{shippingError}</p>}

                  {shippingOptions.length > 0 && (
                    <div className="shipping-options">
                      {shippingOptions.map((opt, i) => (
                        <label
                          key={`${opt.courier}-${opt.service}-${i}`}
                          className={`shipping-option${
                            selectedShipping?.courier === opt.courier &&
                            selectedShipping?.service === opt.service
                              ? " active"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="shipping_option"
                            checked={
                              selectedShipping?.courier === opt.courier &&
                              selectedShipping?.service === opt.service
                            }
                            onChange={() => setSelectedShipping(opt)}
                          />
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

              {/* ── Metode pemesanan ──────────────────────────────────── */}
              <div className="form-group">
                <label className="form-label">Metode Pemesanan</label>
                <div className="payment-choice-group">
                  <label className={`payment-choice${paymentChoice === "wa_manual" ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="payment_choice"
                      checked={paymentChoice === "wa_manual"}
                      onChange={() => setPaymentChoice("wa_manual")}
                    />
                    <div>
                      <strong>Chat WhatsApp</strong>
                      <span>Konfirmasi &amp; bayar manual lewat chat admin</span>
                    </div>
                  </label>
                  <label className={`payment-choice${paymentChoice === "pakasir" ? " active" : ""}`}>
                    <input
                      type="radio"
                      name="payment_choice"
                      checked={paymentChoice === "pakasir"}
                      onChange={() => setPaymentChoice("pakasir")}
                    />
                    <div>
                      <strong>Bayar Online</strong>
                      <span>QRIS / Virtual Account, otomatis terverifikasi. Ada biaya admin dari payment gateway.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* ── Ringkasan biaya ──────────────────────────────────── */}
              {selectedShipping && (
                <div className="order-summary">
                  <div className="order-summary-row">
                    <span>Harga produk</span>
                    <span>
                      {productLoading
                        ? "Memuat..."
                        : `Rp ${new Intl.NumberFormat("id-ID").format(price)}`}
                    </span>
                  </div>
                  <div className="order-summary-row">
                    <span>Ongkos kirim ({selectedShipping.courier})</span>
                    <span>Rp {new Intl.NumberFormat("id-ID").format(selectedShipping.cost)}</span>
                  </div>
                  {paymentChoice === "pakasir" && (
                    <p className="order-summary-note">
                      *Biaya admin payment gateway akan ditambahkan dan ditampilkan di langkah berikutnya
                    </p>
                  )}
                  <div className="order-summary-row total">
                    <span>{paymentChoice === "pakasir" ? "Subtotal" : "Total"}</span>
                    <span>
                      {productLoading
                        ? "Memuat..."
                        : `Rp ${new Intl.NumberFormat("id-ID").format(orderTotal)}`}
                    </span>
                  </div>
                </div>
              )}

              {productError && <p className="form-error">{productError}</p>}
              {error && <p className="form-error">{error}</p>}

              <div className="modal-buttons">
                <button type="button" className="modal-btn-cancel" onClick={onClose}>
                  Batal
                </button>
                <button
                  type="submit"
                  className="modal-btn-submit"
                  disabled={loading || productLoading || !!productError}
                >
                  {loading
                    ? "Memproses..."
                    : productLoading
                    ? "Memuat produk..."
                    : paymentChoice === "wa_manual"
                    ? "Lanjut ke WhatsApp"
                    : "Lanjutkan"}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── STEP: Pilih channel ─────────────────────────────────── */}
        {step === "choose-channel" && (
          <>
            <h3>Pilih Metode Pembayaran</h3>
            <p className="modal-subtext">
              Subtotal:{" "}
              <strong>
                Rp {new Intl.NumberFormat("id-ID").format(price + (selectedShipping?.cost || 0))}
              </strong>
              <br />
              <span style={{ fontSize: "0.8rem" }}>+ biaya admin sesuai metode yang dipilih</span>
            </p>
            <div className="channel-list">
              {(Object.keys(PAKASIR_PAYMENT_LABELS_CLIENT) as PakasirMethodClient[]).map((m) => (
                <label key={m} className={`channel-item${channel === m ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="pakasir_channel"
                    checked={channel === m}
                    onChange={() => setChannel(m)}
                  />
                  <span>{PAKASIR_PAYMENT_LABELS_CLIENT[m]}</span>
                </label>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-buttons">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => { setError(""); setStep("form"); }}
              >
                Kembali
              </button>
              <button
                type="button"
                className="modal-btn-submit"
                disabled={loading}
                onClick={handleCreatePayment}
              >
                {loading ? "Memproses..." : "Buat Pembayaran"}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: Pay ───────────────────────────────────────────── */}
        {step === "pay" && (
          <>
            {paymentStatus === "completed" ? (
              <div className="payment-result">
                <div className="payment-result-icon success">✓</div>
                <h3>Pembayaran Berhasil!</h3>
                <p className="modal-subtext">
                  Pesanan #{orderId} sudah kami terima dan akan segera diproses.
                </p>
                <div className="modal-buttons">
                  <button type="button" className="modal-btn-submit" onClick={onClose}>
                    Selesai
                  </button>
                </div>
              </div>

            ) : paymentStatus === "expired" ? (
              <div className="payment-result">
                <div className="payment-result-icon expired">!</div>
                <h3>Waktu Pembayaran Habis</h3>
                <p className="modal-subtext">
                  Pesanan #{orderId} belum dibayar. Silakan hubungi admin via WhatsApp untuk
                  melanjutkan secara manual.
                </p>
                <div className="modal-buttons">
                  <button type="button" className="modal-btn-cancel" onClick={onClose}>
                    Tutup
                  </button>
                  <a
                    className="modal-btn-submit"
                    style={{ textDecoration: "none", textAlign: "center" }}
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(
                      `Halo, saya ingin melanjutkan pembayaran pesanan #${orderId} (${productName}) yang sudah kadaluarsa.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Hubungi Admin
                  </a>
                </div>
              </div>

            ) : (
              <>
                <h3>Selesaikan Pembayaran</h3>

                {/* ── Rincian biaya ──────────────────────────────────── */}
                <div className="order-summary">
                  <div className="order-summary-row">
                    <span>Harga produk + ongkir</span>
                    <span>Rp {new Intl.NumberFormat("id-ID").format(baseAmount)}</span>
                  </div>
                  <div className="order-summary-row">
                    <span>Biaya admin payment gateway</span>
                    <span>Rp {new Intl.NumberFormat("id-ID").format(paymentFee)}</span>
                  </div>
                  <div className="order-summary-row total">
                    <span>Total Bayar</span>
                    <span>Rp {new Intl.NumberFormat("id-ID").format(totalPayment)}</span>
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
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                        paymentNumber
                      )}`}
                      alt="QRIS Pembayaran"
                      className="qris-image"
                    />
                    <p className="modal-subtext">
                      Scan dengan aplikasi e-wallet atau m-banking apa saja
                    </p>
                  </div>
                ) : (
                  <div className="va-box">
                    <span className="va-label">{PAKASIR_PAYMENT_LABELS_CLIENT[channel]}</span>
                    <div className="va-number">{paymentNumber}</div>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => navigator.clipboard.writeText(paymentNumber)}
                    >
                      Salin Nomor
                    </button>
                  </div>
                )}

                <p className="payment-waiting-text">
                  ⏳ Menunggu pembayaran... halaman ini akan otomatis update
                </p>

                {error && <p className="form-error">{error}</p>}
                <div className="modal-buttons">
                  <button type="button" className="modal-btn-cancel" onClick={onClose}>
                    Tutup
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── STEP: Success WA manual ─────────────────────────────── */}
        {step === "success" && (
          <div className="payment-result">
            <div className="payment-result-icon success">✓</div>
            <h3>Pesanan Dibuat</h3>
            <p className="modal-subtext">
              Pesanan #{orderId} berhasil dibuat. Silakan lanjutkan percakapan di WhatsApp yang
              baru terbuka untuk info pembayaran.
            </p>
            <div className="modal-buttons">
              <button type="button" className="modal-btn-submit" onClick={onClose}>
                Tutup
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}