'use client';

import React, { useState, useEffect } from 'react';
import { Gasto, ItemGasto } from '@/types';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  imageUrl?: string | null;
  initialData?: Partial<Gasto> | null;
  initialItems?: ItemGasto[];
  onSave: (gastoData: Partial<Gasto>, items: ItemGasto[]) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  isSubmitting?: boolean;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  isOpen,
  onClose,
  title,
  imageUrl,
  initialData,
  initialItems,
  onSave,
  onDelete,
  isSubmitting = false,
}) => {
  const [formData, setFormData] = useState<Partial<Gasto>>({});
  const [items, setItems] = useState<ItemGasto[]>([]);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        comercio: initialData?.comercio || '',
        fecha: initialData?.fecha ? initialData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
        categoria_general: initialData?.categoria_general || 'Alimentación',
        monto_total: initialData?.monto_total || 0,
        moneda: initialData?.moneda || 'EUR',
      });
      setItems(initialItems || []);
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, initialData, initialItems]);

  if (!isOpen) return null;

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
    await onSave(formData, items);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo a dos columnas */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-12">
          
          {/* Columna Izquierda: Vista previa de la imagen */}
          <div className="flex flex-col border-b bg-gray-900 p-4 md:col-span-5 md:border-b-0 md:border-r dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between text-xs text-gray-300">
              <span className="font-semibold uppercase tracking-wider text-gray-400">
                Comprobante / Voucher
              </span>
              {imageUrl && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(z - 0.2, 0.6))}
                    className="rounded bg-gray-800 px-2 py-1 text-xs hover:bg-gray-700 text-white"
                    title="Alejar"
                  >
                    🔍 -
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    className="rounded bg-gray-800 px-2 py-1 text-xs hover:bg-gray-700 text-white"
                    title="Restablecer"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(z + 0.2, 2.5))}
                    className="rounded bg-gray-800 px-2 py-1 text-xs hover:bg-gray-700 text-white"
                    title="Acercar"
                  >
                    🔍 +
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="rounded bg-gray-800 px-2 py-1 text-xs hover:bg-gray-700 text-white"
                    title="Rotar"
                  >
                    🔄
                  </button>
                </div>
              )}
            </div>

            <div className="relative flex min-h-[350px] flex-1 items-center justify-center overflow-auto rounded-xl bg-gray-950 p-2 border border-gray-800">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Vista previa del ticket"
                  className="max-h-[65vh] w-auto object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-gray-500">
                  <p className="text-sm">No hay imagen disponible</p>
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Formulario guiado con labels claros */}
          <div className="flex flex-col p-6 md:col-span-7">
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between space-y-6">
              <div className="space-y-4">
                
                {/* Datos generales */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Comercio / Establecimiento
                    </label>
                    <input
                      type="text"
                      name="comercio"
                      placeholder="Ej. Mercadona, Carrefour"
                      value={formData.comercio || ''}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Fecha de compra
                    </label>
                    <input
                      type="date"
                      name="fecha"
                      value={formData.fecha || ''}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Categoría General
                    </label>
                    <select
                      name="categoria_general"
                      value={formData.categoria_general || ''}
                      onChange={handleInputChange}
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
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

                {/* Sección de Ítems Individuales */}
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between border-b pb-2 dark:border-gray-700">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800 dark:text-gray-200">
                        Detalle de Ítems
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        Verifica que la IA haya leído bien cada producto
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      + Añadir ítem
                    </button>
                  </div>

                  {/* Cabeceras de la tabla de ítems */}
                  <div className="grid grid-cols-12 gap-1.5 px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <div className="col-span-4">Descripción</div>
                    <div className="col-span-3">Subcategoría</div>
                    <div className="col-span-1 text-center">Cant.</div>
                    <div className="col-span-2 text-right">P. Unit (€)</div>
                    <div className="col-span-2 text-right">Total (€)</div>
                  </div>

                  <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-12 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/60 p-2 dark:border-gray-700 dark:bg-gray-700/40"
                      >
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Nombre del producto"
                            value={item.descripcion}
                            onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="Ej. Lácteos"
                            value={item.subcategoria || ''}
                            onChange={(e) => handleItemChange(index, 'subcategoria', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="col-span-1">
                          <input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-center text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.precio_unitario}
                            onChange={(e) => handleItemChange(index, 'precio_unitario', e.target.value)}
                            className="w-full rounded border border-gray-300 p-1 text-right text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <span className="text-xs font-semibold dark:text-white">
                            €{(item.monto_total || 0).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="rounded p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40"
                            title="Eliminar ítem"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <p className="py-4 text-center text-xs text-gray-400">
                        No hay ítems registrados. Haz clic en &quot;Añadir ítem&quot;.
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* Botones de acción inferiores */}
              <div className="flex items-center justify-between border-t pt-4 dark:border-gray-700">
                {onDelete ? (
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={isSubmitting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Eliminar Gasto
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
                    {isSubmitting ? 'Guardando...' : 'Guardar Ticket'}
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

export default TicketModal;