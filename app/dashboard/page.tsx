'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import UploadModal from '@/components/UploadModal';
import Swal from 'sweetalert2';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface ItemGasto {
  id?: string;
  gasto_id?: string;
  descripcion: string;
  subcategoria?: string;
  cantidad: number;
  precio_unitario: number;
  monto_total: number;
}

interface Gasto {
  id: string;
  fecha: string;
  comercio: string;
  categoria_general?: string;
  monto_total: number;
  imagen_url?: string;
  items_gasto?: ItemGasto[];
}

const COLORES_CATEGORIA: Record<string, string> = {
  Alimentación: '#4f46e5', // Indigo
  Transporte: '#06b6d4',   // Cyan
  Hogar: '#10b981',        // Emerald
  Ocio: '#f59e0b',         // Amber
  Salud: '#ef4444',        // Red
  Otros: '#8b5cf6',        // Purple
};

export default function DashboardPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalUploadAbierto, setModalUploadAbierto] = useState<boolean>(false);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('todos');
  const [gastoExpandido, setGastoExpandido] = useState<string | null>(null);

 const cargarGastos = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabaseClient
      .from('gastos')
      .select('*, items_gasto(*)')
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error detallado de Supabase:', error.message, error.details, error.hint);
      
      // Fallback: si falla el join con items_gasto, intentar cargar solo los gastos
      const { data: fallbackData } = await supabaseClient
        .from('gastos')
        .select('*')
        .order('fecha', { ascending: false });

      setGastos(fallbackData || []);
    } else {
      setGastos(data || []);
    }
  } catch (err: any) {
    console.error('Error inesperado al cargar gastos:', err);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    cargarGastos();
  }, []);

  // Eliminar ticket
  const handleEliminarGasto = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const result = await Swal.fire({
      title: '¿Eliminar ticket?',
      text: 'Se borrará el comprobante y todos sus ítems asociados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabaseClient.from('gastos').delete().eq('id', id);
        if (error) throw error;

        Swal.fire('Eliminado', 'El ticket ha sido eliminado correctamente.', 'success');
        cargarGastos();
      } catch (err: any) {
        Swal.fire('Error', err.message || 'No se pudo eliminar el registro.', 'error');
      }
    }
  };

  // Filtrado de gastos
  const gastosFiltrados = useMemo(() => {
    return mesSeleccionado === 'todos'
      ? gastos
      : gastos.filter((g) => g.fecha?.startsWith(mesSeleccionado));
  }, [gastos, mesSeleccionado]);

  const totalFiltrado = useMemo(() => {
    return gastosFiltrados.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0);
  }, [gastosFiltrados]);

  // Datos Agrupados por Categoría para Recharts
  const datosPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    gastosFiltrados.forEach((g) => {
      const cat = g.categoria_general || 'Otros';
      mapa[cat] = (mapa[cat] || 0) + Number(g.monto_total || 0);
    });

    return Object.entries(mapa).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [gastosFiltrados]);

  // Exportar los datos actuales a archivo CSV
  const exportarCSV = () => {
    if (gastosFiltrados.length === 0) {
      Swal.fire('Atención', 'No hay datos disponibles para exportar.', 'warning');
      return;
    }

    const encabezados = ['ID Ticket', 'Fecha', 'Comercio', 'Categoría', 'Total (€)', 'Ítem', 'Precio Ítem (€)'];
    const filas: string[][] = [];

    gastosFiltrados.forEach((g) => {
      if (g.items_gasto && g.items_gasto.length > 0) {
        g.items_gasto.forEach((item) => {
          filas.push([
            g.id,
            g.fecha,
            `"${g.comercio.replace(/"/g, '""')}"`,
            g.categoria_general || 'General',
            g.monto_total.toString(),
            `"${item.descripcion.replace(/"/g, '""')}"`,
            item.monto_total.toString(),
          ]);
        });
      } else {
        filas.push([
          g.id,
          g.fecha,
          `"${g.comercio.replace(/"/g, '""')}"`,
          g.categoria_general || 'General',
          g.monto_total.toString(),
          '-',
          '-',
        ]);
      }
    });

    const contenidoCSV =
      'data:text/csv;charset=utf-8,' +
      [encabezados.join(','), ...filas.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(contenidoCSV);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_gastos_${mesSeleccionado}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control de Gastos</h1>
            <p className="text-sm text-gray-500">Análisis dinámico y gestión de comprobantes</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro de Mes */}
            <select
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="todos">Todos los meses</option>
              <option value="2026-08">Agosto 2026</option>
              <option value="2026-07">Julio 2026</option>
              <option value="2026-06">Junio 2026</option>
            </select>

            {/* Botón Exportar CSV */}
            <button
              onClick={exportarCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-2 rounded-lg text-sm transition shadow-sm flex items-center gap-1.5"
            >
              <span>📊 CSV</span>
            </button>

            {/* Botón Escanear Ticket */}
            <button
              onClick={() => setModalUploadAbierto(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-sm flex items-center gap-2"
            >
              <span>✨ Escanear Ticket</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Filtrado</span>
            <p className="text-3xl font-extrabold text-indigo-600 mt-1">{totalFiltrado.toFixed(2)} €</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Comprobantes</span>
            <p className="text-3xl font-extrabold text-gray-800 mt-1">{gastosFiltrados.length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Promedio / Ticket</span>
            <p className="text-3xl font-extrabold text-emerald-500 mt-1">
              {gastosFiltrados.length > 0
                ? (totalFiltrado / gastosFiltrados.length).toFixed(2)
                : '0.00'}{' '}
              €
            </p>
          </div>
        </div>

        {/* Sección de Gráficos con Recharts */}
        {datosPorCategoria.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráfico Circular: Distribución por Categorías */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
              <h3 className="font-semibold text-gray-800 text-sm mb-4 self-start">Distribución por Categorías</h3>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosPorCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {datosPorCategoria.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORES_CATEGORIA[entry.name] || '#8884d8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} €`, 'Monto']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Barras: Comparativo por Categorías */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
              <h3 className="font-semibold text-gray-800 text-sm mb-4 self-start">Gasto Total por Categoría (€)</h3>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosPorCategoria}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`${value} €`, 'Gasto']} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {datosPorCategoria.map((entry, index) => (
                        <Cell
                          key={`bar-${index}`}
                          fill={COLORES_CATEGORIA[entry.name] || '#4f46e5'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Gastos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Historial de Compras</h2>
            <button onClick={cargarGastos} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              ↻ Actualizar
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando datos desde Supabase...</div>
          ) : gastosFiltrados.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No se encontraron comprobantes para el filtro seleccionado.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {gastosFiltrados.map((gasto) => (
                <div key={gasto.id} className="p-4 hover:bg-gray-50/50 transition">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setGastoExpandido(gastoExpandido === gasto.id ? null : gasto.id)}
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{gasto.comercio}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>{gasto.fecha}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                          {gasto.categoria_general || 'General'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-bold text-gray-900 text-lg">
                        {Number(gasto.monto_total).toFixed(2)} €
                      </span>

                      <button
                        onClick={(e) => handleEliminarGasto(gasto.id, e)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                        title="Eliminar ticket"
                      >
                        🗑️
                      </button>

                      <span className="text-gray-400 text-sm">
                        {gastoExpandido === gasto.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Desglose de Ítems */}
                  {gastoExpandido === gasto.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50 p-3 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Desglose de productos:</p>
                      {gasto.items_gasto && gasto.items_gasto.length > 0 ? (
                        <ul className="space-y-1 text-sm">
                          {gasto.items_gasto.map((item, idx) => (
                            <li key={item.id || idx} className="flex justify-between text-gray-700">
                              <span>
                                {item.cantidad}x {item.descripcion}
                              </span>
                              <span className="font-medium">{Number(item.monto_total).toFixed(2)} €</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Sin ítems detallados.</p>
                      )}

                      {gasto.imagen_url && (
                        <div className="pt-2">
                          <a
                            href={gasto.imagen_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            <span>🔗 Ver imagen original del ticket</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Escaneo e Integración con Gemini */}
      <UploadModal
        isOpen={modalUploadAbierto}
        onClose={() => setModalUploadAbierto(false)}
        onSuccess={() => {
          setModalUploadAbierto(false);
          cargarGastos();
        }}
      />
    </div>
  );
}