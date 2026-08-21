import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

// Inicializar cliente SDK de Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Definición del esquema JSON para la respuesta estructurada
const ticketSchema = {
  type: Type.OBJECT,
  properties: {
    establecimiento: {
      type: Type.STRING,
      description: 'Nombre del supermercado o tienda (ej: Mercadona, Carrefour, Lidl, Dia)',
    },
    fecha: {
      type: Type.STRING,
      description: 'Fecha de la compra en formato ISO (YYYY-MM-DD)',
    },
    total: {
      type: Type.NUMBER,
      description: 'Monto total pagado expresado en euros (€)',
    },
    articulos: {
      type: Type.ARRAY,
      description: 'Lista detallada de los artículos o productos comprados',
      items: {
        type: Type.OBJECT,
        properties: {
          nombre: {
            type: Type.STRING,
            description: 'Nombre o descripción del producto',
          },
          precio: {
            type: Type.NUMBER,
            description: 'Precio final del producto en euros (€)',
          },
          cantidad: {
            type: Type.NUMBER,
            description: 'Cantidad comprada (por defecto 1)',
          },
          categoria: {
            type: Type.STRING,
            description: 'Categoría estimada (Alimentación, Bebidas, Limpieza, Frescos, Varios, etc.)',
          },
        },
        required: ['nombre', 'precio'],
      },
    },
  },
  required: ['establecimiento', 'fecha', 'total', 'articulos'],
};

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: 'No se ha proporcionado ninguna imagen.' },
        { status: 400 }
      );
    }

    // Extraer base64 y tipo MIME de la imagen cargada
    const matches = image.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: 'Formato de imagen en base64 no válido.' },
        { status: 400 }
      );
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Llamada a la API usando @google/genai y el modelo gemini-3.1-flash-lite
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: 'Analiza este ticket de compra y extrae la información requerida en formato JSON siguiendo exactamente el esquema indicado. Todos los valores monetarios deben estar expresados en Euros (€).',
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: ticketSchema,
      },
    });

    const textResult = response.text;
    if (!textResult) {
      throw new Error('No se recibió una respuesta del modelo.');
    }

    const parsedData = JSON.parse(textResult);

    return NextResponse.json(parsedData, { status: 200 });
  } catch (error: any) {
    console.error('Error procesando el ticket con Gemini:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al procesar el ticket con IA.' },
      { status: 500 }
    );
  }
}