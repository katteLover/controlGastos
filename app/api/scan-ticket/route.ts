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
Eres un experto en contabilidad. Analiza la imagen del ticket y extrae la información en formato JSON estricto.

REGLAS OBLIGATORIAS:
1. "items": Debes listar cada fila de producto encontrada. Si un producto no tiene cantidad explícita, asume 1.
2. "monto_total": Debe ser la suma exacta de los ítems.
3. "subcategoria": Si no es evidente, infiérela basándote en la descripción del producto (ej: "Leche" -> "Lácteos").
4. Formato: Solo devuelve el JSON puro, sin texto adicional, sin formato markdown.

Estructura JSON:
{
  "comercio": "string",
  "fecha": "YYYY-MM-DD",
  "categoria_general": "Selecciona: Alimentación, Transporte, Hogar, Ocio, Salud, Otros",
  "monto_total": number,
  "items": [{ "descripcion": "string", "subcategoria": "string", "cantidad": number, "precio_unitario": number, "monto_total": number }]
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