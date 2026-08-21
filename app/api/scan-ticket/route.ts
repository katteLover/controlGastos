import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No se ha configurado la clave GEMINI_API_KEY en las variables de entorno.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    const prompt = `
      Analiza la imagen de este ticket/factura y extrae los datos en formato JSON estricto.
      
      INSTRUCCIONES CLAVE:
      1. Extrae CADA UNO de los productos/ítems listados en la compra.
      2. Asigna una subcategoría coherente a cada producto (Ej: Lácteos, Bebidas, Frutas, Limpieza, Carnicería, Panadería, etc.).
      3. Extrae la cantidad, precio unitario y monto total por ítem.

      Estructura JSON requerida:
      {
        "comercio": "Nombre del establecimiento",
        "fecha": "YYYY-MM-DD",
        "categoria_general": "Alimentación | Transporte | Hogar | Ocio | Salud | Otros",
        "monto_total": 0.00,
        "items": [
          {
            "descripcion": "Nombre del producto",
            "subcategoria": "Subcategoría asignada",
            "cantidad": 1,
            "precio_unitario": 0.00,
            "monto_total": 0.00
          }
        ]
      }
    `;

    // Llamada con el modelo gemini-3.1-flash-lite
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: file.type || 'image/jpeg',
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    
    // Limpieza preventiva de etiquetas Markdown
    const cleanJsonText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsedData = JSON.parse(cleanJsonText);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error detallado en /api/scan-ticket:', error);
    return NextResponse.json(
      { error: error.message || 'Error al escanear el ticket', details: String(error) },
      { status: 500 }
    );
  }
}