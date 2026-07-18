import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// 1. Inicializar el nuevo SDK unificado de Google
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

interface ItemDesglosado {
  nombre: string;
  shadow?: boolean;
  cantidad: number;
  precio: number;
}

interface EstructuraTicket {
  establecimiento: string;
  fecha: string;
  total: number;
  categoria: string;
  items: ItemDesglosado[];
}

export async function POST(request: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'La credencial GEMINI_API_KEY no está configurada en el servidor.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se recibió ningún archivo válido.' },
        { status: 400 }
      );
    }

    // 2. Convertir el archivo a buffer binario
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const prompt = `
      Analiza detalladamente esta imagen o documento de ticket de compra.
      Tu único objetivo es extraer la información y estructurarla exactamente en el siguiente esquema JSON, sin agregar texto extra, formato markdown ni introducciones:

      {
        "establecimiento": "Nombre comercial de la tienda o empresa",
        "fecha": "Fecha de emisión en formato estricto YYYY-MM-DD (si no es legible, usa la fecha de hoy)",
        "total": 0.00, 
        "categoria": "Clasifícalo exclusivamente en una de estas: Supermercado, Restaurante, Tecnología, Ropa, Transporte, Entretenimiento, Hogar, Otros",
        "items": [
          {
            "nombre": "Descripción simplificada del artículo o servicio",
            "cantidad": 1,
            "precio": 0.00
          }
        ]
      }

      Nota: Asegúrate de que los valores numéricos se guarden como floats/numbers y nunca como cadenas de texto.
    `;

    // 3. Ejecutar la llamada usando la nueva API estructurada: ai.models.generateContent
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite', // Tu modelo verificado
      contents: [
        prompt,
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: file.type,
          },
        },
      ],
      config: {
        // En el nuevo SDK, la configuración va dentro de este objeto nativo y tipado
        responseMimeType: 'application/json',
      },
    });

    // 4. Obtener el texto (en el nuevo SDK .text es una propiedad, no un método)
    const responseText = response.text;

    if (!responseText) {
      throw new Error('La IA devolvió una respuesta vacía o inválida.');
    }

    // 5. Parsear el JSON seguro
    const datosExtraidos: EstructuraTicket = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      compra: datosExtraidos,
    });

  } catch (error: any) {
    console.error('Error en el pipeline de @google/genai:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al procesar el archivo con el nuevo SDK.' },
      { status: 500 }
    );
  }
}