export type UserRole = 'consumer' | 'vendor' | 'affiliate' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  profile_image_url?: string;
  bio?: string;
  city?: string;
  country?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  created_at: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  stock_quantity: number;
  commission_percentage: number;
  affiliate_commission_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  vendor?: User;
  category?: Category;
}

export interface Order {
  id: string;
  customer_id: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  stripe_payment_intent_id?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  vendor_id: string;
  quantity: number;
  price_at_purchase: number;
  subtotal: number;
  created_at: string;
  product?: Product;
}

export interface Commission {
  id: string;
  user_id: string;
  order_item_id?: string;
  commission_type: 'vendor_sale' | 'affiliate_referral' | 'passive_pool';
  amount: number;
  percentage: number;
  status: 'earned' | 'pending_payout' | 'paid' | 'cancelled';
  created_at: string;
}

export interface Payout {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  stripe_transfer_id?: string;
  created_at: string;
  completed_at?: string;
}

export interface StripeCustomer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  created_at: string;
}
