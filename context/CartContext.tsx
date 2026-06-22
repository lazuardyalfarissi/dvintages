"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  id: number;
  name: string;
  price: number;
  image_url: string;
  quantity: number;
  inventory: number; // ← tambah ini buat limit stok
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dv_cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("dv_cart", JSON.stringify(items));
  }, [items]);

  function addItem(product: Omit<CartItem, "quantity">) {
    setItems((prev) => {
      const exists = prev.find((i) => i.id === product.id);
      if (exists) {
        // Jangan tambah kalau udah maks stok
        if (exists.quantity >= product.inventory) return prev;
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateQty(id: number, qty: number) {
    if (qty <= 0) return removeItem(id);
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        // Clamp qty ke inventory
        const clamped = Math.min(qty, i.inventory);
        return { ...i, quantity: clamped };
      })
    );
  }

  function clearCart() {
    setItems([]);
  }

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}