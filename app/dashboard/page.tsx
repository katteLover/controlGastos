'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client'; // Ajusta la ruta a tu cliente de Supabase
import TicketModal from '@/components/TicketModal';
import { Gasto, ItemGasto } from '@/types';

export default function DashboardPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados del Modal Unificado
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentData, setCurrentData] = useState<Partial<Gasto> | null>(null);
  const [currentItems, setCurrentItems] = useState<ItemGasto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ID del gasto que se está editando (null si es un registro nuevo)
  const [editingGastoId, setEditingGastoId] = useState<string | null>(null);
  // Ruta del archivo recién subido al storage (para asociarlo o limpiarlo si se cancela)
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string | null>(null);

  // 1. Cargar gastos al iniciar
  const fetchGastos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gastos')
        .select(`*, items_gasto (*)`)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setGastos(data || []);
    } catch (error) {
      console.error('Error al cargar los gastos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGastos();
  }, []);

  // 2. Manejar la selección de archivo nuevo (Subida + IA Gemini)
  const handleFileSelectedForUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSubmitting(true);
      setModalTitle('Registrar Nuevo Ticket (Escaneado por IA)');
      
      // Mostrar vista previa local inmediata
      const localPreviewUrl = URL.createObjectURL(file);
      setCurrentImageUrl(localPreviewUrl);

      // Subir imagen a Supabase Storage (asegúrate de tener tu bucket configurado, ej: "vouchers")
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('vouchers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      setUploadedStoragePath(filePath);

      // Obtener URL pública o firmada
      const { data: publicUrlData } = supabase.storage
        .from('vouchers')
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;
      setCurrentImageUrl(imageUrl);

      // Enviar imagen a tu API de Gemini para procesamiento inteligente
      const formDataApi = new FormData();
      formDataApi.append('file', file);

      const response = await fetch('/api/scan-ticket', {
        method: 'POST',
        body: formDataApi,
      });

      if (!response.ok) throw new Error('Error al analizar el ticket con IA');
      
      const aiResult = await response.json();

      // Cargar datos extraídos por la IA en el modal
      setCurrentData({
        comercio: aiResult.comercio || '',
        fecha: aiResult.fecha || new Date().toISOString().split('T')[0],
        categoria_general: aiResult.categoria_general || 'Alimentación',
        monto_total: aiResult.monto_total || 0,
        moneda: 'EUR',
        url_comprobante: imageUrl,
      });
      setCurrentItems(aiResult.items || []);
      setEditingGastoId(null);
      setIsModalOpen(true);

    } catch (error) {
      console.error('Error al procesar el ticket:', error);
      alert('Hubo un error al escanear el ticket con la IA.');
    } finally {
      setIsSubmitting(false);
      // Limpiar input file
      e.target.value = '';
    }
  };

  // 3. Abrir modal para editar un gasto existente
  const handleOpenEditModal = (gasto: Gasto) => {
    setModalTitle('Editar Ticket / Voucher');
    setCurrentImageUrl(gasto.url_comprobante);
    setCurrentData({
      comercio: gasto.comercio,
      fecha: gasto.fecha,
      categoria_general: gasto.categoria_general,
      monto_total: gasto.monto_total,
      moneda: gasto.moneda || 'EUR',
      url_comprobante: gasto.url_comprobante,
    });
    setCurrentItems(gasto.items_gasto || []);
    setEditingGastoId(gasto.id);
    setUploadedStoragePath(null);
    setIsModalOpen(true);
  };

  // 4. Guardar (Crear o Actualizar en Supabase)
  const handleSaveTicket = async (formData: Partial<Gasto>, items: ItemGasto[]) => {
    try {
      setIsSubmitting(true);

      if (editingGastoId) {
        // ACTUALIZAR GASTO EXISTENTE
        const { error: updateError } = await supabase
          .from('gastos')
          .update({
            comercio: formData.comercio,
            fecha: formData.fecha,
            categoria_general: formData.categoria_general,
            monto_total: formData.monto_total,
            moneda: formData.moneda,
          })
          .eq('id', editingGastoId);

        if (updateError) throw updateError;

        // Reemplazar ítems antiguos (eliminar e insertar nuevos)
        await supabase.from('items_gasto').delete().eq('gasto_id', editingGastoId);

        if (items.length > 0) {
          const itemsToInsert = items.map((item) => ({
            gasto_id: editingGastoId,
            descripcion: item.descripcion,
            subcategoria: item.subcategoria,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            monto_total: item.monto_total,
          }));

          const { error: itemsError } = await supabase.from('items_gasto').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

      } else {
        // CREAR NUEVO GASTO
        const { data: newGasto, error: insertError } = await supabase
          .from('gastos')
          .insert([
            {
              comercio: formData.comercio,
              fecha: formData.fecha,
              categoria_general: formData.categoria_general,
              monto_total: formData.monto_total,
              moneda: formData.moneda || 'EUR',
              url_comprobante: currentImageUrl,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;

        if (items.length > 0 && newGasto) {
          const itemsToInsert = items.map((item) => ({
            gasto_id: newGasto.id,
            descripcion: item.descripcion,
            subcategoria: item.subcategoria,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            monto_total: item.monto_total,
          }));

          const { error: itemsError } = await supabase.from('items_gasto').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }
      }

      setIsModalOpen(false);
      fetchGastos();
    } catch (error) {
      console.error('Error al guardar el gasto:', error);
      alert('Ocurrió un error al guardar los cambios.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Eliminar Gasto
  const handleDeleteTicket = async () => {
    if (!editingGastoId) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este gasto y sus ítems?')) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('gastos').delete().eq('id', editingGastoId);
      if (error) throw error;

      setIsModalOpen(false);
      fetchGastos();
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('No se pudo eliminar el gasto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900 md:p-10">
      <div className="mx-auto max-w-7xl">
        
        {/* Cabecera del Dashboard */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              Control de Gastos y Tickets
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Administra tus comprobantes y desglosa tus compras con IA.
            </p>
          </div>

          {/* Botón de subida rápida */}
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 transition-all">
            📸 Subir y escanear ticket
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelectedForUpload}
              disabled={isSubmitting}
            />
          </label>
        </div>

        {/* Listado de Gastos */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200 dark:border-gray-800 dark:bg-gray-800 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">
              Historial de Compras ({gastos.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Cargando transacciones...</div>
          ) : gastos.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No hay tickets registrados todavía. ¡Sube el primero arriba a la derecha!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-3">Comercio</th>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Categoría</th>
                    <th className="px-6 py-3">Ítems</th>
                    <th className="px-6 py-3 text-right">Monto Total</th>
                    <th className="px-6 py-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {gastos.map((gasto) => (
                    <tr key={gasto.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                        {gasto.comercio}
                      </td>
                      <td className="px-6 py-4">
                        {new Date(gasto.fecha).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                          {gasto.categoria_general}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {gasto.items_gasto?.length || 0} prod.
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                        €{(gasto.monto_total || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleOpenEditModal(gasto)}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          Ver / Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Universal (Dos columnas: Imagen + Formulario guiado) */}
        <TicketModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={modalTitle}
          imageUrl={currentImageUrl}
          initialData={currentData}
          initialItems={currentItems}
          onSave={handleSaveTicket}
          onDelete={editingGastoId ? handleDeleteTicket : undefined}
          isSubmitting={isSubmitting}
        />

      </div>
    </div>
  );
}