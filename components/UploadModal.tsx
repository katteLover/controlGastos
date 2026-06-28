'use client';

import React, { useState, useCallback } from 'react';
import { compressImage } from '@/lib/utils';
import { supabaseClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { UploadCloud, X, Loader2, FileImage } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [estadoProgreso, setEstadoProgreso] = useState('');

  const procesarArchivoTicket = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecciona exclusivamente un archivo de imagen (PNG, JPEG, WEBP).');
      return;
    }

    setProcessing(true);
    try {
      // 1. Compresión en el cliente vía Canvas (Utilidad de la Fase 2)
      setEstadoProgreso('Optimizando y comprimiendo imagen...');
      const { base64, mimeType } = await compressImage(file);

      // 2. Subida de la imagen comprimida a Supabase Storage
      setEstadoProgreso('Almacenando archivo en el Storage seguro...');
      const nombreArchivo = `${Date.now()}_compressed.jpg`;
      
      // Convertir el string base64 limpio a un binario Blob para cargarlo de forma nativa
      const responseBlob = await fetch(`data:${mimeType};base64,${base64}`);
      const blobImagen = await responseBlob.blob();

      const { data: storageData, error: storageError } = await supabaseClient.storage
        .from('tickets')
        .upload(nombreArchivo, blobImagen, { contentType: mimeType });

      if (storageError) throw storageError;

      // Obtener la URL pública del ticket para vincularla a la base de datos
      const { data: { publicUrl } } = supabaseClient.storage
        .from('tickets')
        .getPublicUrl(nombreArchivo);

      // 3. Invocar al Endpoint de Inteligencia Artificial para el análisis de Gemini
      setEstadoProgreso('Analizando ticket con Inteligencia Artificial Gemini...');
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      const apiResponse = await fetch('/api/procesar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          base64,
          mimeType,
          imageUrl: publicUrl
        })
      });

      const resJson = await apiResponse.json();
      if (!apiResponse.ok) throw new Error(resJson.error || 'Error procesando la información');

      toast.success(`¡Ticket de "${resJson.data.establecimiento}" analizado y guardado con éxito!`);
      onSuccess(); // Dispara la recarga automática del Dashboard
      onClose(); // Cierra el modal
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error crítico en el flujo de procesamiento.');
    } finally {
      setProcessing(false);
      setEstadoProgreso('');
    }
  }, [onClose, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4 relative">
        <button 
          disabled={processing}
          onClick={onClose} 
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text text-lg p-1 transition disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text">Escanear Nuevo Ticket</h3>
          <p className="text-xs text-gray-400">Suelta tu recibo para extraer los datos automáticamente</p>
        </div>

        {processing ? (
          <div className="p-10 border-2 border-dashed border-emerald-500/30 rounded-xl bg-emerald-50/10 flex flex-col items-center justify-center space-y-4 text-center">
            <Loader2 className="w-10 h-10 text-emerald-700 animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Procesando comprobante...</p>
              <p className="text-xs text-gray-400 max-w-xs">{estadoProgreso}</p>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if(e.dataTransfer.files?.[0]) procesarArchivoTicket(e.dataTransfer.files[0]); }}
            className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center space-y-3 transition cursor-pointer ${
              dragging 
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20' 
                : 'border-gray-200 dark:border-gray-700 hover:border-emerald-500 bg-gray-50/50 dark:bg-dark-bg/40'
            }`}
          >
            <UploadCloud className={`w-12 h-12 transition ${dragging ? 'text-emerald-700 animate-bounce' : 'text-gray-300'}`} />
            <div className="text-xs text-gray-400">
              <label className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer block mb-1">
                Selecciona una foto
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => { if(e.target.files?.[0]) procesarArchivoTicket(e.target.files[0]); }} 
                />
              </label>
              o arrastra y suelta aquí
            </div>
            <p className="text-[10px] text-gray-400/80">Formatos permitidos: PNG, JPG, JPEG, WEBP</p>
          </div>
        )}
      </div>
    </div>
  );
}