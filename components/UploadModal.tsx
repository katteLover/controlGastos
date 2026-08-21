'use client';

import { useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import Swal from 'sweetalert2';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [comercio, setComercio] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('Alimentación');
  const [montoTotal, setMontoTotal] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comercio || !montoTotal) {
      Swal.fire('Atención', 'Por favor completa el comercio y el monto total.', 'warning');
      return;
    }

    setLoading(true);

    try {
      // 1. Insertar en la tabla 'gastos'
      const { data: gastoData, error: gastoError } = await supabaseClient
        .from('gastos')
        .insert([
          {
            comercio,
            fecha,
            categoria_general: categoria,
            monto_total: parseFloat(montoTotal),
          },
        ])
        .select()
        .single();

      if (gastoError) throw gastoError;

      // 2. Insertar ítem genérico por defecto
      if (gastoData) {
        const { error: itemError } = await supabaseClient.from('items_gasto').insert([
          {
            gasto_id: gastoData.id,
            descripcion: `Compra en ${comercio}`,
            subcategoria: categoria,
            cantidad: 1,
            precio_unitario: parseFloat(montoTotal),
            monto_total: parseFloat(montoTotal),
          },
        ]);

        if (itemError) throw itemError;
      }

      Swal.fire('¡Éxito!', 'Comprobante guardado correctamente.', 'success');
      onSuccess();
    } catch (err: any) {
      console.error('Error al guardar:', err);
      Swal.fire('Error', err.message || 'No se pudo guardar el comprobante en Supabase.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
        {/* Cabecera del Modal */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Comprobante / Ticket
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-indigo-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Establecimiento / Comercio
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Mercadona, Carrefour..."
              value={comercio}
              onChange={(e) => setComercio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-gray-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                Fecha
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-gray-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                Monto Total (€)
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-gray-800"
            >
              <option value="Alimentación">Alimentación</option>
              <option value="Transporte">Transporte</option>
              <option value="Hogar">Hogar</option>
              <option value="Ocio">Ocio</option>
              <option value="Salud">Salud</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Guardando...
                </>
              ) : (
                'Guardar Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}