// Perfil de usuario [cite: 8]
export interface Profile {
  id: string;
  full_name: string | null;
  role: 'user' | 'admin'; [cite: 8]
}

// Registro de compra/ticket [cite: 14]
export interface Purchase {
  id: number;
  user_id: string;
  establecimiento: string;
  fecha: string; // Formato YYYY-MM-DD
  total: number;
  moneda: string;
  imagen_url: string | null;
  created_at: string;
  products_count?: number; // Campo calculado opcional para la tabla [cite: 56]
}

// Detalle de los productos de un ticket [cite: 22]
export interface Product {
  id: number;
  purchase_id: number;
  nombre: string;
  categoria: string;
  precio_unitario: number;
  cantidad: number;
  precio_total: number;
}

// Estado global para los filtros del dashboard [cite: 51]
export interface FilterState {
  startDate: string;
  endDate: string;
  categoria: string; // 'todas' o una específica [cite: 51]
  busqueda: string;  // Filtro por establecimiento [cite: 51]
}

// Estadísticas para las tarjetas de resumen [cite: 49]
export interface DashboardStats {
  gastoTotal: number;
  numTickets: number;
  promedioDiario: number;
  categoriaMasGastada: string;
}