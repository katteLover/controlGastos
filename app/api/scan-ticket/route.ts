import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Inicialización de la SDK oficial @google/genai
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
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
      No agregues bloques de código markdown ni texto adicional fuera del JSON.

      Estructura requerida:
      {
        "comercio": "Nombre del establecimiento",
        "fecha": "YYYY-MM-DD",
        "categoria_general": "Alimentación | Transporte | Hogar | Ocio | Salud | Otros",
        "monto_total": 0.00,
        "items": [
          {
            "descripcion": "Nombre del producto",
            "subcategoria": "Ej. Lácteos, Bebidas, etc.",
            "cantidad": 1,
            "precio_unitario": 0.00,
            "monto_total": 0.00
          }
        ]
      }
    `;

    // Llamada con la nueva SDK @google/genai
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
    });

    const responseText = response.text || '';
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error procesando ticket con Gemini:', error);
    return NextResponse.json(
      { error: 'Error al escanear el ticket', details: error.message },
      { status: 500 }
    );
  }
}