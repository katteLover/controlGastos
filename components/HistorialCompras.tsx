"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase-client"; // Ajusta esta ruta según tu configuración de Supabase

interface Compra {
  id: string;
  created_at: string;
  establecimiento: string;
  total: number;
  categoria?: string;
  fecha_compra?: string;
}

export default function HistorialCompras() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = supabaseClient;

  useEffect(() => {
    async function cargarCompras() {
      try {
        setLoading(true);
        
        // Traemos las compras ordenadas por la fecha más reciente
        const { data, error: supabaseError } = await supabase
          .from("compras")
          .select("*")
          .order("created_at", { ascending: false });

        if (supabaseError) throw supabaseError;

        setCompras(data || []);
      } catch (err: any) {
        console.error("Error cargando compras:", err);
        setError("No se pudieron cargar tus gastos. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    cargarCompras();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando tus gastos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  if (compras.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-500 text-lg">Aún no has subido ningún ticket.</p>
        <p className="text-gray-400 text-sm mt-1">¡Sube tu primera compra para verla reflejada aquí!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Historial de Gastos</h2>
        <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
          {compras.length} {compras.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
              <th className="px-6 py-3">Fecha</th>
              <th className="px-6 py-3">Establecimiento</th>
              <th className="px-6 py-3">Categoría</th>
              <th className="px-6 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {compras.map((compra) => {
              // Formateamos la fecha para que sea legible
              const fechaAMostrar = compra.fecha_compra 
                ? new Date(compra.fecha_compra).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                : new Date(compra.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

              return (
                <tr key={compra.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {fechaAMostrar}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {compra.establecimiento || "Comercio no detectado"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-600 capitalize">
                      {compra.categoria || "General"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
                    {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(compra.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}