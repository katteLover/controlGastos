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
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<boolean>(false);
  const [pasoActual, setPasoActual] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImagen(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const procesarYGuardarTicket = async () => {
    if (!imagen) {
      Swal.fire('Atención', 'Por favor selecciona o toma una foto del ticket.', 'warning');
      return;
    }

    setProcesando(true);
    setPasoActual('Analizando ticket con IA y aplicando reglas de OCR...');

    try {
      // 1. Convertir la imagen a Base64 para enviarla a tu ruta de API o servicio de IA
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(imagen);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

      // 2. Llamada al endpoint de procesamiento (puedes ajustar la ruta según tu backend o Server Action)
      const response = await fetch('/api/procesar-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imagenBase64: base64Image }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar la imagen en el servidor.');
      }

      const dataOCR = await response.json();
      
      // El JSON estructurado según el prompt experto: { gasto: {...}, items: [...] }
      const { gasto, items } = dataOCR;

      if (!gasto || !items) {
        throw new Error('La estructura devuelta por la IA no es válida.');
      }

      setPasoActual('Guardando comprobante e ítems en Supabase...');

      // 3. Insertar el gasto principal en Supabase
      const { data: gastoInsertado, error: errorGasto } = await supabaseClient
        .from('gastos')
        .insert([
          {
            comercio: gasto.comercio,
            categoria_general: gasto.categoria_general,
            fecha: gasto.fecha,
            monto_total: Number(gasto.monto_total),
            moneda: gasto.moneda || 'EUR',
          },
        ])
        .select()
        .single();

      if (errorGasto) throw errorGasto;

      const gastoId = gastoInsertado.id;

      // 4. Preparar e insertar los ítems asociados utilizando el ID del gasto
      if (items && items.length > 0) {
        const itemsAInsertar = items.map((item: any) => ({
          gasto_id: gastoId,
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad || 1.0),
          precio_unitario: Number(item.precio_unitario || 0),
          monto_total: Number(item.monto_total || 0),
          subcategoria: item.subcategoria || 'Otros',
        }));

        const { error: errorItems } = await supabaseClient
          .from('items_gasto')
          .insert(itemsAInsertar);

        if (errorItems) throw errorItems;
      }

      Swal.fire({
        title: '¡Ticket procesado!',
        text: `Se registró correctamente el gasto en ${gasto.comercio} (${gasto.monto_total} €).`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });

      setImagen(null);
      setPreview(null);
      onSuccess();
    } catch (error: any) {
      console.error('Error en el flujo de escaneo:', error);
      Swal.fire('Error', error.message || 'No se pudo completar el procesamiento del ticket.', 'error');
    } finally {
      setProcesando(false);
      setPasoActual('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-800 text-lg">Escanear Ticket o Factura</h3>
          <button
            onClick={onClose}
            disabled={procesando}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-4">
          {!preview ? (
            <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition bg-gray-50/50 group">
              <span className="text-3xl mb-2 group-hover:scale-110 transition">📄</span>
              <span className="text-sm font-semibold text-gray-700">Sube o arrastra tu ticket aquí</span>
              <span className="text-xs text-gray-400 mt-1">Formatos soportados: PNG, JPG, WEBP</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative w-full h-52 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
                <img src={preview} alt="Vista previa" className="max-h-full object-contain" />
              </div>
              {!procesando && (
                <button
                  onClick={() => {
                    setImagen(null);
                    setPreview(null);
                  }}
                  className="w-full text-xs text-indigo-600 hover:underline font-medium text-center"
                >
                  Cambiar imagen seleccionada
                </button>
              )}
            </div>
          )}

          {procesando && (
            <div className="space-y-2 text-center py-2">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
              <p className="text-xs font-medium text-indigo-600">{pasoActual}</p>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={procesando}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200/60 transition"
          >
            Cancelar
          </button>
          <button
            onClick={procesarYGuardarTicket}
            disabled={!imagen || procesando}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {procesando ? 'Procesando...' : 'Analizar y Guardar'}
          </button>
        </div>

      </div>
    </div>
  );
}