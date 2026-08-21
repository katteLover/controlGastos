export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  nombre?: string;
  role?: 'user' | 'admin'; // Tipo estricto requerido por app/admin/page.tsx
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
  subcategoria: string;
}

export interface Gasto {
  id: string;
  created_at?: string;
  fecha: string;
  comercio: string;
  categoria_general: string;
  monto_total: number;
  moneda: string;
  url_comprobante?: string;
  user_id?: string;
  items_gasto?: ItemGasto[];
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