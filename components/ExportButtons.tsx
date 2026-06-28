'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Purchase } from '@/types';

interface ExportButtonsProps {
  purchases: Purchase[];
}

export default function ExportButtons({ purchases }: ExportButtonsProps) {
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // 1. EXPORTACIÓN A CSV DESGLOSADO
  const exportarCSV = () => {
    const filasDesglosadas: any[] = [];

    // Aplanar los datos: Una fila por cada producto comprado
    purchases.forEach((p: any) => {
      if (p.products && p.products.length > 0) {
        p.products.forEach((prod: any) => {
          filasDesglosadas.push({
            'ID Ticket': p.id,
            'Fecha': p.fecha,
            'Establecimiento': p.establecimiento,
            'Moneda': p.moneda,
            'Total Ticket': p.total,
            'Producto': prod.nombre,
            'Categoría': prod.categoria,
            'Precio Unitario': prod.precio_unitario,
            'Cantidad': prod.cantidad,
            'Total Producto': prod.precio_total,
          });
        });
      } else {
        // Si el ticket no tiene desglose de productos, incluir al menos la cabecera
        filasDesglosadas.push({
          'ID Ticket': p.id,
          'Fecha': p.fecha,
          'Establecimiento': p.establecimiento,
          'Moneda': p.moneda,
          'Total Ticket': p.total,
          'Producto': 'Sin desglose',
          'Categoría': 'Otros',
          'Precio Unitario': p.total,
          'Cantidad': 1,
          'Total Producto': p.total,
        });
      }
    });

    // Convertir a texto CSV estructurado
    const csv = Papa.unparse(filasDesglosadas);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); // Añade BOM para acentos en Excel
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reporte_gastos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. EXPORTACIÓN DEL DASHBOARD/GRÁFICAS A PDF
  const exportarPDF = async () => {
    const elementoGraficos = document.getElementById('charts-container');
    if (!elementoGraficos) {
      alert('No se encontró el contenedor de gráficos para exportar.');
      return;
    }

    setIsExportingPDF(true);
    try {
      // Capturar el elemento HTML como canvas de alta definición
      const canvas = await html2canvas(elementoGraficos, {
        scale: 2, // Mejora la nitidez del texto y barras
        useCORS: true,
        backgroundColor: '#FFFFFF'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // Inicializar documento PDF en formato A4 vertical
      const pdf = new jsPDF('p', 'mm', 'a4');
      const anchoPagina = pdf.internal.pageSize.getWidth();
      const altoPagina = pdf.internal.pageSize.getHeight();
      
      // Márgenes y escalado proporcional
      const margen = 15;
      const anchoContenido = anchoPagina - (margen * 2);
      const altoContenido = (canvas.height * anchoContenido) / canvas.width;

      // Encabezado estético del PDF
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(15, 118, 110); // Color Emerald-700
      pdf.text('REPORTE ANALÍTICO DE GASTOS', margen, 20);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128); // Gris neutro
      pdf.text(`Generado el: ${new Date().toLocaleString()}`, margen, 26);
      pdf.text(`Total de comprobantes incluidos: ${purchases.length}`, margen, 31);
      
      // Línea divisoria
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margen, 36, anchoPagina - margen, 36);

      // Adjuntar la imagen de los gráficos
      pdf.addImage(imgData, 'JPEG', margen, 42, anchoContenido, altoContenido);

      // Guardar archivo localmente
      pdf.save(`informe_grafico_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={exportarCSV}
        className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg transition shadow-sm"
      >
        <Download className="w-4 h-4" />
        Exportar CSV
      </button>
      
      <button
        onClick={exportarPDF}
        disabled={isExportingPDF}
        className="flex items-center gap-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
      >
        {isExportingPDF ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        {isExportingPDF ? 'Generando...' : 'Descargar PDF'}
      </button>
    </div>
  );
}