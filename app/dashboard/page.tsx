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

interface ItemExtendido extends ItemGasto {
  comercio: string;
  fecha: string;
}

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
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalUploadAbierto, setModalUploadAbierto] = useState<boolean>(false);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('');
  const [gastoExpandido, setGastoExpandido] = useState<string | null>(null);
  const [subcategoriaSeleccionada, setSubcategoriaSeleccionada] = useState<string | null>(null);

  const cargarGastos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('gastos')
        .select('*, items_gasto!fk_items_gasto_gastos(*)')
        .order('fecha', { ascending: false });

      if (error) {
        console.error('Error al cargar gastos desde Supabase:', error.message);
        const { data: fallbackData } = await supabaseClient
          .from('gastos')
          .select('*')
          .order('fecha', { ascending: false });
        setGastos(fallbackData || []);
      } else {
        setGastos(data || []);
      }
    } catch (err) {
      console.error('Error inesperado:', err);
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
      if (g.fecha && g.fecha.length >= 7) {
        mesesSet.add(g.fecha.substring(0, 7));
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
    return gastos.filter((g) => g.fecha?.startsWith(mesSeleccionado));
  }, [gastos, mesSeleccionado]);

  // Métrica Total Filtrado
  const totalFiltrado = useMemo(() => {
    return gastosFiltrados.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0);
  }, [gastosFiltrados]);

  // Datos Agrupados por Categoría General
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

  // Todos los ítems desglosados del período filtrado
  const todosLosItems = useMemo<ItemExtendido[]>(() => {
    const itemsList: ItemExtendido[] = [];
    gastosFiltrados.forEach((g) => {
      if (g.items_gasto && g.items_gasto.length > 0) {
        g.items_gasto.forEach((item) => {
          itemsList.push({
            ...item,
            comercio: g.comercio,
            fecha: g.fecha,
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

  // Subcategoría TOP con mayor gasto
  const subcategoriaTop = useMemo(() => {
    return datosPorSubcategoria.length > 0 ? datosPorSubcategoria[0] : null;
  }, [datosPorSubcategoria]);

  // Top 10 Productos Más Caros
  const top10Productos = useMemo(() => {
    return [...todosLosItems]
      .sort((a, b) => Number(b.monto_total) - Number(a.monto_total))
      .slice(0, 10);
  }, [todosLosItems]);

  // Ítems pertenecientes a la subcategoría seleccionada para el Modal
  const itemsSubcategoriaModal = useMemo(() => {
    if (!subcategoriaSeleccionada) return [];
    return todosLosItems.filter(
      (item) => (item.subcategoria || 'Sin subcategoría') === subcategoriaSeleccionada
    );
  }, [todosLosItems, subcategoriaSeleccionada]);

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

  // Exportación a CSV
  const exportarCSV = () => {
    if (gastosFiltrados.length === 0) {
      Swal.fire('Atención', 'No hay datos disponibles para exportar.', 'warning');
      return;
    }

    const encabezados = ['ID Ticket', 'Fecha', 'Comercio', 'Categoría', 'Subcategoría', 'Producto', 'Cant', 'Total Ítem (€)'];
    const filas: string[][] = [];

    gastosFiltrados.forEach((g) => {
      if (g.items_gasto && g.items_gasto.length > 0) {
        g.items_gasto.forEach((item) => {
          filas.push([
            g.id,
            g.fecha,
            `"${g.comercio.replace(/"/g, '""')}"`,
            g.categoria_general || 'General',
            `"${(item.subcategoria || 'General').replace(/"/g, '""')}"`,
            `"${item.descripcion.replace(/"/g, '""')}"`,
            item.cantidad.toString(),
            item.monto_total.toString(),
          ]);
        });
      } else {
        filas.push([
          g.id,
          g.fecha,
          `"${g.comercio.replace(/"/g, '""')}"`,
          g.categoria_general || 'General',
          '-',
          '-',
          '1',
          g.monto_total.toString(),
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
            {/* Filtro Dinámico de Meses */}
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

            {/* Exportar CSV */}
            <button
              onClick={exportarCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-2 rounded-lg text-sm transition shadow-sm flex items-center gap-1.5"
            >
              <span>📊 Exportar CSV</span>
            </button>

            {/* Escanear Ticket */}
            <button
              onClick={() => setModalUploadAbierto(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-sm flex items-center gap-2"
            >
              <span>✨ Escanear Ticket</span>
            </button>
          </div>
        </div>

        {/* Tarjetas KPI (Incluye Subcategoría TOP) */}
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

          {/* Nueva Tarjeta KPI: Subcategoría con Mayor Gasto */}
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
          {/* Gráfico 1: Categorías Generales */}
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

          {/* Gráfico 2: Relevancia por Subcategorías */}
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

        {/* Ranking Top 10 Productos Más Caros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Top 10 Productos Más Caros</h2>
              <p className="text-xs text-gray-500">Ranking de ítems individuales según su precio o monto gastado</p>
            </div>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">
              {mesSeleccionado || 'General'}
            </span>
          </div>

          {top10Productos.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">
              No hay productos registrados para este período.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {top10Productos.map((item, index) => (
                <div key={index} className="py-2.5 flex items-center justify-between text-xs gap-3 hover:bg-gray-50/60 transition px-2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-gray-400 w-5 text-center">{index + 1}.</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.descripcion}</p>
                      <div className="flex items-center gap-2 text-gray-500 mt-0.5">
                        <span>{item.comercio}</span>
                        <span>•</span>
                        <span>{item.fecha}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSubcategoriaSeleccionada(item.subcategoria || 'Sin subcategoría')}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 text-gray-600 rounded-full font-medium text-xs transition"
                      title="Ver todos los productos de esta subcategoría"
                    >
                      🏷️ {item.subcategoria || 'General'}
                    </button>
                    <span className="font-bold text-gray-900 text-sm min-w-[60px] text-right">
                      {Number(item.monto_total).toFixed(2)} €
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                            <li key={item.id || idx} className="flex justify-between text-gray-700 text-xs">
                              <span className="flex items-center gap-2">
                                <span>{item.cantidad}x {item.descripcion}</span>
                                {item.subcategoria && (
                                  <button
                                    onClick={() => setSubcategoriaSeleccionada(item.subcategoria || '')}
                                    className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded hover:bg-indigo-100 hover:text-indigo-700"
                                  >
                                    {item.subcategoria}
                                  </button>
                                )}
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

      {/* Modal Interactivo de Detalle de Subcategoría (Drill-Down) */}
      {subcategoriaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Subcategoría: {subcategoriaSeleccionada}
                </h3>
                <p className="text-xs text-gray-500">
                  Total de ítems comprados en el período
                </p>
              </div>
              <button
                onClick={() => setSubcategoriaSeleccionada(null)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto space-y-2 pr-1">
              {itemsSubcategoriaModal.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No hay ítems asociados.</p>
              ) : (
                itemsSubcategoriaModal.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{item.descripcion}</p>
                      <p className="text-gray-500 mt-0.5">
                        {item.cantidad}x • {item.comercio} ({item.fecha})
                      </p>
                    </div>
                    <span className="font-bold text-indigo-600 text-sm">
                      {Number(item.monto_total).toFixed(2)} €
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">
                Total Subcategoría:{' '}
                {itemsSubcategoriaModal
                  .reduce((acc, curr) => acc + Number(curr.monto_total || 0), 0)
                  .toFixed(2)}{' '}
                €
              </span>
              <button
                onClick={() => setSubcategoriaSeleccionada(null)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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