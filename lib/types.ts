export type Category = {
  id: string;
  name: string;
  sort_order?: number;
  created_at: string;
};

export type Equipment = {
  id: string;
  category_id: string | null;
  manufacturer: string;
  model: string;
  stock_count: number;
  is_rental_only?: boolean; // optional for backward compat
  properties: Record<string, unknown>;
  notes: string | null;
  url: string | null;
  power_consumption: string | null;
  weight: string | null;
  dimensions: string | null;
  unit_price: number | null;
  origin_country: string | null;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  name: string;
  location: string | null;
  start_at: string;
  end_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EventUsage = {
  id: string;
  event_id: string;
  equipment_id: string;
  quantity: number;
  notes: string | null;
  created_at: string;
};

export type Rental = {
  id: string;
  equipment_id: string;
  quantity: number;
  company: string;
  arrive_at: string; // 到着
  return_at: string; // 返却
  arrive_place: string | null;
  return_place: string | null;
  notes: string | null;
  arranged?: boolean;
  created_at: string;
};

export type EquipmentUnit = {
  id: string;
  equipment_id: string;
  serial: string | null;
  status: string; // '正常' | '故障' | '点検中' | '予備' | '廃棄'
  note: string | null;
  active: boolean; // 在籍中（在庫として数える）
  created_at: string;
  updated_at: string;
};
