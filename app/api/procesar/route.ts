import { NextResponse } from 'next/server';
import { analyzeTicket } from '@/lib/gemini';
import { supabaseServer } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

// Configuración nativa de Next.js para Vercel Serverless
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // ... (aquí va todo el código que programamos antes)
}
export async function POST(req: Request) {
  try {
    // 1. Verificación de Autenticación Segura en el Servidor
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') || 
                  (req as any).cookies?.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Token de sesión ausente.' }, { status: 401 });
    }

    // Usamos el cliente anónimo público solo para validar la autenticidad del token del usuario
    const authCheckClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await authCheckClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    // 2. Extracción de los parámetros del cuerpo de la petición
    const body = await req.json();
    const { base64, mimeType, imageUrl } = body;

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: 'Parámetros obligatorios faltantes (base64, mimeType).' }, { status: 400 });
    }

    // 3. Procesamiento Multimodal con Gemini API
    const extractedData = await analyzeTicket(base64, mimeType);

    // 4. Inserción de la Compra Principal en la DB
    // Usamos supabaseServer para asegurar la escritura correcta omitiendo restricciones estrictas
    const { data: purchase, error: purchaseError } = await supabaseServer
      .from('purchases')
      .insert({
        user_id: user.id,
        establecimiento: extractedData.establecimiento || 'Establecimiento no identificado',
        fecha: extractedData.fecha || new Date().toISOString().split('T')[0],
        total: extractedData.total || 0,
        moneda: extractedData.moneda || 'EUR',
        imagen_url: imageUrl || null
      })
      .select()
      .single();

    if (purchaseError) {
      return NextResponse.json({ error: `Error persistiendo el ticket: ${purchaseError.message}` }, { status: 500 });
    }

    // 5. Inserción de los productos desglosados (Si existen)
    if (extractedData.productos && extractedData.productos.length > 0) {
      const formattedProducts = extractedData.productos.map((prod: any) => ({
        purchase_id: purchase.id,
        nombre: prod.nombre || 'Producto Genérico',
        categoria: prod.categoria || 'Otros',
        precio_unitario: prod.precio_unitario || prod.precio_total || 0,
        cantidad: prod.cantidad || 1,
        precio_total: prod.precio_total || 0
      }));

      const { error: productsError } = await supabaseServer
        .from('products')
        .insert(formattedProducts);

      if (productsError) {
        // Nota: En producción podrías querer implementar un rollback manual si falla,
        // pero dado el flujo, retornamos un mensaje descriptivo para alertar al cliente.
        return NextResponse.json({ 
          success: true, 
          data: purchase, 
          warning: `Compra guardada pero los productos fallaron al insertarse: ${productsError.message}` 
        });
      }
    }

    return NextResponse.json({ success: true, data: purchase });

  } catch (error: any) {
    console.error('Error crítico en /api/procesar:', error);
    return NextResponse.json({ error: error.message || 'Error interno al procesar el ticket.' }, { status: 500 });
  }
}