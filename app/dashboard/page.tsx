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

const COLORES_CATEGORIA: Record<string, string> = {
  Alimentación: '#4f46e5',
  Transporte: '#06b6d4',
  Hogar: '#10b981',
  Ocio: '#f59e0b',
  Salud: '#ef4444',
  Otros: '#8b5cf6',
};

const PALETA_SUBCATEGORIAS = [
  '#6366f1', '#14b8a6', '#f97316', '#ec4899',
  '#8b5cf6', '#3b82f6', '#10b981', '#eab308'
];

export default function DashboardPage() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalUploadAbierto, setModalUploadAbierto] = useState<boolean>(false);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('');
  const [gastoExpandido, setGastoExpandido] = useState<string | null>(null);
  const [subcategoriaSeleccionada, setSubcategoriaSeleccionada] = useState<string | null>(null);

  const cargarGastos = async () => {
    setLoading(true);
    try {
      // Intentamos primero con la relación integrada
      const { data, error } = await supabaseClient
        .from('gastos')
        .select('*, items_gasto:items_gasto(gasto_id(*))') // o usa el nombre exacto de tu FK
  .order('fecha', { ascending: false });

      if (error) {
        console.warn('Advertencia con relación de ítems, cargando tabla base:', error.message);
        const { data: fallbackData } = await supabaseClient
          .from('gastos')
          .select('*')
          .order('fecha', { ascending: false });
        setGastos(fallbackData || []);
      } else {
        setGastos(data || []);
      }
    } catch (err) {
      console.error('Error inesperado al cargar gastos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarGastos();
  }, []);

  // Extraer meses con tickets disponibles ordenados descendentemente
  const mesesDisponibles = useMemo(() => {
    const mesesSet = new Set<string>();
    gastos.forEach((g) => {
      const fechaStr = g.fecha || g.created_at;
      if (fechaStr && fechaStr.length >= 7) {
        mesesSet.add(fechaStr.substring(0, 7));
      }
    });
    return Array.from(mesesSet).sort().reverse();
  }, [gastos]);

  // Asignar por defecto el mes más reciente con datos
  useEffect(() => {
    if (mesesDisponibles.length > 0 && !mesSeleccionado) {
      setMesSeleccionado(mesesDisponibles[0]);
    }
  }, [mesesDisponibles, mesSeleccionado]);

  // Filtrado de gastos por mes seleccionado
  const gastosFiltrados = useMemo(() => {
    if (!mesSeleccionado || mesSeleccionado === 'todos') {
      return gastos;
    }
    return gastos.filter((g) => {
      const fechaStr = g.fecha || g.created_at || '';
      return fechaStr.startsWith(mesSeleccionado);
    });
  }, [gastos, mesSeleccionado]);

  // Métrica Total Filtrado (flexible ante nombres de columnas)
  const totalFiltrado = useMemo(() => {
    return gastosFiltrados.reduce((acc, curr) => {
      const monto = curr.monto_total || curr.monto || curr.total || curr.precio || 0;
      return acc + Number(monto);
    }, 0);
  }, [gastosFiltrados]);

  // Datos Agrupados por Categoría General
  const datosPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    gastosFiltrados.forEach((g) => {
      const cat = g.categoria_general || g.categoria || 'Otros';
      const monto = Number(g.monto_total || g.monto || g.total || 0);
      mapa[cat] = (mapa[cat] || 0) + monto;
    });

    return Object.entries(mapa).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [gastosFiltrados]);

  // Todos los ítems desglosados del período filtrado
  const todosLosItems = useMemo<any[]>(() => {
    const itemsList: any[] = [];
    gastosFiltrados.forEach((g) => {
      const comercioVal = g.comercio || g.descripcion || g.concepto || 'Comercio desconocido';
      const fechaVal = g.fecha || g.created_at || '';
      
      if (g.items_gasto && Array.isArray(g.items_gasto) && g.items_gasto.length > 0) {
        g.items_gasto.forEach((item: any) => {
          itemsList.push({
            ...item,
            comercio: comercioVal,
            fecha: fechaVal,
            monto_total: item.monto_total || item.precio_unitario || item.monto || 0
          });
        });
      }
    });
    return itemsList;
  }, [gastosFiltrados]);

  // Agrupamiento por Subcategoría
  const datosPorSubcategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    todosLosItems.forEach((item) => {
      const subcat = item.subcategoria || 'Sin subcategoría';
      mapa[subcat] = (mapa[subcat] || 0) + Number(item.monto_total || 0);
    });

    return Object.entries(mapa)
      .map(([subcategoria, total]) => ({
        subcategoria,
        total: parseFloat(total.toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [todosLosItems]);

  const subcategoriaTop = useMemo(() => {
    return datosPorSubcategoria.length > 0 ? datosPorSubcategoria[0] : null;
  }, [datosPorSubcategoria]);

  const top10Productos = useMemo(() => {
    return [...todosLosItems]
      .sort((a, b) => Number(b.monto_total) - Number(a.monto_total))
      .slice(0, 10);
  }, [todosLosItems]);

  const itemsSubcategoriaModal = useMemo(() => {
    if (!subcategoriaSeleccionada) return [];
    return todosLosItems.filter(
      (item) => (item.subcategoria || 'Sin subcategoría') === subcategoriaSeleccionada
    );
  }, [todosLosItems, subcategoriaSeleccionada]);

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

  const exportarCSV = () => {
    if (gastosFiltrados.length === 0) {
      Swal.fire('Atención', 'No hay datos disponibles para exportar.', 'warning');
      return;
    }

    const encabezados = ['ID Ticket', 'Fecha', 'Comercio', 'Categoría', 'Subcategoría', 'Producto', 'Cant', 'Total Ítem (€)'];
    const filas: string[][] = [];

    gastosFiltrados.forEach((g) => {
      const comercioVal = g.comercio || g.descripcion || 'Comercio';
      const fechaVal = g.fecha || g.created_at || '';
      const catVal = g.categoria_general || 'General';
      const montoTotalVal = g.monto_total || g.monto || 0;

      if (g.items_gasto && Array.isArray(g.items_gasto) && g.items_gasto.length > 0) {
        g.items_gasto.forEach((item: any) => {
          filas.push([
            g.id,
            fechaVal,
            `"${comercioVal.replace(/"/g, '""')}"`,
            catVal,
            `"${(item.subcategoria || 'General').replace(/"/g, '""')}"`,
            `"${(item.descripcion || 'Producto').replace(/"/g, '""')}"`,
            (item.cantidad || 1).toString(),
            (item.monto_total || item.precio_unitario || 0).toString(),
          ]);
        });
      } else {
        filas.push([
          g.id,
          fechaVal,
          `"${comercioVal.replace(/"/g, '""')}"`,
          catVal,
          '-',
          '-',
          '1',
          montoTotalVal.toString(),
        ]);
      }
    });

    const contenidoCSV =
      'data:text/csv;charset=utf-8,' +
      [encabezados.join(','), ...filas.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(contenidoCSV);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_gastos_${mesSeleccionado || 'general'}.csv`);
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
            <p className="text-sm text-gray-500">Análisis detallado de compras y subcategorías</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium text-gray-700"
            >
              <option value="todos">Todos los meses</option>
              {mesesDisponibles.map((mes) => (
                <option key={mes} value={mes}>
                  {mes}
                </option>
              ))}
            </select>

            <button
              onClick={exportarCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-2 rounded-lg text-sm transition shadow-sm flex items-center gap-1.5"
            >
              <span>📊 Exportar CSV</span>
            </button>

            <button
              onClick={() => setModalUploadAbierto(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-sm flex items-center gap-2"
            >
              <span>✨ Escanear Ticket</span>
            </button>
          </div>
        </div>

        {/* Tarjetas KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Filtrado</span>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">{totalFiltrado.toFixed(2)} €</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Comprobantes</span>
            <p className="text-2xl font-extrabold text-gray-800 mt-1">{gastosFiltrados.length}</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Promedio / Ticket</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">
              {gastosFiltrados.length > 0
                ? (totalFiltrado / gastosFiltrados.length).toFixed(2)
                : '0.00'}{' '}
              €
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Mayor Gasto Subcat.
            </span>
            {subcategoriaTop ? (
              <div
                className="mt-1 cursor-pointer group"
                onClick={() => setSubcategoriaSeleccionada(subcategoriaTop.subcategoria)}
              >
                <p className="text-lg font-bold text-amber-600 truncate group-hover:underline" title={subcategoriaTop.subcategoria}>
                  {subcategoriaTop.subcategoria}
                </p>
                <p className="text-xs font-semibold text-gray-500">
                  {subcategoriaTop.total.toFixed(2)} €
                </p>
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-300 mt-1">Sin datos</p>
            )}
          </div>
        </div>

        {/* Sección de Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
            <h3 className="font-semibold text-gray-800 text-sm mb-4 self-start">Distribución por Categorías</h3>
            {datosPorCategoria.length > 0 ? (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosPorCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
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
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-gray-400">Sin datos</div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
            <h3 className="font-semibold text-gray-800 text-sm mb-4 self-start">
              Top Subcategorías de Mayor Gasto (€)
            </h3>
            {datosPorSubcategoria.length > 0 ? (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={datosPorSubcategoria.slice(0, 7)}
                    margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="subcategoria" type="category" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={(value: number) => [`${value} €`, 'Gasto Total']} />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                      {datosPorSubcategoria.slice(0, 7).map((_, index) => (
                        <Cell
                          key={`subcat-cell-${index}`}
                          fill={PALETA_SUBCATEGORIAS[index % PALETA_SUBCATEGORIAS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-gray-400">Sin datos</div>
            )}
          </div>
        </div>

        {/* Historial Completo de Tickets */}
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
              {gastosFiltrados.map((gasto) => {
                const comercioStr = gasto.comercio || gasto.descripcion || 'Comercio';
                const fechaStr = gasto.fecha || gasto.created_at || '';
                const montoStr = Number(gasto.monto_total || gasto.monto || 0).toFixed(2);

                return (
                  <div key={gasto.id} className="p-4 hover:bg-gray-50/50 transition">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setGastoExpandido(gastoExpandido === gasto.id ? null : gasto.id)}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{comercioStr}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{fechaStr}</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                            {gasto.categoria_general || 'General'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-900 text-lg">
                          {montoStr} €
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
                        {gasto.items_gasto && Array.isArray(gasto.items_gasto) && gasto.items_gasto.length > 0 ? (
                          <ul className="space-y-1 text-sm">
                            {gasto.items_gasto.map((item: any, idx: number) => (
                              <li key={item.id || idx} className="flex justify-between text-gray-700 text-xs">
                                <span className="flex items-center gap-2">
                                  <span>{item.cantidad || 1}x {item.descripcion}</span>
                                  {item.subcategoria && (
                                    <button
                                      onClick={() => setSubcategoriaSeleccionada(item.subcategoria)}
                                      className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded hover:bg-indigo-100 hover:text-indigo-700"
                                    >
                                      {item.subcategoria}
                                    </button>
                                  )}
                                </span>
                                <span className="font-medium">{Number(item.monto_total || item.precio_unitario || 0).toFixed(2)} €</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Sin ítems detallados.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Escaneo con Gemini */}
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