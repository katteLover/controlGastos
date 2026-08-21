'use client';

import React, { useState, useEffect } from 'react';
import { Gasto, ItemGasto } from '@/types';

interface EditTicketModalProps {
  gasto: Gasto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // <--- Agregado para aceptar la prop onSuccess
  onSave?: (updatedGasto: Gasto) => Promise<void> | void;
  onDelete?: (gastoId: string) => Promise<void> | void;
}

export const EditTicketModal: React.FC<EditTicketModalProps> = ({
  gasto,
  isOpen,
  onClose,
  onSuccess,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<Partial<Gasto>>({});
  const [items, setItems] = useState<ItemGasto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    }
  }, [gasto]);

  if (!isOpen || !gasto) return null;

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

      // Si page.tsx envió onSuccess, lo invocamos para recargar datos
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Editar Ticket / Gasto
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Comercio
              </label>
              <input
                type="text"
                name="comercio"
                value={formData.comercio || ''}
                onChange={handleInputChange}
                required
                className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Fecha
              </label>
              <input
                type="date"
                name="fecha"
                value={formData.fecha ? formData.fecha.split('T')[0] : ''}
                onChange={handleInputChange}
                required
                className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Categoría General
              </label>
              <input
                type="text"
                name="categoria_general"
                value={formData.categoria_general || ''}
                onChange={handleInputChange}
                required
                className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Monto Total (€)
              </label>
              <input
                type="number"
                step="0.01"
                name="monto_total"
                value={formData.monto_total ?? ''}
                onChange={handleInputChange}
                required
                className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Sección de Ítems */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200">
                Detalle de Productos / Ítems
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
              >
                + Añadir ítem
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 rounded-lg border p-3 dark:bg-gray-700/50"
                >
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Descripción"
                      value={item.descripcion}
                      onChange={(e) =>
                        handleItemChange(index, 'descripcion', e.target.value)
                      }
                      className="w-full rounded border p-1 text-xs dark:bg-gray-700 dark:text-white"
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
                      className="w-full rounded border p-1 text-xs dark:bg-gray-700 dark:text-white"
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
                      className="w-full rounded border p-1 text-xs dark:bg-gray-700 dark:text-white"
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
                      className="w-full rounded border p-1 text-xs dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-1">
                    <span className="text-xs font-medium dark:text-white">
                      €{(item.monto_total || 0).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Eliminar
              </button>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTicketModal;