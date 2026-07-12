'use client';

import React, { useState, useMemo } from 'react';
import { useCompras } from '@/hooks/useCompras';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { DollarSign, Receipt, Calendar, Tag, Search, Plus, Trash2, Eye } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';

export default function DashboardPage() {
  const { purchases, loading, filters, setFilters, refetch } = useCompras();
  const [paginaActual, setPaginaActual] = useState(1);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

  // 1. CÁLCULOS AGREGADOS PARA LAS TARGETAS DE RESUMEN
  const stats = useMemo(() => {
    let totalGasto = 0;
    const categoriasMapa: { [key: string]: number } = {};
    const diasUnicos = new Set<string>();

    purchases.forEach(p => {
      totalGasto += Number(p.total);
      diasUnicos.add(p.fecha);
      
      // Mapear gastos por categorías desde los productos hijos
      if ((p as any).products) {
        (p as any).products.forEach((prod: any) => {
          categoriasMapa[prod.categoria] = (categoriasMapa[prod.categoria] || 0) + Number(prod.precio_total);
        });
      }
    });

    // Encontrar la categoría con mayor peso financiero
    let maxCat = 'Ninguna';
    let maxGasto = 0;
    Object.entries(categoriasMapa).forEach(([cat, val]) => {
      if (val > maxGasto) {
        maxGasto = val;
        maxCat = cat;
      }
    });

    const totalDias = diasUnicos.size || 1;

    return {
      gastoTotal: totalGasto,
      numTickets: purchases.length,
      promedioDiario: totalGasto / totalDias,
      categoriaMasGastada: maxCat
    };
  }, [purchases]);

  // 2. PREPARACIÓN DE DATOS PARA LOS GRÁFICOS (RECHARTS)
  const chartCategoriasData = useMemo(() => {
    const mapa: { [key: string]: number } = {};
    purchases.forEach(p => {
      if ((p as any).products) {
        (p as any).products.forEach((prod: any) => {
          mapa[prod.categoria] = (mapa[prod.categoria] || 0) + Number(prod.precio_total);
        });
      }
    });
    return Object.entries(mapa).map(([name, value]) => ({ name, value }));
  }, [purchases]);

  const chartEvolucionData = useMemo(() => {
    const mapa: { [key: string]: number } = {};
    purchases.forEach(p => {
      mapa[p.fecha] = (mapa[p.fecha] || 0) + Number(p.total);
    });
    return Object.entries(mapa)
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [purchases]);

  // 3. PAGINACIÓN DE LA TABLA (10 registros por página)
  const itemsPorPagina = 10;
  const totalPaginas = Math.ceil(purchases.length / itemsPorPagina) || 1;
  const datosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    return purchases.slice(inicio, inicio + itemsPorPagina);
  }, [purchases, paginaActual]);

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este ticket de forma permanente?')) return;
    // Lógica de eliminación directa respetando RLS
    const { error } = await (await import('@/lib/supabase-client')).supabaseClient
      .from('purchases')
      .delete()
      .eq('id', id);
    if (!error) refetch();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text">Control de Gastos</h1>
          <p className="text-gray-500 text-sm">Gestiona e inspecciona tus comprobantes analizados con IA</p>
        </div>
      </div>
    <div className="flex justify-between items-center mb-6">
     <h1 className="text-2xl font-bold">Mi Dashboard</h1>

  {/* Renderizamos el componente aquí pasando los datos */}
  <ExportButtons purchases={purchases} />
</div>
      {/* FILA DE FILTROS */}
      <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-emerald-50 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Fecha Inicio</label>
          <input 
            type="date" 
            className="w-full text-sm bg-gray-50 dark:bg-dark-bg p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-dark-text focus:outline-none focus:border-emerald-500"
            value={filters.startDate}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Fecha Fin</label>
          <input 
            type="date" 
            className="w-full text-sm bg-gray-50 dark:bg-dark-bg p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-dark-text focus:outline-none focus:border-emerald-500"
            value={filters.endDate}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Categoría</label>
          <select 
            className="w-full text-sm bg-gray-50 dark:bg-dark-bg p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-dark-text focus:outline-none focus:border-emerald-500"
            value={filters.categoria}
            onChange={(e) => setFilters(prev => ({ ...prev, categoria: e.target.value }))}
          >
            <option value="todas">Todas las categorías</option>
            {["Alimentación", "Transporte", "Salud", "Hogar", "Entretenimiento", "Ropa", "Tecnología", "Educación", "Viajes", "Otros"].map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Establecimiento</label>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar comercio..."
              className="w-full text-sm bg-gray-50 dark:bg-dark-bg pl-8 pr-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-dark-text focus:outline-none focus:border-emerald-500"
              value={filters.busqueda}
              onChange={(e) => setFilters(prev => ({ ...prev, busqueda: e.target.value }))}
            />
            <Search className="absolute left-2.5 top-3 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { title: 'Gasto Total', val: formatCurrency(stats.gastoTotal), icon: DollarSign, color: 'text-emerald-700 bg-emerald-50' },
          { title: 'Tickets Procesados', val: stats.numTickets, icon: Receipt, color: 'text-teal-600 bg-teal-50' },
          { title: 'Promedio Diario', val: formatCurrency(stats.promedioDiario), icon: Calendar, color: 'text-cyan-600 bg-cyan-50' },
          { title: 'Categoría Mayor', val: stats.categoriaMasGastada, icon: Tag, color: 'text-amber-600 bg-amber-50' }
        ].map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{card.title}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-dark-text mt-1">{card.val}</p>
            </div>
            <div className={`p-3 rounded-lg ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      {/* FILA DE GRÁFICOS (RECHARTS) */}
      <div id="charts-container" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4">Gasto por Categorías</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartCategoriasData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Bar dataKey="value" fill="#0F766E" radius={[4, 4, 0, 0]} name="Total Gastado" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4">Evolución del Gasto</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartEvolucionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="#14B8A6" strokeWidth={3} dot={{ r: 4 }} name="Gasto Diario" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TABLA DE COMPRAS */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text">Historial de Transacciones</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Cargando transacciones...</div>
        ) : datosPaginados.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No se encontraron tickets en este rango.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-dark-bg text-gray-400 text-xs font-medium uppercase">
                <tr>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Establecimiento</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Moneda</th>
                  <th className="p-4">Productos</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {datosPaginados.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="p-4 whitespace-nowrap font-medium">{formatDate(item.fecha)}</td>
                    <td className="p-4 font-semibold text-gray-800 dark:text-dark-text">{item.establecimiento}</td>
                    <td className="p-4 text-emerald-700 dark:text-emerald-500 font-bold">{formatCurrency(item.total, item.moneda)}</td>
                    <td className="p-4 uppercase text-xs">{item.moneda}</td>
                    <td className="p-4"><span className="bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full text-xs font-semibold">{(item as any).products?.length || 0} items</span></td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => setSelectedPurchase(item)} className="p-1.5 text-gray-400 hover:text-emerald-600 transition"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleEliminar(item.id)} className="p-1.5 text-gray-400 hover:text-rose-600 transition"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Paginación */}
        <div className="p-4 bg-gray-50 dark:bg-dark-bg border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs">
          <span className="text-gray-400">Página {paginaActual} de {totalPaginas}</span>
          <div className="flex gap-2">
            <button disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)} className="px-3 py-1.5 rounded bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 disabled:opacity-50">Anterior</button>
            <button disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(p => p + 1)} className="px-3 py-1.5 rounded bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 disabled:opacity-50">Siguiente</button>
          </div>
        </div>
      </div>

      {/* MODAL MODULAR DE DETALLE DE COMPRA */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card rounded-xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 dark:border-gray-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3 dark:border-gray-800">
              <div>
                <h4 className="text-lg font-bold text-gray-800 dark:text-dark-text">{selectedPurchase.establecimiento}</h4>
                <p className="text-xs text-gray-400">{formatDate(selectedPurchase.fecha)}</p>
              </div>
              <button onClick={() => setSelectedPurchase(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Artículos Desglosados</h5>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {selectedPurchase.products?.map((prod: any) => (
                  <div key={prod.id} className="py-2.5 flex justify-between items-center text-sm">
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-dark-text">{prod.nombre}</p>
                      <span className="inline-block text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full mt-0.5">{prod.categoria}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800 dark:text-dark-text">{formatCurrency(prod.precio_total, selectedPurchase.moneda)}</p>
                      <p className="text-xs text-gray-400">{prod.cantidad} x {formatCurrency(prod.precio_unitary || prod.precio_unitario, selectedPurchase.moneda)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t dark:border-gray-800 flex justify-between items-center font-bold">
              <span className="text-gray-800 dark:text-dark-text">Total Registrado:</span>
              <span className="text-xl text-emerald-700 dark:text-emerald-500">{formatCurrency(selectedPurchase.total, selectedPurchase.moneda)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}