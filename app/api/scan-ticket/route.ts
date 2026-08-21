import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

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
      Eres un experto en extracción de datos OCR de tickets y facturas.
      Analiza detenidamente la imagen adjunta e identifica TODOS los productos e ítems comprados.

      INSTRUCCIONES CLAVE:
      1. Extrae de forma exhaustiva CADA UNO de los productos listados en el ticket.
      2. Para cada ítem, asigna una subcategoría coherente (Ej: Lácteos, Carnicería, Bebidas, Frutas/Verduras, Limpieza, Snacking, Panadería, Electrónica, etc.).
      3. Asegúrate de calcular o extraer la cantidad, el precio unitario y el monto total de cada ítem.
      4. Si no puedes leer la subcategoría exacta, asigna una lógica según el nombre del producto.

      Responde ÚNICAMENTE con la siguiente estructura JSON válid:
      {
        "comercio": "Nombre del establecimiento",
        "fecha": "YYYY-MM-DD",
        "categoria_general": "Alimentación | Transporte | Hogar | Ocio | Salud | Otros",
        "monto_total": 0.00,
        "items": [
          {
            "descripcion": "Nombre del producto",
            "subcategoria": "Subcategoría estimada",
            "cantidad": 1,
            "precio_unitario": 0.00,
            "monto_total": 0.00
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
    const parsedData = JSON.parse(responseText);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error procesando ticket con Gemini:', error);
    return NextResponse.json(
      { error: 'Error al escanear el ticket', details: error.message },
      { status: 500 }
    );
  }
}