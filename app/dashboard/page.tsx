'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Gasto, MetricaSubcategoria, ProductoRanking } from '@/types';
import { supabaseClient } from '@/lib/supabase-client';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

export default function DashboardPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [gastoSeleccionado, setGastoSeleccionado] = useState<Gasto | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Cargar gastos reales desde Supabase
  const cargarGastos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('gastos')
        .select('*, items_gasto(*)')
        .order('fecha', { ascending: false });

      if (error) {
        console.error('Error al cargar gastos:', error);
        Swal.fire('Error', 'No se pudieron cargar los comprobantes de la base de datos.', 'error');
      } else {
        setGastos(data || []);
      }
    } catch (err) {
      console.error('Error de conexión:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarGastos();
  }, []);

  // Opciones dinámicas para el filtro Mes-Año
  const opcionesMeses = useMemo(() => {
    const mesesSet = new Set<string>();
    const hoy = new Date().toISOString().slice(0, 7);
    mesesSet.add(hoy);
    gastos.forEach(g => {
      if (g.fecha) mesesSet.add(g.fecha.slice(0, 7));
    });
    return Array.from(mesesSet).sort().reverse();
  }, [gastos]);

  // Filtrado de gastos por el mes seleccionado
  const gastosDelMes = useMemo(() => {
    return gastos.filter(g => g.fecha?.startsWith(mesSeleccionado));
  }, [gastos, mesSeleccionado]);

  // Todos los ítems individuales del mes seleccionado
  const itemsDelMes = useMemo(() => {
    const lista: ProductoRanking[] = [];
    gastosDelMes.forEach(gasto => {
      if (gasto.items_gasto) {
        gasto.items_gasto.forEach(item => {
          lista.push({
            id: item.id || `${gasto.id}-${item.descripcion}`,
            descripcion: item.descripcion,
            subcategoria: item.subcategoria || 'Sin Subcategoría',
            monto_total: item.monto_total,
            precio_unitario: item.precio_unitario,
            cantidad: item.cantidad,
            fecha: gasto.fecha,
            comercio: gasto.comercio
          });
        });
      }
    });
    return lista;
  }, [gastosDelMes]);

  // Total gastado en el mes
  const totalMontoMes = useMemo(() => {
    return gastosDelMes.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0);
  }, [gastosDelMes]);

  // Análisis por Subcategorías
  const metricasSubcategorias = useMemo(() => {
    const agrupado: { [key: string]: { monto: number; items: number } } = {};

    itemsDelMes.forEach(item => {
      const sub = (item.subcategoria || 'General').trim();
      if (!agrupado[sub]) {
        agrupado[sub] = { monto: 0, items: 0 };
      }
      agrupado[sub].monto += Number(item.monto_total) || 0;
      agrupado[sub].items += 1;
    });

    const resultado: MetricaSubcategoria[] = Object.keys(agrupado).map(sub => ({
      subcategoria: sub,
      montoTotal: agrupado[sub].monto,
      porcentaje: totalMontoMes > 0 ? (agrupado[sub].monto / totalMontoMes) * 100 : 0,
      cantidadItems: agrupado[sub].items
    }));

    return resultado.sort((a, b) => b.montoTotal - a.montoTotal);
  }, [itemsDelMes, totalMontoMes]);

  const subcategoriaLider = useMemo(() => {
    return metricasSubcategorias.length > 0 ? metricasSubcategorias[0] : null;
  }, [metricasSubcategorias]);

  // TOP 10 Productos más caros del mes
  const top10Productos = useMemo(() => {
    return [...itemsDelMes]
      .sort((a, b) => b.monto_total - a.monto_total)
      .slice(0, 10);
  }, [itemsDelMes]);

  // Eliminar un ticket en Supabase
  const handleEliminarGasto = async (id: string) => {
    const res = await Swal.fire({
      title: '¿Eliminar comprobante?',
      text: 'Esta acción eliminará el ticket de la base de datos de forma permanente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#4b5563',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
      try {
        // Eliminar ítems asociados si no hay cascada configurada
        await supabaseClient.from('items_gasto').delete().eq('gasto_id', id);

        // Eliminar registro principal del gasto
        const { error } = await supabaseClient.from('gastos').delete().eq('id', id);

        if (error) throw error;

        setGastos(prev => prev.filter(g => g.id !== id));
        Swal.fire('Eliminado', 'El comprobante ha sido borrado de Supabase.', 'success');
      } catch (err: any) {
        console.error('Error al eliminar:', err);
        Swal.fire('Error', 'No se pudo eliminar el registro de Supabase.', 'error');
      }
    }
  };

  // Exportar reporte completo a CSV
  const exportarCSV = () => {
    if (itemsDelMes.length === 0) {
      Swal.fire({
        title: 'Atención',
        text: 'No hay productos registrados en el mes seleccionado para exportar.',
        icon: 'info'
      });
      return;
    }

    const encabezados = ["Fecha", "Comercio", "Producto / Ítem", "Subcategoría", "Cantidad", "Precio Unitario (€)", "Monto Total (€)"];
    
    const filas = itemsDelMes.map(item => [
      item.fecha,
      `"${item.comercio.replace(/"/g, '""')}"`,
      `"${item.descripcion.replace(/"/g, '""')}"`,
      `"${item.subcategoria.replace(/"/g, '""')}"`,
      item.cantidad,
      item.precio_unitario.toFixed(2).replace('.', ','),
      item.monto_total.toFixed(2).replace('.', ',')
    ]);

    const contenidoCSV = [encabezados.join(";"), ...filas.map(f => f.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + contenidoCSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `reporte_gastos_${mesSeleccionado}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* CABECERA, ACCIONES Y SELECTOR DE MES */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard de Gastos</h1>
            <p className="text-sm text-gray-500">Gestión de tickets, escaneo inteligente y análisis de compras</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* BOTÓN NUEVO: ESCANEAR TICKET / FOTO */}
            <Link
              href="/escaneo"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Escanear Ticket</span>
            </Link>

            <button
              onClick={exportarCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a12 12 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>CSV</span>
            </button>

            <select
              id="mes-select"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-medium"
            >
              {opcionesMeses.map(mes => {
                const [year, month] = mes.split('-');
                const fechaObj = new Date(parseInt(year), parseInt(month) - 1);
                const nombreMes = fechaObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                return (
                  <option key={mes} value={mes}>
                    {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}
                  </option>
                );
              })}
            </select>
          </div>
        </header>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl text-center text-gray-500 shadow-sm border border-gray-100">
            <p className="animate-pulse font-medium">Cargando datos desde Supabase...</p>
          </div>
        ) : (
          <>
            {/* TARJETAS DE MÉTRICAS KPI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <span className="text-sm font-semibold text-gray-500">Total Gastado ({mesSeleccionado})</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-gray-900">{totalMontoMes.toFixed(2)} €</span>
                  <span className="text-xs text-gray-400">({gastosDelMes.length} tickets)</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-between">
                <span className="text-sm font-semibold text-blue-800">Subcategoría N° 1 en Gasto</span>
                <div className="mt-2">
                  {subcategoriaLider ? (
                    <>
                      <p className="text-2xl font-bold text-blue-950 truncate">{subcategoriaLider.subcategoria}</p>
                      <p className="text-sm text-blue-700 font-medium mt-1">
                        {subcategoriaLider.montoTotal.toFixed(2)} € <span className="text-xs font-normal">({subcategoriaLider.porcentaje.toFixed(1)}%)</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2">Sin registro de datos</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <span className="text-sm font-semibold text-gray-500">Producto Individual Más Caro</span>
                <div className="mt-2">
                  {top10Productos.length > 0 ? (
                    <>
                      <p className="text-lg font-bold text-gray-900 truncate">{top10Productos[0].descripcion}</p>
                      <p className="text-sm text-red-600 font-semibold mt-0.5">
                        {top10Productos[0].monto_total.toFixed(2)} € <span className="text-xs text-gray-500">({top10Productos[0].subcategoria})</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2">Sin datos en el mes</p>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN VISUAL: TOP 10 PRODUCTOS Y SUBCATEGORÍAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🔥</span> Top 10 Productos Más Caros
                </h2>
                {top10Productos.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No hay productos en este período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs text-gray-400 uppercase">
                          <th className="py-2">#</th>
                          <th className="py-2">Producto</th>
                          <th className="py-2">Subcategoría</th>
                          <th className="py-2 text-right">Monto (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {top10Productos.map((prod, index) => (
                          <tr key={prod.id} className="hover:bg-gray-50 transition">
                            <td className="py-2.5 font-bold text-gray-400">{index + 1}</td>
                            <td className="py-2.5 font-medium text-gray-800 max-w-[180px] truncate" title={prod.descripcion}>
                              {prod.descripcion}
                              <span className="block text-[11px] text-gray-400 font-normal">{prod.comercio} ({prod.fecha})</span>
                            </td>
                            <td className="py-2.5">
                              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                                {prod.subcategoria}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-bold text-gray-900">
                              {prod.monto_total.toFixed(2)} €
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>📊</span> Gastos por Subcategoría
                </h2>
                {metricasSubcategorias.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No hay subcategorías en este período.</p>
                ) : (
                  <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                    {metricasSubcategorias.map(metric => (
                      <div key={metric.subcategoria} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-semibold text-gray-700">{metric.subcategoria}</span>
                          <span className="font-bold text-gray-900">
                            {metric.montoTotal.toFixed(2)} € <span className="text-xs text-gray-400 font-normal">({metric.porcentaje.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(metric.porcentaje, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TABLA PRINCIPAL DE COMPROBANTES */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Comprobantes Registrados ({mesSeleccionado})</h2>
              
              {gastosDelMes.length === 0 ? (
                <div className="text-center py-12 text-gray-500 space-y-3">
                  <p>No tienes tickets registrados en este mes.</p>
                  <Link
                    href="/escaneo"
                    className="inline-block bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium px-4 py-2 rounded-lg text-sm transition"
                  >
                    Escanear tu primer ticket
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b text-gray-600 font-semibold">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Comercio</th>
                        <th className="p-3">Categoría</th>
                        <th className="p-3">Total (€)</th>
                        <th className="p-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {gastosDelMes.map(gasto => (
                        <tr key={gasto.id} className="hover:bg-gray-50 transition">
                          <td className="p-3">{gasto.fecha}</td>
                          <td className="p-3 font-semibold text-gray-800">{gasto.comercio}</td>
                          <td className="p-3">
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium">
                              {gasto.categoria_general || 'General'}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-gray-900">{(Number(gasto.monto_total) || 0).toFixed(2)} €</td>
                          <td className="p-3">
                            <button 
                              onClick={() => setGastoSeleccionado(gasto)} 
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium mr-2 transition"
                            >
                              Ver Ítems ({gasto.items_gasto?.length || 0})
                            </button>
                            <button 
                              onClick={() => handleEliminarGasto(gasto.id)} 
                              className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* MODAL DETALLE DEL COMPROBANTE */}
      {gastoSeleccionado && (
        <div 
          ref={overlayRef} 
          onClick={(e) => { if (e.target === overlayRef.current) setGastoSeleccionado(null); }}
          className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
        >
          <div className="bg-white p-6 rounded-2xl w-full max-w-3xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setGastoSeleccionado(null)} 
              className="absolute top-4 right-4 text-2xl font-bold text-gray-400 hover:text-gray-600"
            >
              &times;
            </button>

            <h2 className="text-xl font-bold mb-2">Detalle de Compra - {gastoSeleccionado.comercio}</h2>
            <p className="text-sm text-gray-500 mb-4">
              Fecha: {gastoSeleccionado.fecha} | Total Ticket: <strong>{(Number(gastoSeleccionado.monto_total) || 0).toFixed(2)} €</strong>
            </p>

            <h3 className="font-bold text-sm text-gray-700 mb-2">Desglose de Ítems y Subcategorías:</h3>
            <div className="border rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Subcategoría</th>
                    <th className="p-3 text-center">Cant.</th>
                    <th className="p-3 text-right">Precio U. (€)</th>
                    <th className="p-3 text-right">Total (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {gastoSeleccionado.items_gasto?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium text-gray-800">{item.descripcion}</td>
                      <td className="p-3">
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                          {item.subcategoria || 'General'}
                        </span>
                      </td>
                      <td className="p-3 text-center">{item.cantidad}</td>
                      <td className="p-3 text-right">{(Number(item.precio_unitario) || 0).toFixed(2)} €</td>
                      <td className="p-3 text-right font-bold text-gray-900">{(Number(item.monto_total) || 0).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {gastoSeleccionado.url_comprobante && (
              <div>
                <h3 className="font-bold text-sm text-gray-700 mb-2">Documento Adjunto:</h3>
                <iframe src={gastoSeleccionado.url_comprobante} className="w-full h-64 border rounded-xl" title="Comprobante Original" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}