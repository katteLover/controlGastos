'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Item {
  nombre: string;
  cantidad: number;
  precio: number;
}

interface Compra {
  id: string;
  fecha: string;
  establecimiento: string;
  categoria: string;
  total: number;
  items: Item[];
  ticket_url?: string;
  user_id?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CATEGORY_COLORS: Record<string, string> = {
  Supermercado: '#10B981',
  Restaurante: '#F59E0B',
  Tecnología: '#3B82F6',
  Ropa: '#EC4899',
  Transporte: '#8B5CF6',
  Entretenimiento: '#EF4444',
  Hogar: '#06B6D4',
  Otros: '#64748B',
};

export default function DashboardPage() {
  // --- Estados de Datos ---
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // --- Estados de Filtros y Búsqueda ---
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- Estados Edición/Eliminación ---
  const [selectedCompra, setSelectedCompra] = useState<Compra | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const fetchCompras = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('compras')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;
      setCompras(data || []);
    } catch (error: any) {
      alert(`Error al cargar el historial: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompras();
    setIsMounted(true);
  }, [fetchCompras]);

  // --- Lógica del Filtro Reactivo Dinámico ---
  const filteredCompras = useMemo(() => {
    return compras.filter((compra) => {
      // 1. Filtro por nombre de establecimiento (IgnoreCase)
      const matchesSearch = compra.establecimiento
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

      // 2. Filtro por Rango de Fechas (Comparación directa de cadenas YYYY-MM-DD segura)
      const matchesStart = startDate ? compra.fecha >= startDate : true;
      const matchesEnd = endDate ? compra.fecha <= endDate : true;

      return matchesSearch && matchesStart && matchesEnd;
    });
  }, [compras, searchTerm, startDate, endDate]);

  // --- Recálculo de Métricas basadas estrictamente en los datos filtrados ---
  const totalGastado = filteredCompras.reduce((acc, curr) => acc + Number(curr.total), 0);
  const promedioGasto = filteredCompras.length > 0 ? totalGastado / filteredCompras.length : 0;

  const chartData = useMemo(() => {
    const agrupado: Record<string, number> = {};
    filteredCompras.forEach((c) => {
      agrupado[c.categoria] = (agrupado[c.categoria] || 0) + Number(c.total);
    });
    
    return Object.keys(agrupado).map((cat) => ({
      name: cat,
      value: parseFloat(agrupado[cat].toFixed(2)),
    }));
  }, [filteredCompras]);

  const resetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  // --- Operaciones CRUD e IA ---
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanning(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('No se encontró una sesión activa de usuario.');

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      const filePath = `comprobantes/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('tickets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('tickets').getPublicUrl(filePath);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('ticketUrl', publicUrl);

      const response = await fetch('/api/procesar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al procesar el ticket con la IA.');

      alert(`¡Escaneo exitoso! Registrado en ${result.compra.establecimiento}.`);
      fetchCompras();
    } catch (error: any) {
      alert(`Error en el escaneo: ${error.message}`);
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleEditItemChange = (index: number, field: keyof Item, value: any) => {
    if (!selectedCompra || !selectedCompra.items) return;
    const updatedItems = [...selectedCompra.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    const nuevoTotal = updatedItems.reduce((acc, item) => {
      return acc + ((Number(item.cantidad) || 0) * (Number(item.precio) || 0));
    }, 0);

    setSelectedCompra({
      ...selectedCompra,
      items: updatedItems,
      total: parseFloat(nuevoTotal.toFixed(2))
    });
  };

  const handleUpdateExisting = async () => {
    if (!selectedCompra) return;
    try {
      const { error } = await supabase
        .from('compras')
        .update({
          establecimiento: selectedCompra.establecimiento,
          fecha: selectedCompra.fecha,
          categoria: selectedCompra.categoria,
          total: selectedCompra.total,
          items: selectedCompra.items
        })
        .eq('id', selectedCompra.id);

      if (error) throw error;
      setShowEditModal(false);
      fetchCompras();
      alert('Gasto modificado correctamente.');
    } catch (error: any) {
      alert(`Error al actualizar: ${error.message}`);
    }
  };

  const handleDeleteExisting = async (id: string, ticketUrl?: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto de forma permanente?')) return;
    try {
      const { error: dbError } = await supabase.from('compras').delete().eq('id', id);
      if (dbError) throw dbError;

      if (ticketUrl) {
        const match = ticketUrl.match(/comprobantes\/.+/);
        if (match) await supabase.storage.from('tickets').remove([match[0]]);
      }

      setShowEditModal(false);
      fetchCompras();
      alert('Gasto eliminado.');
    } catch (error: any) {
      alert(`Error al eliminar: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans antialiased text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Control de Gastos Inteligente</h1>
            <p className="text-sm text-slate-500 mt-1">Filtrado en tiempo real impulsado por Gemini 3.1 Flash Lite en el backend.</p>
          </div>

          <div>
            <label className={`flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-200 hover:bg-blue-700 transition cursor-pointer select-none ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
              <span>{isScanning ? '🔄 Leyendo ticket con IA...' : '📷 Escanear Nuevo Ticket'}</span>
              <input type="file" accept="image/*,application/pdf" capture="environment" onChange={handleFileScan} className="hidden" disabled={isScanning} />
            </label>
          </div>
        </div>

        {/* CONTENEDOR DE MÉTRICAS Y GRÁFICO (SE ACTUALIZAN CON LOS FILTROS) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex flex-col justify-between gap-4 lg:col-span-1">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Gastado (Filtrado)</span>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{formatEuro(totalGastado)}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tickets Encontrados</span>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{filteredCompras.length}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gasto Promedio</span>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{formatEuro(promedioGasto)}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col justify-between min-h-[260px]">
            <div className="border-b pb-2 mb-2">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Distribución Segmentada</h3>
            </div>
            <div className="flex-1 w-full h-[200px] flex items-center justify-center">
              {loading ? (
                <p className="text-xs font-medium text-slate-400">Cargando...</p>
              ) : filteredCompras.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay datos en el rango seleccionado.</p>
              ) : isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="40%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#64748B'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatEuro(value)} />
                    <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingLeft: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>

        {/* BLOQUE DE FILTROS AVANZADOS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Buscar por Comercio</label>
            <input 
              type="text" 
              placeholder="Ej. Mercadona, Amazon..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desde (Fecha)</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hasta (Fecha)</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {(searchTerm || startDate || endDate) && (
              <button 
                type="button" 
                onClick={resetFilters} 
                className="px-3 py-2 bg-slate-100 text-slate-600 font-medium text-xs rounded-xl hover:bg-slate-200 transition mt-5 h-[38px]"
                title="Limpiar filtros"
              >
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Tabla / Historial Principal */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-bold text-slate-800 text-base">Historial de Transacciones</h2>
            {filteredCompras.length !== compras.length && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-semibold">
                Mostrando {filteredCompras.length} de {compras.length} registros
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400 font-medium">Cargando transacciones de la base de datos...</div>
          ) : filteredCompras.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400 italic">No se encontraron transacciones que coincidan con los filtros aplicados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b">
                  <tr>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Establecimiento</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4 text-center">Ticket / Acción</th>
                    <th className="p-4 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredCompras.map((compra) => (
                    <tr key={compra.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 text-slate-500 whitespace-nowrap">{compra.fecha}</td>
                      <td className="p-4 font-semibold text-slate-900">{compra.establecimiento}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${CATEGORY_COLORS[compra.categoria]}15`, color: CATEGORY_COLORS[compra.categoria] }}>
                          {compra.categoria}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {compra.ticket_url && (
                            <a href={compra.ticket_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition">
                              Ver original ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCompra(JSON.parse(JSON.stringify(compra)));
                              setShowEditModal(true);
                            }}
                            className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200 transition"
                          >
                            ✏️ Editar
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900 whitespace-nowrap">{formatEuro(Number(compra.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* MODAL LADO A LADO PARA EDITAR / ELIMINAR */}
      {showEditModal && selectedCompra && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-800 text-lg">Modificar Registro Guardado</h3>
                <button type="button" onClick={() => handleDeleteExisting(selectedCompra.id, selectedCompra.ticket_url)} className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition">
                  🗑️ Eliminar permanentemente
                </button>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-medium p-1">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
              <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 flex flex-col justify-center items-center min-h-[250px] md:max-h-[550px] overflow-hidden">
                {selectedCompra.ticket_url ? (
                  selectedCompra.ticket_url.includes('.pdf') ? (
                    <div className="text-center p-6">
                      <p className="text-sm font-medium text-slate-700">Documento PDF del ticket</p>
                      <a href={selectedCompra.ticket_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-2 inline-block">Abrir PDF en pestaña nueva ↗</a>
                    </div>
                  ) : (
                    <img src={selectedCompra.ticket_url} alt="Comprobante físico" className="max-w-full max-h-[480px] object-contain rounded-lg shadow-sm" />
                  )
                ) : (
                  <p className="text-xs text-slate-400 italic">Este gasto no tiene un archivo físico asociado.</p>
                )}
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Establecimiento</label>
                    <input type="text" value={selectedCompra.establecimiento || ''} onChange={(e) => setSelectedCompra({ ...selectedCompra, establecimiento: e.target.value })} className="w-full px-4 py-2 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                      <input type="date" value={selectedCompra.fecha || ''} onChange={(e) => setSelectedCompra({ ...selectedCompra, fecha: e.target.value })} className="w-full px-4 py-2 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                      <select value={selectedCompra.categoria || 'Otros'} onChange={(e) => setSelectedCompra({ ...selectedCompra, categoria: e.target.value })} className="w-full px-4 py-2 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        <option value="Supermercado">Supermercado</option>
                        <option value="Restaurante">Restaurante</option>
                        <option value="Tecnología">Tecnología</option>
                        <option value="Ropa">Ropa</option>
                        <option value="Transporte">Transporte</option>
                        <option value="Entretenimiento">Entretenimiento</option>
                        <option value="Hogar">Hogar</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Importe Total Acumulado (€)</label>
                    <input type="number" step="0.01" value={selectedCompra.total || 0} onChange={(e) => setSelectedCompra({ ...selectedCompra, total: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border rounded-xl bg-slate-50 font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Desglose de Artículos</label>
                    <div className="border rounded-xl max-h-[180px] overflow-y-auto bg-slate-50">
                      {(!selectedCompra.items || selectedCompra.items.length === 0) ? (
                        <p className="p-4 text-xs text-slate-400 italic text-center">Sin artículos detallados en este ticket.</p>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-500 sticky top-0 font-bold">
                            <tr>
                              <th className="p-2 w-7/12">Producto</th>
                              <th className="p-2 w-2/12 text-center">Cant.</th>
                              <th className="p-2 w-3/12 text-right">Precio Un.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y bg-white">
                            {selectedCompra.items.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="p-1"><input type="text" value={item.nombre || ''} onChange={(e) => handleEditItemChange(idx, 'nombre', e.target.value)} className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded focus:outline-none" /></td>
                                <td className="p-1"><input type="number" value={item.cantidad ?? 1} onChange={(e) => handleEditItemChange(idx, 'cantidad', parseInt(e.target.value) || 0)} className="w-full text-center px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded focus:outline-none" /></td>
                                <td className="p-1"><input type="number" step="0.01" value={item.precio ?? 0} onChange={(e) => handleEditItemChange(idx, 'precio', parseFloat(e.target.value) || 0)} className="w-full text-right px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded focus:outline-none font-medium" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t flex gap-3 justify-end bg-white">
                  <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                  <button type="button" onClick={handleUpdateExisting} className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-md transition">Guardar Cambios</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}