'use client';

import React, { useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast.warning('Por favor, completa todos los campos requeridos.');
      return;
    }

    if (password.length < 6) {
      toast.warning('La contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName // Se lee de forma nativa por el Trigger en Postgres
          }
        }
      });

      if (error) throw error;

      toast.success('¡Registro completado! Revisa tu email de confirmación si está activo o inicia sesión.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'Error registrando tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-tr from-emerald-500/10 via-transparent to-teal-500/5">
      <div className="bg-white dark:bg-dark-card border border-gray-100 dark:border-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-xl bg-emerald-700 text-white shadow-md shadow-emerald-700/20 mb-2">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-dark-text">Crear una Cuenta</h2>
          <p className="text-sm text-gray-400">Automatiza la gestión de tus comprobantes financieros</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Nombre Completo</label>
            <input 
              type="text" 
              placeholder="Juan Pérez"
              className="w-full text-sm bg-gray-50 dark:bg-dark-bg p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-dark-text focus:outline-none focus:border-emerald-500"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Correo Electrónico</label>
            <input 
              type="email" 
              placeholder="tu@correo.com"
              className="w-full text-sm bg-gray-50 dark:bg-dark-bg p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-dark-text focus:outline-none focus:border-emerald-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Contraseña</label>
            <input 
              type="password" 
              placeholder="Mínimo 6 caracteres"
              className="w-full text-sm bg-gray-50 dark:bg-dark-bg p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-dark-text focus:outline-none focus:border-emerald-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/10 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creando perfil...' : 'Registrar Cuenta'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          ¿Ya formas parte de la plataforma?{' '}
          <Link href="/login" className="text-emerald-600 hover:underline font-bold">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}