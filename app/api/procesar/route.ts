import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Inicialización de la API de Google Gen AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Credenciales de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // 1. Validar la sesión del usuario mediante el token Bearer
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado - Falta token de sesión' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Cliente dinámico de Supabase para respetar el RLS del usuario actual
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 2. Extraer el archivo de imagen y la URL del Bucket desde el FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const ticketUrl = formData.get('ticketUrl') as string;

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
    }

    // 3. Transformar el archivo a Buffer binario para pasarlo a la IA
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Invocación al modelo optimizado Gemini 3.1 Flash Lite
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: file.type,
          },
        },
        `Analiza este ticket de compra. Extrae la información estrictamente en el siguiente formato JSON válido, sin usar bloques de código de markdown (no utilices \`\`\`json ni cierres):
        {
          "establecimiento": "Nombre comercial de la tienda",
          "fecha": "YYYY-MM-DD",
          "categoria": "Supermercado, Restaurante, Tecnología, Ropa, Transporte, Entretenimiento, Hogar o Otros",
          "total": 0.00,
          "items": [
            { "nombre": "Nombre del artículo", "cantidad": 1, "precio": 0.00 }
          ]
        }`,
      ],
    });

    const textResult = response.text || '{}';
    // Limpieza de seguridad por si el modelo incluye marcas de código Markdown
    const cleanJsonString = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(cleanJsonString);

    // 5. Inserción directa en la base de datos controlada por RLS
    const { data: dbData, error: dbError } = await supabase
      .from('compras')
      .insert([
        {
          establecimiento: extractedData.establecimiento,
          fecha: extractedData.fecha,
          categoria: extractedData.categoria,
          total: Number(extractedData.total),
          items: extractedData.items || [],
          ticket_url: ticketUrl || null
        }
      ])
      .select();

    // Si la política RLS o la estructura falla, lanzamos una excepción clara
    if (dbError) {
      console.error('Error detectado en Supabase:', dbError);
      throw new Error(`Base de Datos: ${dbError.message} (Código: ${dbError.code})`);
    }

    return NextResponse.json({ 
      success: true, 
      compra: dbData[0] 
    });

  } catch (error: any) {
    console.error('Fallo en el flujo del endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno en el procesamiento del servidor' }, 
      { status: 500 }
    );
  }
}