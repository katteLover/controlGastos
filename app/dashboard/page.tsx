'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Compra {
  id: string;
  fecha: string;
  establecimiento: string;
  categoria: string;
  total: number;
  items: any[];
  ticket_url?: string;
}

const formatEuro = (value: number) => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
};

export default function DashboardPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loadingGastos, setLoadingGastos] = useState(true);
  const [userName, setUserName] = useState<string>('');

  // ESTADOS PARA EL NUEVO FLUJO DE REVISIÓN
  const [extractedData, setExtractedData] = useState<Partial<Compra> | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
      } else {
        setUserName(session.user.email || 'Usuario');
        fetchCompras();
      }
    };
    checkUser();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile) {
      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        setPreviewUrl('pdf');
      }
    } else {
      setPreviewUrl(null);
    }
  };

  const compressImage = (imageFile: File, quality = 0.6): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!imageFile.type.startsWith('image/')) return resolve(imageFile);
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1200;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], imageFile.name, { type: imageFile.type, lastModified: Date.now() }));
            } else {
              resolve(imageFile);
            }
          }, imageFile.type, quality);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const fetchCompras = async () => {
    try {
      setLoadingGastos(true);
      const { data, error } = await supabase.from('compras').select('*').order('fecha', { ascending: false });
      if (error) throw error;
      setCompras(data || []);
    } catch (error: any) {
      console.error('Error cargando compras:', error.message);
    } finally {
      setLoadingGastos(false);
    }
  };

  // PASO 1: Procesar archivo con Gemini y subir al Bucket
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Por favor, selecciona un ticket primero.');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No se encontró una sesión activa.');

      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file, 0.6);
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `comprobantes/${session.user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('tickets').upload(filePath, fileToUpload, { cacheControl: '3600', upsert: true });
      if (uploadError) throw new Error(`Error en Bucket: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage.from('tickets').getPublicUrl(filePath);
      setUploadedUrl(publicUrl);

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const response = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Error al procesar');

      // En lugar de guardar directo, guardamos en el estado y abrimos el Pop-up de decisión
      setExtractedData(resData.compra || resData.extractedData);
      setShowConfirmModal(true); 

    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: Guardar definitivo en la base de datos de Supabase
  const guardarEnSupabase = async (datosFinales: Partial<Compra>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión expirada.');

      const { error } = await supabase.from('compras').insert({
        user_id: session.user.id,
        establecimiento: datosFinales.establecimiento || 'Desconocido',
        fecha: datosFinales.fecha || new Date().toISOString().split('T')[0],
        total: parseFloat(datosFinales.total?.toString() || '0'),
        categoria: datosFinales.categoria || 'Otros',
        items: datosFinales.items || [],
        ticket_url: uploadedUrl
      });

      if (error) throw error;

      // Resetear interfaz
      setShowConfirmModal(false);
      setShowReviewModal(false);
      setFile(null);
      setPreviewUrl(null);
      setExtractedData(null);
      fetchCompras();
    } catch (error: any) {
      alert(`Error al guardar en Base de Datos: ${error.message}`);
    }
  };

  const totalGastado = compras.reduce((acc, item) => acc + Number(item.total), 0);
  const totalTickets = compras.length;
  const promedioGasto = totalTickets > 0 ? totalGastado / totalTickets : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ControlGastos AI</h1>
          <p className="text-xs text-slate-500">Sesión: {userName}</p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 transition">
          Cerrar Sesión
        </button>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario Izquierda */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-700 mb-2">Escanear Nuevo Ticket</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-blue-500 transition cursor-pointer relative bg-slate-50 min-h-[160px] flex flex-col justify-center items-center">
                <input id="ticket-input" type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                {previewUrl ? (
                  <div className="space-y-2 w-full z-20 pointer-events-none">
                    {previewUrl === 'pdf' ? (
                      <div className="flex flex-col items-center py-4">
                        <svg className="h-12 w-12 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
                        <p className="text-xs font-medium text-slate-600 mt-1">{file?.name}</p>
                      </div>
                    ) : (
                      <div className="relative rounded-lg overflow-hidden border bg-black/5 max-h-48 flex justify-center">
                        <img src={previewUrl} alt="Preview" className="object-contain h-40" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-600">Seleccionar comprobante</p>
                  </div>
                )}
              </div>
              <button type="submit" disabled={loading || !file} className={`w-full py-3 px-4 rounded-xl text-white font-medium transition ${loading || !file ? 'bg-slate-300' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
                {loading ? 'Procesando IA...' : 'Analizar Ticket'}
              </button>
            </form>
          </div>
        </div>

        {/* Historial Derecha */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase">Total Gastado</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{formatEuro(totalGastado)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase">Tickets</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{totalTickets}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase">Promedio</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{formatEuro(promedioGasto)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Tabla del historial */}
            <div className="p-4 border-b font-bold text-slate-700">Historial de Compras</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b uppercase">
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Establecimiento</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4 text-center">Ticket</th>
                    <th className="p-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {compras.map((compra) => (
                    <tr key={compra.id} className="hover:bg-slate-50/50">
                      <td className="p-4 text-slate-500">{compra.fecha}</td>
                      <td className="p-4 font-semibold text-slate-900">{compra.establecimiento}</td>
                      <td className="p-4"><span className="px-2.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{compra.categoria}</span></td>
                      <td className="p-4 text-center">
                        {compra.ticket_url && <a href={compra.ticket_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">Ver copia ↗</a>}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900">{formatEuro(Number(compra.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL INTERMEDIO: POP-UP DE DECISIÓN */}
      {showConfirmModal && extractedData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">¡Ticket procesado por la IA!</h3>
            <p className="text-sm text-slate-600 mb-6">
              Hemos extraído los datos con Gemini. ¿Deseas revisar y editar la información detalladamente o prefieres guardarla directamente en tu historial?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button 
                onClick={() => { setShowConfirmModal(false); guardarEnSupabase(extractedData); }}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 order-2 sm:order-1 transition"
              >
                Guardar directamente
              </button>
              <button 
                onClick={() => { setShowConfirmModal(false); setShowReviewModal(true); }}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-indigo-700 order-1 sm:order-2 shadow-md shadow-blue-500/10 transition"
              >
                Sí, revisar datos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRINCIPAL: VISTA LADO A LADO */}
      {showReviewModal && extractedData && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Cabecera */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">Revisión Humana del Comprobante</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-medium">✕</button>
            </div>

            {/* Cuerpo del Modal: Lado a Lado */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
              
              {/* LADO IZQUIERDO: Imagen o PDF del ticket */}
              <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 flex flex-col justify-center items-center min-h-[300px] md:max-h-[550px] overflow-hidden shadow-inner">
                {previewUrl === 'pdf' ? (
                  <div className="text-center p-6">
                    <svg className="h-16 w-16 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
                    <p className="text-sm font-medium text-slate-700 mt-2">Documento PDF cargado en el sistema</p>
                    <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Abrir PDF completo en nueva pestaña ↗</a>
                  </div>
                ) : (
                  <img src={previewUrl || uploadedUrl} alt="Copia del ticket digital" className="max-w-full max-h-[480px] object-contain rounded-lg shadow-sm" />
                )}
              </div>

              {/* LADO DERECHO: Formulario de Modificación de Datos */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Establecimiento / Comercio</label>
                    <input 
                      type="text" 
                      value={extractedData.establecimiento || ''} 
                      onChange={(e) => setExtractedData({ ...extractedData, establecimiento: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Fecha Emisión</label>
                      <input 
                        type="date" 
                        value={extractedData.fecha || ''} 
                        onChange={(e) => setExtractedData({ ...extractedData, fecha: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Categoría de Gasto</label>
                      <select 
                        value={extractedData.categoria || 'Otros'} 
                        onChange={(e) => setExtractedData({ ...extractedData, categoria: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800 font-medium"
                      >
                        <option value="Supermercado">Supermercado</option>
                        <option value="Restaurante">Restaurante</option>
                        <option value="Tecnología">Tecnología</option>
                        <option value="Ropa">Ropa</option>
                        <option value="Transporte">Transporte</option>
                        <option value="Entretenimiento">Entretenimiento</option>
                        <option value="Hogar">Hogar</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Importe Total del Ticket (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={extractedData.total || 0} 
                      onChange={(e) => setExtractedData({ ...extractedData, total: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-800 font-bold text-lg"
                    />
                  </div>
                </div>

                {/* Botonera inferior de confirmación */}
                <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end bg-white">
                  <button 
                    type="button" 
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-600 transition"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => guardarEnSupabase(extractedData)}
                    className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl text-sm hover:from-green-700 hover:to-emerald-700 shadow-md shadow-green-500/10 transition"
                  >
                    Confirmar y Guardar en DB
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}