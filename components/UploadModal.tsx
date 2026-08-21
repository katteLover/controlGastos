'use client';

import { useState, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import Swal from 'sweetalert2';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleClearImage = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProcesar = async () => {
    if (!file) {
      Swal.fire('Atención', 'Por favor selecciona la imagen de un ticket.', 'warning');
      return;
    }

    setLoading(true);

    try {
      // 1. Subir imagen a Supabase Storage (Bucket "tickets")
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      
      let publicUrl = '';
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('tickets')
        .upload(fileName, file);

      if (!uploadError && uploadData) {
        const { data: urlData } = supabaseClient.storage
          .from('tickets')
          .getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      }

      // 2. Escanear con la API de Gemini (@google/genai)
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/scan-ticket', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al analizar la imagen del ticket.');
      }

      const ticketData = json.data;

      // 3. Guardar en la tabla 'gastos'
      const { data: gastoInsert, error: gastoError } = await supabaseClient
        .from('gastos')
        .insert({
          comercio: ticketData.comercio || 'Establecimiento desconocido',
          fecha: ticketData.fecha || new Date().toISOString().split('T')[0],
          categoria_general: ticketData.categoria_general || 'Otros',
          monto_total: ticketData.monto_total || 0,
          imagen_url: publicUrl || null,
        })
        .select()
        .single();

      if (gastoError) {
        throw new Error(`Error en tabla gastos: ${gastoError.message}`);
      }

      // 4. Guardar los ítems en 'items_gasto'
      if (ticketData.items && ticketData.items.length > 0 && gastoInsert) {
        const itemsParaInsertar = ticketData.items.map((item: any) => ({
          gasto_id: gastoInsert.id,
          descripcion: item.descripcion || 'Producto',
          subcategoria: item.subcategoria || null,
          cantidad: item.cantidad || 1,
          precio_unitario: item.precio_unitario || item.monto_total || 0,
          monto_total: item.monto_total || 0,
        }));

        const { error: itemsError } = await supabaseClient
          .from('items_gasto')
          .insert(itemsParaInsertar);

        if (itemsError) {
          console.warn('Advertencia al guardar ítems:', itemsError.message);
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Ticket guardado',
        text: `Comprobante de ${ticketData.comercio || 'compra'} procesado correctamente.`,
      });

      handleClearImage();
      onSuccess();
    } catch (err: any) {
      console.error('Error procesando ticket:', err);
      Swal.fire('Error al guardar', err.message || 'No se pudo procesar el ticket.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Escanear Nuevo Ticket</h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Zona de Arrastre / Vista Previa con límite de tamaño */}
        <div className="my-4 flex-1 overflow-hidden flex flex-col justify-center">
          {preview ? (
            <div className="flex flex-col items-center justify-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl max-h-[380px]">
              <div className="relative w-full max-h-[280px] flex justify-center overflow-hidden">
                <img
                  src={preview}
                  alt="Vista previa del ticket"
                  className="max-h-[280px] max-w-full object-contain rounded-lg shadow-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleClearImage}
                disabled={loading}
                className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
              >
                Cambiar imagen
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition text-center min-h-[200px]">
              <span className="text-3xl mb-2">📸</span>
              <span className="text-sm font-medium text-gray-700">
                Haz clic para subir o arrastra la foto del ticket
              </span>
              <span className="text-xs text-gray-400 mt-1">Soporta JPG, PNG, WEBP</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleProcesar}
            disabled={!file || loading}
            className="px-5 py-2 rounded-lg text-sm bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">🌀</span>
                <span>Procesando...</span>
              </>
            ) : (
              <span>Procesar Ticket</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}