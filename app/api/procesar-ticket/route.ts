import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Inicializa el cliente de Gemini (asegúrate de tener GEMINI_API_KEY en tu .env.local)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { imagenBase64 } = await request.json();

    if (!imagenBase64) {
      return NextResponse.json({ error: 'No se proporcionó ninguna imagen' }, { status: 400 });
    }

    // Limpiar el prefijo data:image/...;base64, si lo trae
    const base64Data = imagenBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Prompt experto que proporcionaste
    const systemInstruction = `Actúa como un sistema experto de OCR y estructuración de datos para Supabase (PostgreSQL). Tu tarea es extraer la información de la imagen del ticket adjunto y devolver un objeto JSON estricto que se ajuste exactamente a las columnas de mis tablas gastos e items_gasto.

Reglas de procesamiento:
1. Agrupación de Modificadores: Si encuentras líneas adicionales que corresponden a un modificador (ej: "CON HIELO", "Doble carne") debajo de un producto, NO los crees como ítems separados. Anéxalos al nombre del producto principal en el campo "descripcion" (ej: "SOLO + CON HIELO").
2. Inferencia Dinámica:
   - Asigna una "categoria_general" al comercio basándote en su nombre y productos (Ej: "Restaurante", "Supermercado", "Bazar").
   - Asigna una "subcategoria" a cada ítem basándote en la lógica del producto (Ej: "Bebidas", "Comidas"). Si no estás seguro, usa "Otros".
3. Formateo de Datos para SQL:
   - "fecha": formato estándar YYYY-MM-DD. Si el ticket tiene hora, ignora la hora o usa solo la fecha del ticket.
   - "monto_total" y precios: deben ser números (float) con dos decimales y sin símbolos de moneda (ej: 100.40, no "100,40 €").
   - "cantidad": si no es explícita, asume 1.00.
   - No incluyas explicaciones, saludos ni texto fuera del bloque JSON.

Estructura de salida JSON obligatoria:
{
  "gasto": {
    "comercio": "string (nombre del establecimiento)",
    "categoria_general": "string",
    "fecha": "YYYY-MM-DD",
    "monto_total": 0.00,
    "moneda": "EUR"
  },
  "items": [
    {
      "descripcion": "string (producto + modificadores si los hay)",
      "cantidad": 1.00,
      "precio_unitario": 0.00,
      "monto_total": 0.00,
      "subcategoria": "string"
    }
  ]
}`;

    // Llamada a Gemini utilizando el modelo multimodal adecuado
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: 'image/jpeg', // O el tipo de imagen correspondiente
          },
        },
        {
          text: 'Extrae la información de este ticket siguiendo estrictamente las reglas de estructura JSON indicadas.',
        },
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json', // Forzar respuesta estrictamente en JSON
      },
    });

    const textoRespuesta = response.text;
    if (!textoRespuesta) {
      throw new Error('La IA no devolvió ninguna respuesta.');
    }

    const datosEstrucutrados = JSON.parse(textoRespuesta);

    return NextResponse.json(datosEstrucutrados);
  } catch (error: any) {
    console.error('Error procesando ticket en API:', error);
    return NextResponse.json({ error: error.message || 'Error interno al procesar la imagen' }, { status: 500 });
  }
}