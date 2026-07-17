import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Inicializamos Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    // 1. Extraer el token de autenticación desde las cabeceras (headers)
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'No autorizado - Falta el token de sesión' }, { status: 401 });
    }

    // 2. Inicializar Supabase inyectando el token del usuario para respetar el RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    // Validar el token obteniendo los datos del usuario real
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
    }

    // 3. Extraer el archivo del FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    // 4. Convertir el archivo a Base64 para Gemini
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: file.type,
      },
    };

    // 5. Llamar a Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analiza detalladamente este ticket o factura de compra. 
    Extrae la información y devuélvela estrictamente en el siguiente formato JSON. 
    No agregues introducciones, explicaciones, ni bloques de código markdown (\`\`\`json). Devuelve únicamente el JSON crudo:

    {
      "establecimiento": "Nombre comercial del comercio o tienda",
      "fecha": "Fecha de la compra en formato YYYY-MM-DD (si no la encuentras, usa la fecha de hoy)",
      "total": 0.00,
      "categoria": "Elige una sola categoría lógica de esta lista: Supermercado, Restaurante, Tecnología, Ropa, Transporte, Entretenimiento, Hogar, Otros",
      "items": [
        {
          "producto": "Nombre corto del producto",
          "precio": 0.00
        }
      ]
    }`;

    const result = await model.generateContent([prompt, filePart]);
    const textResponse = result.response.text().trim();

    const cleanJsonString = textResponse.replace(/```json|```/g, '').trim();
    const extractedData = JSON.parse(cleanJsonString);

    // 6. Guardar la compra en Supabase (usando el user.id validado)
    const { data, error } = await supabase
      .from('compras')
      .insert({
        user_id: user.id,
        establecimiento: extractedData.establecimiento,
        fecha: extractedData.fecha,
        total: parseFloat(extractedData.total),
        categoria: extractedData.categoria,
        items: extractedData.items,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al guardar en base de datos:', error);
      return NextResponse.json({ error: 'Error al registrar la compra en la base de datos' }, { status: 500 });
    }

    return NextResponse.json({ success: true, compra: data });

  } catch (error: any) {
    console.error('Error en el procesamiento del ticket:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}