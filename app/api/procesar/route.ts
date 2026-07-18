import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Inicializamos los clientes de las plataformas
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // 1. Validar la sesión del usuario mediante el token enviado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Creamos un cliente de Supabase específico para este usuario usando su token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 2. Extraer el archivo y la URL del ticket del FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const ticketUrl = formData.get('ticketUrl') as string;

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    // 3. Convertir el archivo a formato compatible con Gemini
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Llamada al modelo Gemini para extraer la información en JSON limpio
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // O el modelo flash que tengas configurado
      contents: [
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: file.type,
          },
        },
        `Analiza este ticket de compra. Extrae la información estrictamente en el siguiente formato JSON válido, sin usar bloques de código de markdown (no uses \`\`\`json):
        {
          "establecimiento": "Nombre de la tienda",
          "fecha": "YYYY-MM-DD",
          "categoria": "Alimentación, Tecnología, Ropa, Hogar o Otros",
          "total": 0.00,
          "items": [
            { "nombre": "Nombre producto", "cantidad": 1, "precio": 0.00 }
          ]
        }`,
      ],
    });

    const textResult = response.text || '{}';
    // Limpieza por si Gemini añade caracteres extraños
    const cleanJsonString = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(cleanJsonString);

    // 5. INSERCIÓN EN SUPABASE (Aquí estaba el fallo)
    // Mapeamos los campos extraídos por la IA junto con la URL de la imagen del Bucket
    const { data: dbData, error: dbError } = await supabase
      .from('compras')
      .insert([
        {
          establecimiento: extractedData.establecimiento,
          fecha: extractedData.fecha,
          categoria: extractedData.categoria,
          total: Number(extractedData.total),
          items: extractedData.items || [], // Asegura que viaje como array
          ticket_url: ticketUrl || null      // Guardamos la URL de la imagen
        }
      ])
      .select();

    // 🚨 SI SUPABASE DA ERROR, PASAMOS AL CATCH PARA QUE EL FRONTEND SE ENTERE
    if (dbError) {
      console.error('Error directo de Supabase:', dbError);
      throw new Error(`Base de Datos: ${dbError.message} (Código: ${dbError.code})`);
    }

    // Si todo sale bien, respondemos con éxito
    return NextResponse.json({ 
      success: true, 
      compra: dbData[0] 
    });

  } catch (error: any) {
    console.error('Error en el endpoint de procesamiento:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' }, 
      { status: 500 }
    );
  }
}