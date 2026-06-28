import { useState, useEffect, useCallback } from 'react';
import { Purchase, FilterState } from '@/types';
import { supabaseClient } from '@/lib/supabase-client';

export function useCompras() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado inicial de los filtros del Dashboard (Mes actual por defecto)
  const [filters, setFilters] = useState<FilterState>(() => {
    const ahora = new Date();
    const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString().split('T')[0];
    return {
      startDate: primerDia,
      endDate: ultimoDia,
      categoria: 'todas',
      busqueda: ''
    };
  });

  const fetchCompras = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Obtener el token de la sesión activa de Supabase para adjuntarlo de forma segura
      const { data: { session } } = await supabaseClient.auth.getSession();
      const token = session?.access_token || '';

      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        categoria: filters.categoria,
        busqueda: filters.busqueda
      });

      const response = await fetch(`/api/compras?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Error al obtener las compras');
      
      setPurchases(json.data);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Ejecutar de forma reactiva cada vez que un filtro cambie
  useEffect(() => {
    fetchCompras();
  }, [fetchCompras]);

  return {
    purchases,
    loading,
    error,
    filters,
    setFilters,
    refetch: fetchCompras
  };
}