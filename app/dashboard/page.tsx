'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Inicialización del cliente estándar de Supabase
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
}

// Función auxiliadora para formatear en Euros (€) con formato español (ej: 1.250,45 €)
const formatEuro = (value: number) => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
};

export default function DashboardPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loadingGastos, setLoadingGastos] = useState(true);
  const [userName, setUserName] = useState<string>('');

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

  // 3. Subir el archivo y enviarlo al backend procesador con Gemini
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Por favor, selecciona una foto o PDF de tu ticket primero.');

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No se encontró una sesión activa. Vuelve a iniciar sesión.');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al procesar el ticket');
      }

      alert(`¡Ticket analizado con éxito!\n\nTienda: ${data.compra.establecimiento}\nTotal: ${formatEuro(data.compra.total)}\nCategoría: ${data.compra.categoria}`);
      
      setFile(null);
      const fileInput = document.getElementById('ticket-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      fetchCompras(); 
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. Cerrar sesión
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // 5. Cálculos dinámicos basados en datos reales
  const totalGastado = compras.reduce((acc, item) => acc + Number(item.total), 0);
  const totalTickets = compras.length;
  const promedioGasto = totalTickets > 0 ? totalGastado / totalTickets : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Barra de navegación superior */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            ControlGastos AI
          </h1>
          <p className="text-xs text-slate-500">Sesión: {userName}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 transition duration-200"
        >
          Cerrar Sesión
        </button>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA: Formulario de Carga */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-700 mb-2">Escanear Nuevo Ticket</h2>
            <p className="text-xs text-slate-500 mb-4">
              Sube una foto o un PDF. Nuestro motor inteligente con Gemini extraerá automáticamente los productos, el comercio, el total y la categoría.
            </p>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-blue-500 transition cursor-pointer relative bg-slate-50">
                <input
                  id="ticket-input"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-1">
                  <svg className="mx-auto h-10 w-10 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium text-slate-600">
                    {file ? file.name : 'Seleccionar archivo o imagen'}
                  </p>
                  <p className="text-xs text-slate-400">PNG, JPG, JPEG o PDF hasta 10MB</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !file}
                className={`w-full py-3 px-4 rounded-xl text-white font-medium shadow-md transition duration-200 ${
                  loading || !file
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {loading ? 'Procesando con Gemini AI...' : 'Analizar Comprobante'}
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA: Métricas e Historial */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Fila de Tarjetas de Métricas Dinámicas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Gastado</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{formatEuro(totalGastado)}</p>
            </div>
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tickets Guardados</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{totalTickets}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gasto Promedio</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{formatEuro(promedioGasto)}</p>
            </div>
          </div>

          {/* Bloque del Historial de Gastos Reales */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 text-lg">Historial de Compras</h3>
              <button 
                onClick={fetchCompras} 
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Actualizar lista
              </button>
            </div>
            
            {loadingGastos ? (
              <div className="p-12 text-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                Cargando tu información financiera...
              </div>
            ) : compras.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <p className="font-medium text-slate-500">No hay transacciones registradas</p>
                <p className="text-xs max-w-sm mx-auto">Tus gastos aparecerán aquí estructurados automáticamente en cuanto subas tu primer ticket.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 text-slate-500 font-semibold text-xs border-b border-slate-100 uppercase tracking-wider">
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Establecimiento</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {compras.map((compra) => {
                      const dateObj = new Date(compra.fecha + 'T00:00:00');
                      const formattedDate = isNaN(dateObj.getTime()) 
                        ? compra.fecha 
                        : dateObj.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });

                      return (
                        <tr key={compra.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 text-slate-500 whitespace-nowrap">{formattedDate}</td>
                          <td className="p-4 font-semibold text-slate-900">{compra.establecimiento}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {compra.categoria}
                            </span>
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
    </div>
  );
}