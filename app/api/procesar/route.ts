import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai'; // <-- Corregido el nombre de la clase
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Inicializamos Gemini correctamente pasándole directamente el string de la API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    // 1. Verificar que el usuario esté autenticado en Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Extraer el archivo del FormData enviado por el frontend
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
    }

    // 3. Convertir el archivo a un formato que Gemini pueda entender (Base64)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: file.type,
      },
    };

    // 4. Llamar a Gemini (usamos gemini-1.5-flash por su velocidad y bajo costo)
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

    // Limpiamos posibles formatos de markdown que a veces la IA agrega por inercia
    const cleanJsonString = textResponse.replace(/```json|```/g, '').trim();
    const extractedData = JSON.parse(cleanJsonString);

    // 5. Guardar la información procesada directamente en la base de datos de Supabase
    const { data, error } = await supabase
      .from('compras')
      .insert({
        user_id: session.user.id,
        establecimiento: extractedData.establecimiento,
        fecha: extractedData.fecha,
        total: parseFloat(extractedData.total), // Aseguramos que sea un número flotante
        categoria: extractedData.categoria,
        items: extractedData.items,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al guardar en base de datos:', error);
      return NextResponse.json({ error: 'Error al registrar la compra' }, { status: 500 });
    }

    // Retornamos el registro guardado con éxito
    return NextResponse.json({ success: true, compra: data });

  } catch (error: any) {
    console.error('Error en el procesamiento del ticket:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}