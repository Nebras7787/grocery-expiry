export type Category =
  | 'Dairy'
  | 'Bakery'
  | 'Canned Goods'
  | 'Beverages'
  | 'Frozen'
  | 'Produce'
  | 'Meat'
  | 'Snacks'
  | 'General'
  | 'Other';

export const CATEGORIES: Category[] = [
  'Dairy',
  'Bakery',
  'Canned Goods',
  'Beverages',
  'Frozen',
  'Produce',
  'Meat',
  'Snacks',
  'General',
  'Other',
];

export type BatchStatus = 'valid' | 'near_expiry' | 'expired';

export interface Product {
  id: string;
  name: string;
  category: Category | string;
  created_at: string;
  user_id?: string | null;
  // Local-only ownership scope (Supabase user id, or OFFLINE_SCOPE). Not synced.
  owner?: string;
}

export interface ProductBatch {
  id: string;
  product_id: string;
  quantity: number;
  expiry_date: string; // YYYY-MM-DD
  status: BatchStatus;
  is_notified: boolean;
  created_at: string;
  user_id?: string | null;
  // Local-only ownership scope (Supabase user id, or OFFLINE_SCOPE). Not synced.
  owner?: string;
  // joined
  products?: Product;
  product_name?: string;
  category?: string;
  days_until_expiry?: number;
}

// For offline queue
export type SyncOperation = 'insert' | 'update' | 'delete';
export type SyncTable = 'products' | 'product_batches';

export interface SyncQueueItem {
  id?: number;
  table: SyncTable;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  // for update/delete need id
  recordId?: string;
  createdAt: number;
  retries?: number;
  owner?: string;
}

export interface DashboardStats {
  expired_count: number;
  near_expiry_count: number;
  expiring_this_week: number;
  active_batches: number;
  total_active_quantity: number;
  distinct_products: number;
}
