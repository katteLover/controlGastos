'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { supabaseClient } from '@/lib/supabase-client';
import { Shield, Users, BarChart3, TrendingUp, RefreshCw } from 'lucide-react';
import { Profile } from '@/types';

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const cargarDatosAdmin = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const json = await response.json();
      if (response.ok) {
        setData(json);
      }
    } catch (err) {
      console.error('Error al cargar panel admin', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosAdmin();
  }, []);

  const cambiarRol = async (userId: string, currentRole: 'user' | 'admin') => {
    const nuevoRol = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`¿Estás seguro de cambiar el rol de este usuario a ${nuevoRol.toUpperCase()}?`)) return;

    setUpdatingId(userId);
    try {
      // Actualización directa que impacta respetando la validación SQL
      const { error } = await supabaseClient
        .from('profiles')
        .update({ role: nuevoRol })
        .eq('id', userId);

      if (error) throw error;
      
      // Refrescar estado local de forma óptima
      setData((prev: any) => ({
        ...prev,
        usuarios: prev.usuarios.map((u: Profile) => u.id === userId ? { ...u, role: nuevoRol } : u)
      }));
    } catch (err: any) {
      alert('Error al actualizar rol: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-400 text-sm">Cargando consola de administración...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text flex items-center gap-2">
          <Shield className="text-emerald-700 w-8 h-8" />
          Consola de Administración
        </h1>
        <p className="text-gray-500 text-sm">Métricas globales del ecosistema y gestión de permisos corporativos</p>
      </div>

      {/* MÉTRICAS GLOBALES CRUZADAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase">Volumen de Gasto Global</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-dark-text mt-1">
              {formatCurrency(data?.stats?.totalGastoGlobal || 0)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase">Total Tickets Procesados</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-dark-text mt-1">
              {data?.stats?.totalTicketsGlobal || 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-teal-50 text-teal-700">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium uppercase">Usuarios Registrados</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-dark-text mt-1">
              {data?.stats?.totalUsuariosGlobal || 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-50 text-cyan-700">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* GESTIÓN DE USUARIOS */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text">Control de Roles y Perfiles</h3>
          <button onClick={cargarDatosAdmin} className="p-1.5 text-gray-400 hover:text-emerald-700 transition"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-dark-bg text-gray-400 text-xs font-medium uppercase">
              <tr>
                <th className="p-4">Identificador (UUID)</th>
                <th className="p-4">Nombre Completo</th>
                <th className="p-4">Rol Actual</th>
                <th className="p-4 text-center">Acciones de Cuenta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data?.usuarios?.map((user: Profile) => (
                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                  <td className="p-4 font-mono text-xs text-gray-400 select-all">{user.id}</td>
                  <td className="p-4 font-semibold text-gray-800 dark:text-dark-text">{user.full_name || 'Sin nombre asignado'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      user.role === 'admin' 
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30' 
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      disabled={updatingId === user.id}
                      onClick={() => cambiarRol(user.id, user.role)}
                      className="text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-emerald-700 hover:text-white dark:hover:bg-emerald-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-md transition disabled:opacity-50"
                    >
                      {updatingId === user.id ? 'Asignando...' : 'Alternar Rol'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}