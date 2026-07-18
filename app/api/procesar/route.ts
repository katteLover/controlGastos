import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. Diagnóstico preventivo de variables de entorno
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta la configuración de la variable GEMINI_API_KEY en el servidor.' }, { status: 500 });
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Faltan las variables de entorno de acceso a Supabase en el backend.' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'No autorizado - Falta el token de sesión' }, { status: 401 });
    }

    // Inicializar el cliente usando variables del entorno del servidor de forma segura
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    // Validar el token contra el motor de autenticación de Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: `Sesión inválida o expirada en Supabase: ${authError?.message}` }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se cargó ningún archivo en la petición.' }, { status: 400 });
    }

    // Convertir archivo a estructura binaria Base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: file.type,
      },
    };

    // 2. Ejecutar la llamada a la Inteligencia Artificial de Google
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
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

    let textResponse = '';
    try {
      const result = await model.generateContent([prompt, filePart]);
      textResponse = result.response.text().trim();
    } catch (geminiError: any) {
      console.error('Fallo crítico en la API de Gemini:', geminiError);
      return NextResponse.json({ error: `Fallo en el servicio de Gemini AI: ${geminiError.message}` }, { status: 500 });
    }

    // 3. Extractor de JSON Ultra-Robusto mediante Regex
    // Esto busca el primer '{' y el último '}' ignorando cualquier texto decorativo que la IA añada por error
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('La IA no devolvió estructuras contenedoras de llaves. Respuesta:', textResponse);
      return NextResponse.json({ error: 'La IA procesó el ticket pero no formateó la respuesta como un objeto de datos válido.' }, { status: 500 });
    }

    let extractedData;
    try {
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError: any) {
      console.error('Error parseando JSON de la IA:', parseError, 'Texto bruto:', jsonMatch[0]);
      return NextResponse.json({ error: 'Los datos devueltos por la IA contienen errores de sintaxis estructural.' }, { status: 500 });
    }

    // 4. Inserción controlada en la base de datos protegiendo campos nulos o vacíos
    const { data, error } = await supabase
      .from('compras')
      .insert({
        user_id: user.id,
        establecimiento: extractedData.establecimiento || 'Establecimiento Desconocido',
        fecha: extractedData.fecha || new Date().toISOString().split('T')[0],
        total: parseFloat(extractedData.total) || 0,
        categoria: extractedData.categoria || 'Otros',
        items: extractedData.items || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Error de Supabase Database:', error);
      return NextResponse.json({ error: `Error al guardar en base de datos de Supabase: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, compra: data });

  } catch (error: any) {
    console.error('Excepción crítica no controlada:', error);
    return NextResponse.json({ error: `Fallo crítico del servidor: ${error.message}` }, { status: 500 });
  }
}