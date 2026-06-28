'use client';

import React, { useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning('Por favor, rellena todos los campos.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      
      if (error) throw error;

      if (data?.session) {
        // Guardar la cookie de acceso para que el middleware valide la sesión en el servidor
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${data.session.expires_in}; SameSite=Lax;`;
        toast.success(`¡Bienvenido de nuevo!`);
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || 'Error de credenciales. Revisa tus datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error('No se pudo conectar con Google: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-tr from-emerald-500/10 via-transparent to-teal-500/5">
      <div className="bg-white dark:bg-dark-card border border-gray-100 dark:border-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-xl bg-emerald-700 text-white shadow-md shadow-emerald-700/20 mb-2">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-dark-text">Iniciar Sesión</h2>
          <p className="text-sm text-gray-400">Accede a tu panel financiero inteligente con IA</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="••••••••"
                className="w-full text-sm bg-gray-50 dark:bg-dark-bg p-3 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-dark-text focus:outline-none focus:border-emerald-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/10 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </form>

        <div className="relative flex py-2 items-center text-xs text-gray-400 uppercase font-semibold">
          <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
          <span className="flex-shrink mx-4">O continuar con</span>
          <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61a5.66 5.66 0 0 1-2.45 3.71v3.08h3.95a12 12 0 0 0 3.63-8.64z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.95-3.08c-1.1.74-2.5 1.18-4.01 1.18-3.09 0-5.71-2.09-6.64-4.9H1.42v3.18A12 12 0 0 0 12 24z"/>
            <path fill="#FBBC05" d="M5.36 14.29a7.16 7.16 0 0 1 0-4.58V6.53H1.42a12 12 0 0 0 0 10.94l3.94-3.18z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0A12 12 0 0 0 1.42 6.53l3.94 3.18c.93-2.81 3.55-4.9 6.64-4.9z"/>
          </svg>
          Google Workspace
        </button>

        <p className="text-center text-xs text-gray-400">
          ¿No tienes una cuenta aún?{' '}
          <Link href="/register" className="text-emerald-600 hover:underline font-bold">Regístrate gratis</Link>
        </p>
      </div>
    </div>
  );
}