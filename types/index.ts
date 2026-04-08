export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string[]; // always array after processing
  status: "active" | "inactive" | "sold_out";
  inventory: number;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  customer_name: string;
  customer_contact: string;
  total_price: number;
  order_status: "Pending" | "Dikonfirmasi" | "Selesai" | "Dibatalkan";
  created_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price_at_purchase: number;
}

export interface Banner {
  id: number;
  image_url: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

export interface Setting {
  id: number;
  setting_key: string;
  setting_value: string;
}

export interface SalesReport {
  summary: {
    total_revenue: number;
    total_orders: number;
  };
  monthly_sales: {
    sale_month: string;
    monthly_revenue: number;
    monthly_orders: number;
  }[];
}
