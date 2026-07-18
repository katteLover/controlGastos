'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Inicialización del cliente estándar de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ItemDesglosado {
  nombre: string;
  cantidad: number;
  precio: number;
}

interface Compra {
  id: string;
  fecha: string;
  establecimiento: string;
  categoria: string;
  total: number;
  items: ItemDesglosado[]; // Tipado estricto para el desglose
  ticket_url?: string;
}

// Función auxiliadora para formatear en Euros (€) con formato español
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
  
  // Estado para controlar qué ticket se está visualizando en el modal detallado
  const [selectedCompra, setSelectedCompra] = useState<Compra | null>(null);

  // 1. Verificar sesión del usuario e inicializar datos
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

  // Manejar la selección del archivo y generar la vista previa
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

  // Función nativa para comprimir imágenes usando Canvas
  const compressImage = (imageFile: File, quality = 0.6): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!imageFile.type.startsWith('image/')) {
        return resolve(imageFile);
      }

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

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressed = new File([blob], imageFile.name, {
                  type: imageFile.type,
                  lastModified: Date.now(),
                });
                resolve(compressed);
              } else {
                resolve(imageFile);
              }
            },
            imageFile.type,
            quality
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 2. Obtener las compras reales de Supabase
  const fetchCompras = async () => {
    try {
      setLoadingGastos(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('compras')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;
      setCompras(data || []);
    } catch (error: any) {
      console.error('Error cargando compras:', error.message);
    } finally {
      setLoadingGastos(false);
    }
  };

  // 3. Comprimir, subir al Bucket y procesar con Gemini
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Por favor, selecciona una foto o PDF de tu ticket primero.');

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No se encontró una sesión activa.');

      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file, 0.6);
      }

      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      const filePath = `comprobantes/${uniqueFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tickets')
        .upload(filePath, fileToUpload, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        throw new Error(`Error en el Storage: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage.from('tickets').getPublicUrl(filePath);

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('ticketUrl', publicUrl);

      const response = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al procesar el ticket');

      alert(`¡Ticket analizado con éxito!\n\nTienda: ${data.compra.establecimiento}\nTotal: ${formatEuro(data.compra.total)}`);
      
      setFile(null);
      setPreviewUrl(null);
      const fileInput = document.getElementById('ticket-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      fetchCompras(); 
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const totalGastado = compras.reduce((acc, item) => acc + Number(item.total), 0);
  const totalTickets = compras.length;
  const promedioGasto = totalTickets > 0 ? totalGastado / totalTickets : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            ControlGastos AI
          </h1>
          <p className="text-xs text-slate-500">Sesión: {userName}</p>
        </div>
        <button onClick={handleSignOut} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 transition">
          Cerrar Sesión
        </button>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario de Carga */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-700 mb-2">Escanear Nuevo Ticket</h2>
            <p className="text-xs text-slate-500 mb-4">Sube un comprobante para guardarlo en la nube y extraer sus productos.</p>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-blue-500 transition cursor-pointer relative bg-slate-50 min-h-[160px] flex flex-col justify-center items-center">
                <input id="ticket-input" type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                
                {previewUrl ? (
                  <div className="space-y-2 w-full z-20 pointer-events-none">
                    {previewUrl === 'pdf' ? (
                      <div className="flex flex-col items-center py-4">
                        <svg className="h-12 w-12 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/><path fillRule="evenodd" d="M6 6a1 1 0 011-1h3v3a1 1 0 001 1h3v7a1 1 0 01-1 1H7a1 1 0 01-1-1V6z" clipRule="evenodd"/></svg>
                        <p className="text-xs font-medium text-slate-600 mt-1">{file?.name}</p>
                      </div>
                    ) : (
                      <div className="relative rounded-lg overflow-hidden border bg-black/5 max-h-48 flex justify-center">
                        <img src={previewUrl} alt="Vista previa ticket" className="object-contain h-40" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <svg className="mx-auto h-10 w-10 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <p className="text-sm font-medium text-slate-600">Seleccionar comprobante</p>
                  </div>
                )}
              </div>

              <button type="submit" disabled={loading || !file} className={`w-full py-3 px-4 rounded-xl text-white font-medium shadow-md transition ${loading || !file ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
                {loading ? 'Procesando...' : 'Analizar y Subir'}
              </button>
            </form>
          </div>
        </div>

        {/* Métricas e Historial */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Gastado</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{formatEuro(totalGastado)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tickets</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{totalTickets}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Promedio</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{formatEuro(promedioGasto)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 text-lg">Historial de Compras</h3>
              <button onClick={fetchCompras} className="text-xs font-medium text-blue-600 hover:underline">Actualizar</button>
            </div>
            
            {loadingGastos ? (
              <div className="p-12 text-center text-slate-400">Cargando...</div>
            ) : compras.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No hay transacciones</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 text-slate-500 font-semibold text-xs border-b border-slate-100 uppercase tracking-wider">
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Establecimiento</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4 text-center">Detalles</th>
                      <th className="p-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {compras.map((compra) => {
                      const dateObj = new Date(compra.fecha + 'T00:00:00');
                      const formattedDate = isNaN(dateObj.getTime()) ? compra.fecha : dateObj.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });

                      return (
                        <tr key={compra.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 text-slate-500 whitespace-nowrap">{formattedDate}</td>
                          <td className="p-4 font-semibold text-slate-900">{compra.establecimiento}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {compra.categoria}
                            </span>
                          </td>
                          
                          {/* Botón dinámico que abre el modal */}
                          <td className="p-4 text-center">
                            <button
                              onClick={() => setSelectedCompra(compra)}
                              className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100 transition"
                            >
                              Ver desglose 🔍
                            </button>
                          </td>
                          
                          <td className="p-4 text-right font-bold text-slate-900">{formatEuro(Number(compra.total))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL DETALLADO RESPONSIVE: Muestra productos e imagen lado a lado */}
      {selectedCompra && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
            
            {/* Cabecera del Modal */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{selectedCompra.establecimiento}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(selectedCompra.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => setSelectedCompra(null)} 
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200/70 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Cuerpo del Modal (Adaptable a 2 columnas en pantallas medianas) */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8 content-start">
              
              {/* COLUMNA MODAL 1: Visualizador Integrado del Ticket */}
              <div className="flex flex-col items-center justify-center border border-slate-100 rounded-xl bg-slate-50/70 p-4 min-h-[250px]">
                <h4 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-3 self-start">Copia Digital Guardada</h4>
                {selectedCompra.ticket_url ? (
                  selectedCompra.ticket_url.toLowerCase().endsWith('.pdf') ? (
                    <div className="text-center py-6">
                      <svg className="h-16 w-16 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                      </svg>
                      <a href={selectedCompra.ticket_url} target="_blank" rel="noreferrer" className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition">
                        Ver PDF en pestaña nueva ↗
                      </a>
                    </div>
                  ) : (
                    <div className="relative w-full flex justify-center group">
                      <img 
                        src={selectedCompra.ticket_url} 
                        alt="Comprobante de compra" 
                        className="max-h-[45vh] md:max-h-[50vh] object-contain rounded-lg border border-slate-200 shadow-sm bg-white" 
                      />
                      <a 
                        href={selectedCompra.ticket_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="absolute bottom-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white text-xs py-1.5 px-2.5 rounded-md backdrop-blur-xs transition opacity-0 group-hover:opacity-100 hidden md:block"
                      >
                        Ampliar imagen ↗
                      </a>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-slate-400 italic">No se adjuntó archivo visual a este registro.</p>
                )}
              </div>

              {/* COLUMNA MODAL 2: Lista Completa de Artículos */}
              <div className="flex flex-col justify-between h-full min-h-[250px]">
                <div>
                  <h4 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-4">Artículos Extraídos ({selectedCompra.items?.length || 0})</h4>
                  <div className="divide-y divide-slate-100 max-h-[35vh] overflow-y-auto pr-2 border-b border-slate-150">
                    {selectedCompra.items && selectedCompra.items.length > 0 ? (
                      selectedCompra.items.map((item, idx) => (
                        <div key={idx} className="py-3 flex justify-between items-start text-sm hover:bg-slate-50/50 px-1 rounded-md transition">
                          <div className="max-w-[70%]">
                            <p className="font-semibold text-slate-800 leading-tight">{item.nombre}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Unidades: {item.cantidad || 1}</p>
                          </div>
                          <p className="font-bold text-slate-700 text-right whitespace-nowrap">
                            {formatEuro(Number(item.precio))}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic py-6 text-center">Este ticket se procesó sin desglose de artículos individuales.</p>
                    )}
                  </div>
                </div>

                {/* Resumen Final Inferior */}
                <div className="mt-6 pt-4 bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest block">Categoría</span>
                    <span className="text-xs font-semibold bg-white text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-xs inline-block mt-0.5 capitalize">{selectedCompra.categoria}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest block">Importe Total</span>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">{formatEuro(Number(selectedCompra.total))}</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}