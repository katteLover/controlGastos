'use client';

import { useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import Swal from 'sweetalert2';

interface ItemExtraido {
  descripcion: string;
  subcategoria?: string;
  cantidad: number;
  precio_unitario: number;
  monto_total: number;
}

interface DatosExtraidos {
  comercio: string;
  fecha: string;
  categoria_general: string;
  monto_total: number;
  items: ItemExtraido[];
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Datos del ticket procesado por Gemini
  const [datosTicket, setDatosTicket] = useState<DatosExtraidos | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDatosTicket(null); // Resetear escaneo previo si cambia la foto
    }
  };

  const handleEscaneoIA = async () => {
    if (!selectedFile) return;
    setScanning(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/scan-ticket', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'No se pudo procesar la imagen.');
      }

      setDatosTicket(result.data);
      Swal.fire({
        icon: 'success',
        title: 'Ticket procesado',
        text: 'Revisa y ajusta los datos extraídos antes de guardar.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', err.message || 'Fallo en la lectura con IA.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleGuardarEnSupabase = async () => {
    if (!datosTicket) return;
    setSaving(true);

    try {
      let imagen_url = '';

      // Opcional: Subir la imagen a Supabase Storage (bucket 'tickets')
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('tickets')
          .upload(fileName, selectedFile);

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabaseClient.storage
            .from('tickets')
            .getPublicUrl(fileName);
          imagen_url = publicUrlData.publicUrl;
        }
      }

      // 1. Guardar en la tabla 'gastos'
      const { data: gastoData, error: gastoError } = await supabaseClient
        .from('gastos')
        .insert([
          {
            comercio: datosTicket.comercio,
            fecha: datosTicket.fecha,
            categoria_general: datosTicket.categoria_general,
            monto_total: Number(datosTicket.monto_total),
            imagen_url,
          },
        ])
        .select()
        .single();

      if (gastoError) throw gastoError;

      // 2. Guardar el desglose de ítems en 'items_gasto'
      if (datosTicket.items && datosTicket.items.length > 0) {
        const itemsAInsertar = datosTicket.items.map((item) => ({
          gasto_id: gastoData.id,
          descripcion: item.descripcion,
          subcategoria: item.subcategoria || datosTicket.categoria_general,
          cantidad: Number(item.cantidad) || 1,
          precio_unitario: Number(item.precio_unitario) || 0,
          monto_total: Number(item.monto_total) || 0,
        }));

        const { error: itemsError } = await supabaseClient
          .from('items_gasto')
          .insert(itemsAInsertar);

        if (itemsError) throw itemsError;
      }

      Swal.fire('¡Éxito!', 'Ticket e ítems guardados correctamente.', 'success');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error al guardar', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <span>📷</span> Escaneo Inteligente de Tickets
          </h3>
          <button onClick={onClose} className="hover:bg-indigo-700 p-1.5 rounded-lg transition">
            ✕
          </button>
        </div>

        {/* Body Lado a Lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 overflow-y-auto flex-1">
          {/* LADO IZQUIERDO: Previsualización de Imagen */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 min-h-[320px]">
            {previewUrl ? (
              <div className="relative w-full h-full flex flex-col items-center">
                <img
                  src={previewUrl}
                  alt="Ticket Escaneado"
                  className="max-h-[400px] object-contain rounded-lg shadow-sm"
                />
                <label className="mt-4 text-xs text-indigo-600 font-semibold cursor-pointer hover:underline">
                  Cambiar imagen
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer space-y-2">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-600">Haz clic para subir la foto del ticket</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}

            {selectedFile && !datosTicket && (
              <button
                onClick={handleEscaneoIA}
                disabled={scanning}
                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg shadow transition flex items-center justify-center gap-2"
              >
                {scanning ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Procesando con Gemini...</span>
                  </>
                ) : (
                  <span>✨ Procesar Ticket con IA</span>
                )}
              </button>
            )}
          </div>

          {/* LADO DERECHO: Datos Extraídos y Editables */}
          <div className="space-y-4">
            {!datosTicket ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-center p-6 border rounded-xl bg-gray-50/50">
                <p className="text-sm">Suba una imagen y presione "Procesar Ticket con IA" para extraer el desglose de productos automáticamente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 text-sm border-b pb-2">Revisión de Datos Extraídos</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Comercio</label>
                    <input
                      type="text"
                      value={datosTicket.comercio}
                      onChange={(e) => setDatosTicket({ ...datosTicket, comercio: e.target.value })}
                      className="w-full mt-1 border px-3 py-1.5 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Fecha</label>
                    <input
                      type="date"
                      value={datosTicket.fecha}
                      onChange={(e) => setDatosTicket({ ...datosTicket, fecha: e.target.value })}
                      className="w-full mt-1 border px-3 py-1.5 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Categoría</label>
                    <select
                      value={datosTicket.categoria_general}
                      onChange={(e) => setDatosTicket({ ...datosTicket, categoria_general: e.target.value })}
                      className="w-full mt-1 border px-3 py-1.5 rounded-lg text-sm"
                    >
                      <option value="Alimentación">Alimentación</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Hogar">Hogar</option>
                      <option value="Ocio">Ocio</option>
                      <option value="Salud">Salud</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Total (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={datosTicket.monto_total}
                      onChange={(e) => setDatosTicket({ ...datosTicket, monto_total: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 border px-3 py-1.5 rounded-lg text-sm font-bold text-indigo-600"
                    />
                  </div>
                </div>

                {/* Desglose de ítems */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                    Ítems Detectados ({datosTicket.items?.length || 0})
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2 bg-gray-50">
                    {datosTicket.items?.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center text-xs">
                        <input
                          type="text"
                          value={item.descripcion}
                          onChange={(e) => {
                            const newItems = [...datosTicket.items];
                            newItems[idx].descripcion = e.target.value;
                            setDatosTicket({ ...datosTicket, items: newItems });
                          }}
                          className="flex-1 border px-2 py-1 rounded"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={item.monto_total}
                          onChange={(e) => {
                            const newItems = [...datosTicket.items];
                            newItems[idx].monto_total = parseFloat(e.target.value) || 0;
                            setDatosTicket({ ...datosTicket, items: newItems });
                          }}
                          className="w-20 border px-2 py-1 rounded text-right font-medium"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleGuardarEnSupabase}
            disabled={!datosTicket || saving}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow transition"
          >
            {saving ? 'Guardando...' : 'Confirmar y Guardar en Supabase'}
          </button>
        </div>
      </div>
    </div>
  );
}