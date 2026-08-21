'use client';

import { useState, useRef, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import Swal from 'sweetalert2';

interface ItemEscaneado {
  descripcion: string;
  subcategoria: string;
  cantidad: number;
  precio_unitario: number;
  monto_total: number;
}

interface DatosEscaneados {
  comercio: string;
  fecha: string;
  categoria_general: string;
  monto_total: number;
  items: ItemEscaneado[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: Props) {
  const [paso, setPaso] = useState<'SELECCIONAR' | 'RECORTAR' | 'ANALIZANDO' | 'REVISAR'>('SELECCIONAR');
  const [archivoOriginal, setArchivoOriginal] = useState<File | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  
  // Estado para recorte
  const [crop, setCrop] = useState({ top: 5, bottom: 5, left: 5, right: 5 });
  const [rotacion, setRotacion] = useState<number>(0);

  // Datos extraídos por Gemini
  const [datosEditables, setDatosEditables] = useState<DatosEscaneados | null>(null);
  const [archivoFinalCropped, setArchivoFinalCropped] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const resetModal = () => {
    setPaso('SELECCIONAR');
    setArchivoOriginal(null);
    setImagenUrl(null);
    setCrop({ top: 5, bottom: 5, left: 5, right: 5 });
    setRotacion(0);
    setDatosEditables(null);
    setArchivoFinalCropped(null);
    setGuardando(false);
  };

  if (!isOpen) return null;

  // Manejar selección de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArchivoOriginal(file);
      setImagenUrl(URL.createObjectURL(file));
      setPaso('RECORTAR');
    }
  };

  // Función para procesar el recorte con Canvas HTML5
  const generarImagenRecortada = (): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!imagenUrl || !imageRef.current) {
        return reject('No hay imagen cargada');
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imagenUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) return reject('No se pudo crear el contexto 2D');

        // Dimensiones originales
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;

        // Bounding box de recorte
        const cropX = (crop.left / 100) * originalWidth;
        const cropY = (crop.top / 100) * originalHeight;
        const cropW = originalWidth - cropX - ((crop.right / 100) * originalWidth);
        const cropH = originalHeight - cropY - ((crop.bottom / 100) * originalHeight);

        // Configurar canvas según rotación
        if (rotacion % 180 !== 0) {
          canvas.width = cropH;
          canvas.height = cropW;
        } else {
          canvas.width = cropW;
          canvas.height = cropH;
        }

        ctx.save();

        // Aplicar rotación si aplica
        if (rotacion === 90) {
          ctx.translate(canvas.width, 0);
          ctx.rotate((90 * Math.PI) / 180);
        } else if (rotacion === 180) {
          ctx.translate(canvas.width, canvas.height);
          ctx.rotate((180 * Math.PI) / 180);
        } else if (rotacion === 270) {
          ctx.translate(0, canvas.height);
          ctx.rotate((270 * Math.PI) / 180);
        }

        // Dibujar solo el área recortada
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        ctx.restore();

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject('Error al generar blob de la imagen');
            const croppedFile = new File([blob], `ticket_cropped_${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            resolve(croppedFile);
          },
          'image/jpeg',
          0.92
        );
      };
      img.onerror = () => reject('Error al cargar la imagen');
    });
  };

  // Enviar a Gemini 3.1 Flash Lite
  const ejecutarEscaneo = async () => {
    setPaso('ANALIZANDO');
    try {
      const croppedFile = await generarImagenRecortada();
      setArchivoFinalCropped(croppedFile);

      const formData = new FormData();
      formData.append('file', croppedFile);

      const res = await fetch('/api/scan-ticket', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al analizar el ticket');
      }

      setDatosEditables(json.data);
      setPaso('REVISAR');
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', err.message || 'Error al procesar la imagen con Gemini', 'error');
      setPaso('RECORTAR');
    }
  };

  // Guardar en Supabase
  const handleGuardarTicket = async () => {
    if (!datosEditables) return;
    setGuardando(true);

    try {
      let imagen_url = '';

      // Subir imagen a Supabase Storage si está disponible
      if (archivoFinalCropped) {
        const fileExt = 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from('tickets')
          .upload(fileName, archivoFinalCropped);

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabaseClient.storage
            .from('tickets')
            .getPublicUrl(fileName);
          imagen_url = publicUrlData.publicUrl;
        }
      }

      // 1. Insertar ticket principal
      const { data: gastoData, error: gastoError } = await supabaseClient
        .from('gastos')
        .insert({
          comercio: datosEditables.comercio,
          fecha: datosEditables.fecha,
          categoria_general: datosEditables.categoria_general,
          monto_total: datosEditables.monto_total,
          imagen_url: imagen_url || null,
        })
        .select()
        .single();

      if (gastoError) throw gastoError;

      // 2. Insertar ítems desglosados
      if (datosEditables.items && datosEditables.items.length > 0) {
        const itemsAInsertar = datosEditables.items.map((it) => ({
          gasto_id: gastoData.id,
          descripcion: it.descripcion,
          subcategoria: it.subcategoria || 'General',
          cantidad: it.cantidad || 1,
          precio_unitario: it.precio_unitario || 0,
          monto_total: it.monto_total || 0,
        }));

        const { error: itemsError } = await supabaseClient
          .from('items_gasto')
          .insert(itemsAInsertar);

        if (itemsError) console.error('Error al insertar items:', itemsError);
      }

      Swal.fire('¡Éxito!', 'El ticket se guardó correctamente.', 'success');
      onSuccess();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo guardar el ticket.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-y-auto">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            {paso === 'SELECCIONAR' && 'Escanear Nuevo Ticket'}
            {paso === 'RECORTAR' && 'Ajustar y Recortar Ticket'}
            {paso === 'ANALIZANDO' && 'Procesando con Gemini 3.1 Flash Lite...'}
            {paso === 'REVISAR' && 'Confirmar Datos Extraídos'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-1">
            ✕
          </button>
        </div>

        {/* PASO 1: Seleccionar Imagen */}
        {paso === 'SELECCIONAR' && (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl my-4 bg-gray-50 text-center">
            <span className="text-4xl mb-2">📸</span>
            <p className="text-sm font-semibold text-gray-700">Selecciona o toma una foto del ticket</p>
            <p className="text-xs text-gray-400 mt-1">Soporta JPG, PNG o capturas móviles</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="mt-4 text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>
        )}

        {/* PASO 2: Recortar y Rotar */}
        {paso === 'RECORTAR' && imagenUrl && (
          <div className="py-4 space-y-4">
            <p className="text-xs text-gray-500">
              Ajusta los márgenes para aislar únicamente el ticket. Esto mejorará la precisión de la lectura IA.
            </p>

            <div className="relative border rounded-lg bg-gray-900 overflow-hidden flex justify-center items-center max-h-[350px]">
              <img
                ref={imageRef}
                src={imagenUrl}
                alt="Original"
                style={{
                  transform: `rotate(${rotacion}deg)`,
                  maxHeight: '350px',
                  objectFit: 'contain',
                  filter: 'brightness(0.95)',
                }}
              />
              
              {/* Box con overlay de recorte */}
              <div
                className="absolute border-2 border-amber-400 bg-amber-400/20 pointer-events-none rounded"
                style={{
                  top: `${crop.top}%`,
                  bottom: `${crop.bottom}%`,
                  left: `${crop.left}%`,
                  right: `${crop.right}%`,
                }}
              />
            </div>

            {/* Controles de Margen y Rotación */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <label className="font-semibold text-gray-600 block">Margen Superior: {crop.top}%</label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={crop.top}
                  onChange={(e) => setCrop({ ...crop, top: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 block">Margen Inferior: {crop.bottom}%</label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={crop.bottom}
                  onChange={(e) => setCrop({ ...crop, bottom: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 block">Margen Izquierdo: {crop.left}%</label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={crop.left}
                  onChange={(e) => setCrop({ ...crop, left: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 block">Margen Derecho: {crop.right}%</label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={crop.right}
                  onChange={(e) => setCrop({ ...crop, right: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setRotacion((rotacion + 90) % 360)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg flex items-center gap-1"
              >
                🔄 Rotar 90°
              </button>

              <button
                onClick={ejecutarEscaneo}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition shadow"
              >
                ✨ Recortar y Analizar
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Estado Analizando */}
        {paso === 'ANALIZANDO' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-800">Gemini 3.1 Flash Lite está procesando la compra...</p>
            <p className="text-xs text-gray-400">Extrayendo ítems, subcategorías y precios unitarios.</p>
          </div>
        )}

        {/* PASO 4: Revisar y Confirmar Datos */}
        {paso === 'REVISAR' && datosEditables && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-gray-600">Comercio</label>
                <input
                  type="text"
                  value={datosEditables.comercio}
                  onChange={(e) => setDatosEditables({ ...datosEditables, comercio: e.target.value })}
                  className="w-full p-2 border rounded-lg mt-1 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600">Fecha</label>
                <input
                  type="date"
                  value={datosEditables.fecha}
                  onChange={(e) => setDatosEditables({ ...datosEditables, fecha: e.target.value })}
                  className="w-full p-2 border rounded-lg mt-1 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600">Categoría General</label>
                <input
                  type="text"
                  value={datosEditables.categoria_general}
                  onChange={(e) => setDatosEditables({ ...datosEditables, categoria_general: e.target.value })}
                  className="w-full p-2 border rounded-lg mt-1 font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600">Monto Total (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={datosEditables.monto_total}
                  onChange={(e) => setDatosEditables({ ...datosEditables, monto_total: Number(e.target.value) })}
                  className="w-full p-2 border rounded-lg mt-1 font-bold text-indigo-600"
                />
              </div>
            </div>

            {/* Ítems extraídos */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-700">Ítems extraídos ({datosEditables.items.length}):</p>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border rounded-xl p-2 bg-gray-50">
                {datosEditables.items.map((item, idx) => (
                  <div key={idx} className="py-1.5 grid grid-cols-12 gap-1 items-center text-xs">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => {
                        const newItems = [...datosEditables.items];
                        newItems[idx].descripcion = e.target.value;
                        setDatosEditables({ ...datosEditables, items: newItems });
                      }}
                      className="col-span-5 p-1 border rounded bg-white text-xs"
                      placeholder="Producto"
                    />
                    <input
                      type="text"
                      value={item.subcategoria}
                      onChange={(e) => {
                        const newItems = [...datosEditables.items];
                        newItems[idx].subcategoria = e.target.value;
                        setDatosEditables({ ...datosEditables, items: newItems });
                      }}
                      className="col-span-4 p-1 border rounded bg-white text-xs"
                      placeholder="Subcategoría"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.monto_total}
                      onChange={(e) => {
                        const newItems = [...datosEditables.items];
                        newItems[idx].monto_total = Number(e.target.value);
                        setDatosEditables({ ...datosEditables, items: newItems });
                      }}
                      className="col-span-3 p-1 border rounded bg-white text-xs font-bold text-right"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setPaso('RECORTAR')}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg"
              >
                Volver
              </button>
              <button
                onClick={handleGuardarTicket}
                disabled={guardando}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow"
              >
                {guardando ? 'Guardando...' : '💾 Confirmar y Guardar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}