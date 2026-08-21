'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import UploadModal from '@/components/UploadModal';
import Swal from 'sweetalert2';

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
  items_gasto?: ItemGasto[];
}

export default function DashboardPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalUploadAbierto, setModalUploadAbierto] = useState<boolean>(false);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('');
  const [gastoExpandido, setGastoExpandido] = useState<string | null>(null);

  const cargarGastos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('gastos')
        .select('*, items_gasto(*)')
        .order('fecha', { ascending: false });

      if (error) {
        console.error('Error al cargar gastos:', error);
        Swal.fire('Error', 'No se pudieron cargar los datos de la base de datos.', 'error');
      } else {
        const registros = data || [];
        setGastos(registros);

        // Ajustar mes automáticamente al último registro si no hay filtro activo
        if (registros.length > 0 && !mesSeleccionado) {
          setMesSeleccionado(registros[0].fecha.slice(0, 7));
        }
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

  // Filtrar gastos por mes
  const gastosFiltrados = mesSeleccionado
    ? gastos.filter((g) => g.fecha?.startsWith(mesSeleccionado))
    : gastos;

  const totalMes = gastosFiltrados.reduce((acc, curr) => acc + (Number(curr.monto_total) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control de Gastos</h1>
            <p className="text-sm text-gray-500">Gestión de tickets y comprobantes</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filtro de Mes */}
            <input
              type="month"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            {/* Botón para abrir modal de escaneo/subida */}
            <button
              onClick={() => setModalUploadAbierto(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Escanear Ticket</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Filtrado</span>
            <p className="text-3xl font-extrabold text-indigo-600 mt-1">{totalMes.toFixed(2)} €</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Comprobantes</span>
            <p className="text-3xl font-extrabold text-gray-800 mt-1">{gastosFiltrados.length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado de Red</span>
            <p className="text-3xl font-extrabold text-emerald-500 mt-1">Conectado</p>
          </div>
        </div>

        {/* Listado de Gastos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Historial de Compras</h2>
            <button onClick={cargarGastos} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              Refrescar
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando datos desde Supabase...</div>
          ) : gastosFiltrados.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No hay tickets registrados en este período.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {gastosFiltrados.map((gasto) => (
                <div key={gasto.id} className="p-4 hover:bg-gray-50/50 transition">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() =>
                      setGastoExpandido(gastoExpandido === gasto.id ? null : gasto.id)
                    }
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
                      <span className="text-gray-400 text-sm">
                        {gastoExpandido === gasto.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Desglose de Ítems */}
                  {gastoExpandido === gasto.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Desglose:</p>
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Renderizado del Modal */}
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