export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  nombre?: string;
  role?: 'user' | 'admin';
  is_admin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ItemGasto {
  id?: string;
  gasto_id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  monto_total: number;
  subcategoria?: string; // <--- Cambiado a opcional (?) para evitar fallos si viene vacía o nula
}

export interface Gasto {
  id: string;
  created_at?: string;
  fecha: string;
  comercio: string;
  categoria_general?: string;
  monto_total: number;
  moneda?: string;
  url_comprobante?: string;
  user_id?: string;
  items_gasto?: ItemGasto[];
}

// Aliases para compatibilidad con hooks/componentes
export type Purchase = Gasto;
export type PurchaseItem = ItemGasto;

export interface FilterState {
  search?: string;
  busqueda?: string;
  category?: string;
  categoria?: string;
  subcategoria?: string;
  merchant?: string;
  comercio?: string;
  startDate?: string;
  fechaInicio?: string;
  endDate?: string;
  fechaFin?: string;
  mes?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface MetricaSubcategoria {
  subcategoria: string;
  montoTotal: number;
  porcentaje: number;
  cantidadItems: number;
}

export interface ProductoRanking {
  id: string;
  descripcion: string;
  subcategoria: string;
  monto_total: number;
  precio_unitario: number;
  cantidad: number;
  fecha: string;
  comercio: string;
}

export interface EscaneoTicketResultado {
  fecha: string;
  comercio: string;
  categoria_general: string;
  monto_total: number;
  items: Omit<ItemGasto, 'id' | 'gasto_id'>[];
}