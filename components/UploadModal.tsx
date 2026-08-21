'use client';

import { useState, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import Swal from 'sweetalert2';

interface ItemEdit {
  descripcion: string;
  subcategoria: string;
  cantidad: number;
  precio_unitario: number;
  monto_total: number;
}

interface TicketData {
  comercio: string;
  fecha: string;
  categoria_general: string;
  monto_total: number;
  items: ItemEdit[];
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [step, setStep] = useState<'upload' | 'edit'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Datos extraídos para edición
  const [ticketData, setTicketData] = useState<TicketData>({
    comercio: '',
    fecha: new Date().toISOString().split('T')[0],
    categoria_general: 'Alimentación',
    monto_total: 0,
    items: [],
  });

  if (!isOpen) return null;

  const handleResetModal = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setLoading(false);
    setTicketData({
      comercio: '',
      fecha: new Date().toISOString().split('T')[0],
      categoria_general: 'Alimentación',
      monto_total: 0,
      items: [],
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleResetModal();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  // PASO 1: Procesar imagen con Gemini API
  const handleEscanear = async () => {
    if (!file) {
      Swal.fire('Atención', 'Por favor selecciona la imagen de un ticket.', 'warning');
      return;
    }

    setLoading(true);

    try {
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

      const extracted = json.data;

      setTicketData({
        comercio: extracted.comercio || 'Establecimiento',
        fecha: extracted.fecha || new Date().toISOString().split('T')[0],
        categoria_general: extracted.categoria_general || 'Alimentación',
        monto_total: Number(extracted.monto_total) || 0,
        items: Array.isArray(extracted.items) ? extracted.items : [],
      });

      setStep('edit'); // Cambiar al paso de revisión/edición
    } catch (err: any) {
      console.error('Error al escanear:', err);
      Swal.fire('Error', err.message || 'No se pudo procesar el ticket.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Funciones de modificación de Ítems en el Paso 2
  const handleItemChange = (index: number, field: keyof ItemEdit, value: any) => {
    const newItems = [...ticketData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Si cambia precio o cantidad, recalcular monto_total del ítem
    if (field === 'cantidad' || field === 'precio_unitario') {
      const cant = field === 'cantidad' ? Number(value) : newItems[index].cantidad;
      const pu = field === 'precio_unitario' ? Number(value) : newItems[index].precio_unitario;
      newItems[index].monto_total = parseFloat((cant * pu).toFixed(2));
    }

    setTicketData({ ...ticketData, items: newItems });
  };

  const handleAgregarItem = () => {
    setTicketData({
      ...ticketData,
      items: [
        ...ticketData.items,
        {
          descripcion: 'Nuevo Producto',
          subcategoria: 'Varios',
          cantidad: 1,
          precio_unitario: 0,
          monto_total: 0,
        },
      ],
    });
  };

  const handleEliminarItem = (index: number) => {
    const newItems = ticketData.items.filter((_, i) => i !== index);
    setTicketData({ ...ticketData, items: newItems });
  };

  // PASO 2: Guardar final en Supabase
  const handleGuardarEnSupabase = async () => {
    setLoading(true);

    try {
      let publicUrl = '';

      // 1. Subir imagen a Supabase Storage (si existe)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('tickets')
          .upload(fileName, file);

        if (!uploadError && uploadData) {
          const { data: urlData } = supabaseClient.storage
            .from('tickets')
            .getPublicUrl(fileName);
          publicUrl = urlData.publicUrl;
        }
      }

      // 2. Insertar Registro principal 'gastos'
      const { data: gastoInsert, error: gastoError } = await supabaseClient
        .from('gastos')
        .insert({
          comercio: ticketData.comercio,
          fecha: ticketData.fecha,
          categoria_general: ticketData.categoria_general,
          monto_total: Number(ticketData.monto_total),
          imagen_url: publicUrl || null,
        })
        .select()
        .single();

      if (gastoError) {
        throw new Error(`Error guardando en gastos: ${gastoError.message}`);
      }

      // 3. Insertar 'items_gasto'
      if (ticketData.items && ticketData.items.length > 0 && gastoInsert) {
        const itemsParaInsertar = ticketData.items.map((item) => ({
          gasto_id: gastoInsert.id,
          descripcion: item.descripcion || 'Producto',
          subcategoria: item.subcategoria || 'General',
          cantidad: Number(item.cantidad) || 1,
          precio_unitario: Number(item.precio_unitario) || Number(item.monto_total) || 0,
          monto_total: Number(item.monto_total) || 0,
        }));

        const { error: itemsError } = await supabaseClient
          .from('items_gasto')
          .insert(itemsParaInsertar);

        if (itemsError) {
          console.error('Error insertando ítems:', itemsError.message);
        }
      }

      Swal.fire({
        icon: 'success',
        title: '¡Ticket Guardado!',
        text: `Se ha guardado el comprobante de ${ticketData.comercio} correctamente.`,
      });

      handleResetModal();
      onSuccess();
    } catch (err: any) {
      console.error('Error al guardar:', err);
      Swal.fire('Error', err.message || 'No se pudo guardar el ticket.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {step === 'upload' ? '1. Seleccionar Ticket' : '2. Revisar y Confirmar Datos'}
            </h3>
            <p className="text-xs text-gray-500">
              {step === 'upload'
                ? 'Sube la imagen para que Gemini analice el contenido'
                : 'Verifica y corrige la información extraída antes de guardar'}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* CONTENIDO PASO 1: Subir e Imagen Escala Correcta */}
        {step === 'upload' && (
          <div className="my-4 flex-1 overflow-hidden flex flex-col justify-center">
            {preview ? (
              <div className="flex flex-col items-center justify-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl max-h-[380px]">
                <div className="relative w-full max-h-[280px] flex justify-center overflow-hidden">
                  <img
                    src={preview}
                    alt="Vista previa"
                    className="max-h-[280px] max-w-full object-contain rounded-lg shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResetModal}
                  disabled={loading}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
                >
                  Cambiar imagen
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition text-center min-h-[220px]">
                <span className="text-4xl mb-2">📸</span>
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
        )}

        {/* CONTENIDO PASO 2: Edición de Datos + Desglose de Ítems */}
        {step === 'edit' && (
          <div className="my-4 flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Cabecera del Formulario General + Miniatura */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 items-start">
              {preview && (
                <div className="sm:col-span-1 flex justify-center max-h-[110px] overflow-hidden rounded-lg border border-gray-200">
                  <img src={preview} alt="Ticket" className="object-contain max-h-[110px]" />
                </div>
              )}

              <div className={`space-y-2 ${preview ? 'sm:col-span-3' : 'sm:col-span-4'}`}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Comercio</label>
                    <input
                      type="text"
                      value={ticketData.comercio}
                      onChange={(e) => setTicketData({ ...ticketData, comercio: e.target.value })}
                      className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Fecha</label>
                    <input
                      type="date"
                      value={ticketData.fecha}
                      onChange={(e) => setTicketData({ ...ticketData, fecha: e.target.value })}
                      className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Categoría</label>
                    <select
                      value={ticketData.categoria_general}
                      onChange={(e) =>
                        setTicketData({ ...ticketData, categoria_general: e.target.value })
                      }
                      className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
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
                    <label className="text-xs font-semibold text-gray-600">Total (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ticketData.monto_total}
                      onChange={(e) =>
                        setTicketData({ ...ticketData, monto_total: Number(e.target.value) })
                      }
                      className="w-full text-xs p-2 font-bold text-indigo-700 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla / Lista Editable de Ítems */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Desglose de Ítems ({ticketData.items.length})
                </h4>
                <button
                  type="button"
                  onClick={handleAgregarItem}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  + Agregar Ítem
                </button>
              </div>

              {ticketData.items.length === 0 ? (
                <div className="text-center p-4 bg-gray-50 border border-dashed rounded-lg text-xs text-gray-400">
                  No se detectaron ítems individuales. Puedes agregarlos manualmente.
                </div>
              ) : (
                <div className="space-y-2">
                  {ticketData.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
                    >
                      <input
                        type="text"
                        placeholder="Descripción"
                        value={item.descripcion}
                        onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                        className="flex-1 text-xs p-1.5 border border-gray-200 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Subcategoría"
                        value={item.subcategoria}
                        onChange={(e) => handleItemChange(idx, 'subcategoria', e.target.value)}
                        className="w-28 text-xs p-1.5 border border-gray-200 rounded bg-gray-50"
                      />
                      <input
                        type="number"
                        placeholder="Cant"
                        value={item.cantidad}
                        onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)}
                        className="w-14 text-xs p-1.5 border border-gray-200 rounded text-center"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio"
                        value={item.monto_total}
                        onChange={(e) => handleItemChange(idx, 'monto_total', Number(e.target.value))}
                        className="w-20 text-xs p-1.5 border border-gray-200 rounded font-semibold text-right"
                      />
                      <button
                        type="button"
                        onClick={() => handleEliminarItem(idx)}
                        className="text-red-500 hover:text-red-700 text-xs p-1 font-bold"
                        title="Eliminar Ítem"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          {step === 'edit' ? (
            <button
              type="button"
              onClick={() => setStep('upload')}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-800 underline font-medium"
            >
              ← Volver a cargar imagen
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition font-medium"
            >
              Cancelar
            </button>

            {step === 'upload' ? (
              <button
                type="button"
                onClick={handleEscanear}
                disabled={!file || loading}
                className="px-5 py-2 rounded-lg text-xs bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">🌀</span>
                    <span>Analizando con Gemini...</span>
                  </>
                ) : (
                  <span>Analizar Ticket</span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGuardarEnSupabase}
                disabled={loading}
                className="px-5 py-2 rounded-lg text-xs bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">🌀</span>
                    <span>Guardando en Supabase...</span>
                  </>
                ) : (
                  <span>Confirmar y Guardar Ticket</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}