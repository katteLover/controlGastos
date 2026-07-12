import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utilidad para combinar clases de Tailwind condicionales sin conflictos
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Toma un archivo de imagen (File), lo renderiza en un Canvas oculto,
 * lo comprime a una resolución máxima de 1200px y calidad 0.8,
 * y devuelve un string Base64 limpio sin metadatos de prefijo.
 */
export function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1200; // Límite establecido en las directivas

        // Calcular proporciones óptimas
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto 2D del Canvas"));
          return;
        }

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Exportar a JPEG con compresión del 80% (0.8)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Extraer únicamente el contenido base64 (removiendo "data:image/jpeg;base64,")
        const base64Clean = dataUrl.split(',')[1];

        resolve({
          base64: base64Clean,
          mimeType: 'image/jpeg'
        });
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// Helper para formatear valores monetarios de manera consistente
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// Helper para formatear fechas a formato legible local
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}