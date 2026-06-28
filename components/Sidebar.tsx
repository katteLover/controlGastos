'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, ShieldAlert, LogOut, Sun, Moon, PlusSquare, Sparkles } from 'lucide-react';
import UploadModal from './UploadModal';
import Link from 'next/link';

export default function Sidebar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Evitar desajustes de hidratación en Server Side Rendering para el selector de tema
  useEffect(() => {
    setMounted(true);
    
    // Consultar el perfil del usuario activo para saber si renderizar el acceso Admin
    const chequearRolAdministrador = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile?.role === 'admin') setEsAdmin(true);
      }
    };
    chequearRolAdministrador();
  }, []);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    // Destruir la cookie de acceso del cliente para sincronizar el middleware de inmediato
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
    router.refresh();
  };

  if (!mounted) return null;

  return (
    <>
      <aside className="w-full md:w-64 bg-white dark:bg-dark-card border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 flex flex-col p-4 space-y-6 md:h-screen fixed md:sticky top-0 z-40">
        {/* LOGO */}
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-500 font-bold text-xl px-2">
          <Sparkles className="w-6 h-6" />
          <span>Ticket<span className="text-gray-800 dark:text-dark-text font-medium">AI</span></span>
        </div>

        {/* BOTÓN SUBIDA ACCIÓN RÁPIDA */}
        <button 
          onClick={() => setModalAbierto(true)}
          className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm py-3 px-4 rounded-xl transition shadow-md shadow-emerald-700/10"
        >
          <PlusSquare className="w-4 h-4" />
          Subir Ticket
        </button>

        {/* ENLACES DE NAVEGACIÓN */}
        <nav className="flex-grow space-y-1">
          <Link 
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
              pathname === '/dashboard' 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Mi Dashboard
          </Link>

          {esAdmin && (
            <Link 
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                pathname === '/admin' 
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
              Consola Admin
            </Link>
          )}
        </nav>

        {/* CONTROLES INFERIORES: MODO OSCURO Y SALIDA */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <span className="flex items-center gap-3">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}
            </span>
            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md uppercase font-bold text-gray-400">Alt</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MODAL DE SUBIDA ACOPLADO */}
      <UploadModal 
        isOpen={modalAbierto} 
        onClose={() => setModalAbierto(false)} 
        onSuccess={() => {
          // Fuerza el refresco de las rutas de Next.js para actualizar useCompras()
          router.refresh();
          if (typeof window !== 'undefined') window.location.reload(); 
        }} 
      />
    </>
  );
}