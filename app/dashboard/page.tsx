'use client';

import { useState, useMemo, useRef } from 'react';
import { Gasto, ItemGasto, MetricaSubcategoria, ProductoRanking } from '@/types';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

// Datos de demostración en EUROS (€)
const MOCK_GASTOS: Gasto[] = [
  {
    id: '1',
    fecha: '2026-08-05',
    comercio: 'Mercadona',
    categoria_general: 'Supermercado',
    monto_total: 84.50,
    moneda: 'EUR',
    url_comprobante: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    items_gasto: [
      { id: '101', descripcion: 'Solomillo Ibérico de Cerdo', cantidad: 1, precio_unitario: 24.00, monto_total: 24.00, subcategoria: 'Carnicería' },
      { id: '102', descripcion: 'Aceite de Oliva Virgen Extra 1L', cantidad: 2, precio_unitario: 9.50, monto_total: 19.00, subcategoria: 'Abarrotes y Aceites' },
      { id: '103', descripcion: 'Queso Parmesano Reggiano 250g', cantidad: 1, precio_unitario: 18.50, monto_total: 18.50, subcategoria: 'Lácteos y Quesos' },
      { id: '104', descripcion: 'Detergente Líquido Ropa 40L', cantidad: 1, precio_unitario: 12.00, monto_total: 12.00, subcategoria: 'Limpieza y Hogar' },
      { id: '105', descripcion: 'Pack Leche Entera 6L', cantidad: 1, precio_unitario: 7.00, monto_total: 7.00, subcategoria: 'Lácteos y Quesos' }
    ]
  },
  {
    id: '2',
    fecha: '2026-08-12',
    comercio: 'MediaMarkt',
    categoria_general: 'Tecnología',
    monto_total: 189.99,
    moneda: 'EUR',
    url_comprobante: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    items_gasto: [
      { id: '201', descripcion: 'Auriculares Inalámbricos Noise Cancelling', cantidad: 1, precio_unitario: 129.99, monto_total: 129.99, subcategoria: 'Audio y Sonido' },
      { id: '202', descripcion: 'Tarjeta MicroSD 256GB', cantidad: 1, precio_unitario: 35.00, monto_total: 35.00, subcategoria: 'Accesorios Tech' },
      { id: '203', descripcion: 'Cable USB-C Carga Rápida 2m', cantidad: 1, precio_unitario: 25.00, monto_total: 25.00, subcategoria: 'Accesorios Tech' }
    ]
  },
  {
    id: '3',
    fecha: '2026-08-18',
    comercio: 'Carrefour',
    categoria_general: 'Supermercado',
    monto_total: 62.30,
    moneda: 'EUR',
    url_comprobante: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    items_gasto: [
      { id: '301', descripcion: 'Salmón Fresco Fileteado 500g', cantidad: 1, precio_unitario: 22.50, monto_total: 22.50, subcategoria: 'Pescadería' },
      { id: '302', descripcion: 'Vino Tinto Reserva Rioja', cantidad: 2, precio_unitario: 11.00, monto_total: 22.00, subcategoria: 'Bebidas y Licores' },
      { id: '303', descripcion: 'Pastillas Lavavajillas Todo en 1', cantidad: 1, precio_unitario: 10.80, monto_total: 10.80, subcategoria: 'Limpieza y Hogar' },
      { id: '304', descripcion: 'Pan de Masa Madre', cantidad: 2, precio_unitario: 3.50, monto_total: 7.00, subcategoria: 'Panadería' }
    ]
  },
  {
    id: '4',
    fecha: '2026-07-22',
    comercio: 'Decathlon',
    categoria_general: 'Deportes',
    monto_total: 115.00,
    moneda: 'EUR',
    items_gasto: [
      { id: '401', descripcion: 'Zapatillas Running Trail', cantidad: 1, precio_unitario: 85.00, monto_total: 85.00, subcategoria: 'Calzado Deportivo' },
      { id: '402', descripcion: 'Camiseta Técnica Transpirable', cantidad: 2, precio_unitario: 15.00, monto_total: 30.00, subcategoria: 'Ropa Deportiva' }
    ]
  }
];

export default function DashboardPage() {
  const [gastos, setGastos] = useState<Gasto[]>(MOCK_GASTOS);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('2026-08'); // Formato YYYY-MM
  const [gastoSeleccionado, setGastoSeleccionado] = useState<Gasto | null>(null);
  
  const overlayRef = useRef<HTMLDivElement>(null);

  // Opciones dinámicas para el filtro Mes-Año
  const opcionesMeses = useMemo(() => {
    const mesesSet = new Set<string>();
    const hoy = new Date().toISOString().slice(0, 7);
    mesesSet.add(hoy);
    gastos.forEach(g => {
      if (g.fecha) mesesSet.add(g.fecha.slice(0, 7));
    });
    return Array.from(mesesSet).sort().reverse();
  }, [gastos]);

  // Filtrado de gastos por el mes seleccionado
  const gastosDelMes = useMemo(() => {
    return gastos.filter(g => g.fecha.startsWith(mesSeleccionado));
  }, [gastos, mesSeleccionado]);

  // Todos los ítems individuales del mes seleccionado
  const itemsDelMes = useMemo(() => {
    const lista: ProductoRanking[] = [];
    gastosDelMes.forEach(gasto => {
      if (gasto.items_gasto) {
        gasto.items_gasto.forEach(item => {
          lista.push({
            id: item.id || `${gasto.id}-${item.descripcion}`,
            descripcion: item.descripcion,
            subcategoria: item.subcategoria || 'Sin Subcategoría',
            monto_total: item.monto_total,
            precio_unitario: item.precio_unitario,
            cantidad: item.cantidad,
            fecha: gasto.fecha,
            comercio: gasto.comercio
          });
        });
      }
    });
    return lista;
  }, [gastosDelMes]);

  // Total gastado en el mes
  const totalMontoMes = useMemo(() => {
    return gastosDelMes.reduce((acc, curr) => acc + curr.monto_total, 0);
  }, [gastosDelMes]);

  // Análisis por Subcategorías (Métricas y Porcentajes)
  const metricasSubcategorias = useMemo(() => {
    const agrupado: { [key: string]: { monto: number; items: number } } = {};

    itemsDelMes.forEach(item => {
      const sub = item.subcategoria.trim();
      if (!agrupado[sub]) {
        agrupado[sub] = { monto: 0, items: 0 };
      }
      agrupado[sub].monto += item.monto_total;
      agrupado[sub].items += 1;
    });

    const resultado: MetricaSubcategoria[] = Object.keys(agrupado).map(sub => ({
      subcategoria: sub,
      montoTotal: agrupado[sub].monto,
      porcentaje: totalMontoMes > 0 ? (agrupado[sub].monto / totalMontoMes) * 100 : 0,
      cantidadItems: agrupado[sub].items
    }));

    return resultado.sort((a, b) => b.montoTotal - a.montoTotal);
  }, [itemsDelMes, totalMontoMes]);

  // Subcategoría principal en la que más se gastó
  const subcategoriaLider = useMemo(() => {
    return metricasSubcategorias.length > 0 ? metricasSubcategorias[0] : null;
  }, [metricasSubcategorias]);

  // TOP 10 Productos más caros del mes
  const top10Productos = useMemo(() => {
    return [...itemsDelMes]
      .sort((a, b) => b.monto_total - a.monto_total)
      .slice(0, 10);
  }, [itemsDelMes]);

  // Eliminar un ticket con confirmación mediante SweetAlert2
  const handleEliminarGasto = async (id: string) => {
    const res = await Swal.fire({
      title: '¿Confirmar Acción?',
      text: '¿Deseas eliminar este comprobante y todos sus productos?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#4b5563',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
      setGastos(prev => prev.filter(g => g.id !== id));
      Swal.fire({
        title: 'Eliminado',
        text: 'Comprobante eliminado con éxito.',
        icon: 'success',
        confirmButtonColor: '#2563eb'
      });
    }
  };

  // Exportar reporte completo a CSV
  const exportarCSV = () => {
    if (itemsDelMes.length === 0) {
      Swal.fire({
        title: 'Atención',
        text: 'No hay productos registrados en el mes seleccionado para exportar.',
        icon: 'info',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    const encabezados = ["Fecha", "Comercio", "Producto / Ítem", "Subcategoría", "Cantidad", "Precio Unitario (€)", "Monto Total (€)"];
    
    const filas = itemsDelMes.map(item => [
      item.fecha,
      `"${item.comercio.replace(/"/g, '""')}"`,
      `"${item.descripcion.replace(/"/g, '""')}"`,
      `"${item.subcategoria.replace(/"/g, '""')}"`,
      item.cantidad,
      item.precio_unitario.toFixed(2).replace('.', ','),
      item.monto_total.toFixed(2).replace('.', ',')
    ]);

    const contenidoCSV = [encabezados.join(";"), ...filas.map(f => f.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + contenidoCSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `reporte_gastos_${mesSeleccionado}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* CABECERA Y SELECTOR DE MES */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard de Gastos</h1>
            <p className="text-sm text-gray-500">Análisis detallado de comprobantes, ítems y subcategorías</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label htmlFor="mes-select" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
              Período:
            </label>
            <select
              id="mes-select"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-medium"
            >
              {opcionesMeses.map(mes => {
                const [year, month] = mes.split('-');
                const fechaObj = new Date(parseInt(year), parseInt(month) - 1);
                const nombreMes = fechaObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                return (
                  <option key={mes} value={mes}>
                    {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}
                  </option>
                );
              })}
            </select>

            <button
              onClick={exportarCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a12 12 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar CSV
            </button>
          </div>
        </header>

        {/* TARJETAS DE MÉTRICAS KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* KPI 1: Gasto Total del Mes */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <span className="text-sm font-semibold text-gray-500">Total Gastado ({mesSeleccionado})</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">{totalMontoMes.toFixed(2)} €</span>
              <span className="text-xs text-gray-400">({gastosDelMes.length} tickets)</span>
            </div>
          </div>

          {/* KPI 2: Subcategoría con mayor gasto */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-between">
            <span className="text-sm font-semibold text-blue-800">Subcategoría N° 1 en Gasto</span>
            <div className="mt-2">
              {subcategoriaLider ? (
                <>
                  <p className="text-2xl font-bold text-blue-950 truncate">{subcategoriaLider.subcategoria}</p>
                  <p className="text-sm text-blue-700 font-medium mt-1">
                    {subcategoriaLider.montoTotal.toFixed(2)} € <span className="text-xs font-normal">({subcategoriaLider.porcentaje.toFixed(1)}% del total)</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-2">Sin registro de datos</p>
              )}
            </div>
          </div>

          {/* KPI 3: Ítem más caro de la compra */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <span className="text-sm font-semibold text-gray-500">Producto Individual Más Caro</span>
            <div className="mt-2">
              {top10Productos.length > 0 ? (
                <>
                  <p className="text-lg font-bold text-gray-900 truncate">{top10Productos[0].descripcion}</p>
                  <p className="text-sm text-red-600 font-semibold mt-0.5">
                    {top10Productos[0].monto_total.toFixed(2)} € <span className="text-xs text-gray-500">({top10Productos[0].subcategoria})</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-2">Sin datos en el mes</p>
              )}
            </div>
          </div>

        </div>

        {/* SECCIÓN VISUAL: TOP 10 PRODUCTOS Y DESGLOSE POR SUBCATEGORÍA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* RANKING TOP 10 PRODUCTOS MÁS CAROS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🔥</span> Top 10 Productos Más Caros del Mes
            </h2>

            {top10Productos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No hay productos desglosados este mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-400 uppercase">
                      <th className="py-2">#</th>
                      <th className="py-2">Producto</th>
                      <th className="py-2">Subcategoría</th>
                      <th className="py-2 text-right">Monto (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {top10Productos.map((prod, index) => (
                      <tr key={prod.id} className="hover:bg-gray-50 transition">
                        <td className="py-2.5 font-bold text-gray-400">{index + 1}</td>
                        <td className="py-2.5 font-medium text-gray-800 max-w-[180px] truncate" title={prod.descripcion}>
                          {prod.descripcion}
                          <span className="block text-[11px] text-gray-400 font-normal">{prod.comercio} ({prod.fecha})</span>
                        </td>
                        <td className="py-2.5">
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                            {prod.subcategoria}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-bold text-gray-900">
                          {prod.monto_total.toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DESGLOSE POR SUBCATEGORÍA (GRÁFICO DE BARRAS / PROGRESO) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📊</span> Gastos por Subcategoría
            </h2>

            {metricasSubcategorias.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No hay subcategorías registradas.</p>
            ) : (
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                {metricasSubcategorias.map(metric => (
                  <div key={metric.subcategoria} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-gray-700">{metric.subcategoria}</span>
                      <span className="font-bold text-gray-900">
                        {metric.montoTotal.toFixed(2)} € <span className="text-xs text-gray-400 font-normal">({metric.porcentaje.toFixed(1)}%)</span>
                      </span>
                    </div>
                    {/* Barra de progreso de porcentaje */}
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(metric.porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* TABLA PRINCIPAL DE COMPROBANTES */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Comprobantes de {mesSeleccionado}</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 font-semibold">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Comercio</th>
                  <th className="p-3">Categoría General</th>
                  <th className="p-3">Total (€)</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {gastosDelMes.map(gasto => (
                  <tr key={gasto.id} className="hover:bg-gray-50 transition">
                    <td className="p-3">{gasto.fecha}</td>
                    <td className="p-3 font-semibold text-gray-800">{gasto.comercio}</td>
                    <td className="p-3">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium">
                        {gasto.categoria_general}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-gray-900">{gasto.monto_total.toFixed(2)} €</td>
                    <td className="p-3">
                      <button 
                        onClick={() => setGastoSeleccionado(gasto)} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium mr-2 transition"
                      >
                        Ver Ítems ({gasto.items_gasto?.length || 0})
                      </button>
                      <button 
                        onClick={() => handleEliminarGasto(gasto.id)} 
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL DETALLE DEL COMPROBANTE CON PRODUCTOS Y SUBCATEGORÍAS */}
      {gastoSeleccionado && (
        <div 
          ref={overlayRef} 
          onClick={(e) => { if (e.target === overlayRef.current) setGastoSeleccionado(null); }}
          className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
        >
          <div className="bg-white p-6 rounded-2xl w-full max-w-3xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setGastoSeleccionado(null)} 
              className="absolute top-4 right-4 text-2xl font-bold text-gray-400 hover:text-gray-600"
            >
              &times;
            </button>

            <h2 className="text-xl font-bold mb-2">Detalle de Compra - {gastoSeleccionado.comercio}</h2>
            <p className="text-sm text-gray-500 mb-4">Fecha: {gastoSeleccionado.fecha} | Total Ticket: <strong>{gastoSeleccionado.monto_total.toFixed(2)} €</strong></p>

            <h3 className="font-bold text-sm text-gray-700 mb-2">Desglose de Ítems y Subcategorías:</h3>
            <div className="border rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Subcategoría</th>
                    <th className="p-3 text-center">Cant.</th>
                    <th className="p-3 text-right">Precio U. (€)</th>
                    <th className="p-3 text-right">Total (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {gastoSeleccionado.items_gasto?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium text-gray-800">{item.descripcion}</td>
                      <td className="p-3">
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                          {item.subcategoria}
                        </span>
                      </td>
                      <td className="p-3 text-center">{item.cantidad}</td>
                      <td className="p-3 text-right">{item.precio_unitario.toFixed(2)} €</td>
                      <td className="p-3 text-right font-bold text-gray-900">{item.monto_total.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {gastoSeleccionado.url_comprobante && (
              <div>
                <h3 className="font-bold text-sm text-gray-700 mb-2">Documento Adjunto:</h3>
                <iframe src={gastoSeleccionado.url_comprobante} className="w-full h-64 border rounded-xl" title="Comprobante Original" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}