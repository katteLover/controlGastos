'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js'; // <-- Cambiado a la librería base

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Función para cerrar sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  // Función simulada para subir el ticket (conectarás con tu API de compras/Gemini)
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Por favor, selecciona un archivo primero');

    setLoading(true);
    // Aquí irá tu fetch('/api/compras', { method: 'POST', body: formData })
    setTimeout(() => {
      alert('¡Ticket subido con éxito! (Simulado)');
      setLoading(false);
      setFile(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      
      {/* MENÚ LATERAL DE NAVEGACIÓN (Evita escribir rutas a mano) */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between">
        <div>
          <div className="mb-8">
            <h1 className="text-xl font-bold tracking-wider text-blue-400">TICKET <span className="text-white">AI</span></h1>
            <p className="text-xs text-slate-500">Panel de Control</p>
          </div>
          
          <nav className="space-y-2">
            <a href="/dashboard" className="flex items-center space-x-3 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium transition text-sm">
              <span>📊</span> <span>Inicio / Dashboard</span>
            </a>
            <a href="/dashboard/historial" className="flex items-center space-x-3 text-slate-400 hover:bg-slate-800 hover:text-white px-4 py-2.5 rounded-xl font-medium transition text-sm">
              <span>🧾</span> <span>Mis Compras</span>
            </a>
            <a href="/dashboard/metricas" className="flex items-center space-x-3 text-slate-400 hover:bg-slate-800 hover:text-white px-4 py-2.5 rounded-xl font-medium transition text-sm">
              <span>📈</span> <span>Estadísticas</span>
            </a>
          </nav>
        </div>

        {/* Botón de Cerrar Sesión en la parte inferior */}
        <button 
          onClick={handleLogout}
          className="mt-8 flex items-center space-x-3 text-red-400 hover:bg-red-500/10 w-full px-4 py-2.5 rounded-xl font-medium transition text-sm text-left border border-transparent hover:border-red-500/20"
        >
          <span>🚪</span> <span>Cerrar Sesión</span>
        </button>
      </aside>

      {/* CONTENIDO PRINCIPAL DEL DASHBOARD */}
      <main className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Bienvenido a tu Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Sube un nuevo ticket para comenzar el análisis inteligente.</p>
        </header>

        {/* COMPONENTE: ZONA DE SUBIDA DE TICKET */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>📂</span> Analizar Nuevo Comprobante
          </h3>
          
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition relative bg-slate-950/50">
              <input 
                type="file" 
                accept="image/*,application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="space-y-2">
                <span className="text-4xl block">📸</span>
                <p className="text-sm font-medium text-slate-300">
                  {file ? `Archivo seleccionado: ${file.name}` : 'Arrastra tu ticket aquí o haz clic para explorar'}
                </p>
                <p className="text-xs text-slate-500">Soporta imágenes (PNG, JPG) y PDF de hasta 5MB</p>
              </div>
            </div>

            {file && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? 'Procesando con IA...' : '🚀 Iniciar Análisis'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* SECCIÓN MOCK: RESUMEN DE COMPRAS RECIENTES */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
          <div className="text-center py-8 text-slate-500 text-sm border border-slate-800 border-dashed rounded-xl">
            Tus tickets procesados aparecerán listados en esta zona.
          </div>
        </div>
      </main>

    </div>
  );
}