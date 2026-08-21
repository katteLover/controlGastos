'use client';

import React, { useState, useEffect } from 'react';
import { Gasto, ItemGasto } from '@/types';

interface EditTicketModalProps {
  gasto: Gasto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSave?: (updatedGasto: Gasto) => Promise<void> | void;
  onDelete?: (gastoId: string) => Promise<void> | void;
  /** Permite pasar un archivo o DataURL del ticket si la imagen aún no está subida */
  imagePreviewUrl?: string | null;
}

export const EditTicketModal: React.FC<EditTicketModalProps> = ({
  gasto,
  isOpen,
  onClose,
  onSuccess,
  onSave,
  onDelete,
  imagePreviewUrl,
}) => {
  const [formData, setFormData] = useState<Partial<Gasto>>({});
  const [items, setItems] = useState<ItemGasto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (gasto) {
      setFormData({
        id: gasto.id,
        fecha: gasto.fecha,
        comercio: gasto.comercio,
        categoria_general: gasto.categoria_general,
        monto_total: gasto.monto_total,
        moneda: gasto.moneda || 'EUR',
        url_comprobante: gasto.url_comprobante,
      });
      setItems(gasto.items_gasto || []);
      setZoom(1);
      setRotation(0);
    }
  }, [gasto]);

  if (!isOpen || !gasto) return null;

  // Determinar la fuente de la imagen (Prioridad: prop recibida > gasto.url_comprobante)
  const currentImageUrl = imagePreviewUrl || gasto.url_comprobante;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'monto_total' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleItemChange = (
    index: number,
    field: keyof ItemGasto,
    value: string | number
  ) => {
    const newItems = [...items];
    const currentItem = { ...newItems[index] };

    if (field === 'cantidad' || field === 'precio_unitario' || field === 'monto_total') {
      const numVal = typeof value === 'string' ? parseFloat(value) || 0 : value;
      (currentItem as Record<string, unknown>)[field] = numVal;

      if (field === 'cantidad' || field === 'precio_unitario') {
        const cant = field === 'cantidad' ? numVal : currentItem.cantidad || 0;
        const prec = field === 'precio_unitario' ? numVal : currentItem.precio_unitario || 0;
        currentItem.monto_total = Number((cant * prec).toFixed(2));
      }
    } else {
      (currentItem as Record<string, unknown>)[field] = value;
    }

    newItems[index] = currentItem;
    setItems(newItems);

    const totalRecalculado = newItems.reduce(
      (sum, item) => sum + (item.monto_total || 0),
      0
    );
    setFormData((prev) => ({
      ...prev,
      monto_total: Number(totalRecalculado.toFixed(2)),
    }));
  };

  const handleAddItem = () => {
    const newItem: ItemGasto = {
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      monto_total: 0,
      subcategoria: '',
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);

    const totalRecalculado = newItems.reduce(
      (sum, item) => sum + (item.monto_total || 0),
      0
    );
    setFormData((prev) => ({
      ...prev,
      monto_total: Number(totalRecalculado.toFixed(2)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id) return;

    try {
      setIsSubmitting(true);
      const updatedGasto: Gasto = {
        ...gasto,
        ...formData,
        fecha: formData.fecha || gasto.fecha,
        comercio: formData.comercio || gasto.comercio,
        categoria_general: formData.categoria_general || gasto.categoria_general,
        monto_total: formData.monto_total ?? gasto.monto_total,
        moneda: formData.moneda || gasto.moneda || 'EUR',
        items_gasto: items,
      } as Gasto;

      if (onSave) {
        await onSave(updatedGasto);
      }

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error('Error al actualizar el ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!gasto.id) return;
    if (confirm('¿Estás seguro de que deseas eliminar este ticket?')) {
      try {
        setIsSubmitting(true);
        if (onDelete) {
          await onDelete(gasto.id);
        }
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } catch (error) {
        console.error('Error al eliminar el ticket:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Editar Ticket / Voucher
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo del Modal con Layout de 2 columnas */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-12">
          
          {/* Panel Izquierdo: Visualizador de Imagen / Voucher (5 columnas en desktop) */}
          <div className="flex flex-col border-b bg-gray-900 p-4 md:col-span-5 md:border-b-0 md:border-r dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between text-xs text-gray-300">
              <span className="font-semibold uppercase tracking-wider text-gray-400">
                Comprobante
              </span>
              
              {/* Controles para la Imagen (Zoom y Rotación) */}
              {currentImageUrl && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(z - 0.2, 0.6))}
                    className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
                    title="Alejar"
                  >
                    🔍 -
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
                    title="Restablecer"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(z + 0.2, 2.5))}
                    className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
                    title="Acercar"
                  >
                    🔍 +
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
                    title="Rotar 90°"
                  >
                    🔄
                  </button>
                </div>
              )}
            </div>

            {/* Contenedor con Scroll/Pan de la Imagen */}
            <div className="relative flex min-h-[350px] flex-1 items-center justify-center overflow-auto rounded-xl bg-gray-950 p-2 border border-gray-800">
              {currentImageUrl ? (
                <img
                  src={currentImageUrl}
                  alt="Voucher / Ticket"
                  className="max-h-[65vh] w-auto object-contain transition-transform duration-200"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-gray-500">
                  <svg
                    className="mb-2 h-12 w-12 stroke-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm">Sin vista previa del comprobante</p>
                </div>
              )}
            </div>
          </div>

          {/* Panel Derecho: Formulario de Datos (7 columnas en desktop) */}
          <div className="flex flex-col p-6 md:col-span-7">
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                      Comercio / Establecimiento
                    </label>
                    <input
                      type="text"
                      name="comercio"
                      value={formData.comercio || ''}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                      Fecha
                    </label>
                    <input
                      type="date"
                      name="fecha"
                      value={formData.fecha ? formData.fecha.split('T')[0] : ''}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                      Categoría General
                    </label>
                    <input
                      type="text"
                      name="categoria_general"
                      value={formData.categoria_general || ''}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                      Monto Total (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="monto_total"
                      value={formData.monto_total ?? ''}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm font-bold text-blue-600 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
                    />
                  </div>
                </div>

                {/* Sección de Ítems / Desglose del Ticket */}
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                      Detalle de Productos ({items.length})
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      + Añadir producto
                    </button>
                  </div>

                  <div className="max-h-[30vh] space-y-2.5 overflow-y-auto pr-1">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-12 gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 dark:border-gray-700 dark:bg-gray-700/40"
                      >
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Descripción"
                            value={item.descripcion}
                            onChange={(e) =>
                              handleItemChange(index, 'descripcion', e.target.value)
                            }
                            className="w-full rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="Subcategoría"
                            value={item.subcategoria || ''}
                            onChange={(e) =>
                              handleItemChange(index, 'subcategoria', e.target.value)
                            }
                            className="w-full rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="col-span-1">
                          <input
                            type="number"
                            placeholder="Cant."
                            value={item.cantidad}
                            onChange={(e) =>
                              handleItemChange(index, 'cantidad', e.target.value)
                            }
                            className="w-full rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="P. Unit"
                            value={item.precio_unitario}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                'precio_unitario',
                                e.target.value
                              )
                            }
                            className="w-full rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="col-span-2 flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold dark:text-white">
                            €{(item.monto_total || 0).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-between border-t pt-4 dark:border-gray-700">
                {onDelete ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditTicketModal;