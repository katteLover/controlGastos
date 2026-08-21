'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import TicketModal from '@/components/TicketModal';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      setUserEmail(session.user.email ?? 'Usuario');
      setUserId(session.user.id);
      await fetchGastos(session.user.id);
    };

    checkUserAndFetchData();
  }, [router]);

  const fetchGastos = async (currentUserId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('gastos')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al obtener los gastos:', error.message);
      } else {
        setGastos(data || []);
      }
    } catch (err) {
      console.error('Error inesperado:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from('gastos')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Hubo un error al eliminar el registro: ' + error.message);
      } else {
        setGastos(gastos.filter((g) => g.id !== id));
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push('/login');
  };

  // Función corregida y limpia para recargar datos al guardar un ticket
  const handleTicketSaved = async () => {
    setIsModalOpen(false);
    if (userId) {
      await fetchGastos(userId);
    }
  };

  // Cálculo flexible del total
  const totalGastos = gastos.reduce((acc, curr) => {
    const valor = curr.monto || curr.total || curr.precio || 0;
    return acc + Number(valor);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-800">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-xl font-bold">Gestor de Gastos & Tickets</h1>
          <p className="text-sm text-gray-500">{userEmail}</p>
        </div>
        <button 
          onClick={handleLogout} 
          className="text-red-500 font-medium text-sm hover:text-red-700 transition-colors"
        >
          Cerrar Sesión
        </button>
      </header>

      {/* Resumen */}
      <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <p className="text-sm text-gray-500 font-medium">Gasto Total</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">€ {totalGastos.toFixed(2)}</h3>
      </div>

      {/* Botón Nuevo Ticket */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold">Tus Tickets</h2>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
        >
          Nuevo Ticket
        </button>
      </div>

      {/* Tabla de Registros */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando datos...</div>
        ) : gastos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No hay tickets registrados aún.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="p-4">Descripción</th>
                <th className="p-4">Monto</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {gastos.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">
                    {g.descripcion || g.concepto || 'Sin descripción'}
                  </td>
                  <td className="p-4 font-semibold text-gray-900">
                    € {Number(g.monto || g.total || 0).toFixed(2)}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleDelete(g.id)} 
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <TicketModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleTicketSaved}
        title="Nuevo Ticket" 
      />
    </div>
  );
}