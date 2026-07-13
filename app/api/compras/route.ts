import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // 1. Validar autenticación mediante el token de sesión
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') || 
                  (req as any).cookies?.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado. Token faltante.' }, { status: 401 });
    }

    const authCheckClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await authCheckClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
    }

    // 2. Extraer parámetros de búsqueda de la URL
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const categoria = searchParams.get('categoria');
    const busqueda = searchParams.get('busqueda');

    // 3. Construir la consulta base en Supabase incluyendo la relación de productos
    let query = supabaseServer
      .from('purchases')
      .select('*, products(*)')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false });

    // Aplicar filtro por rango de fechas si se proporcionan
    if (startDate) query = query.gte('fecha', startDate);
    if (endDate) query = query.lte('fecha', endDate);

    // Aplicar filtro de búsqueda por establecimiento (búsqueda parcial insensible a mayúsculas)
    if (busqueda) query = query.ilike('establecimiento', `%${busqueda}%`);

    const { data: purchases, error: queryError } = await query;

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    // 4. Filtrado secundario por categoría en el servidor (si aplica)
    // Como la categoría reside en la tabla 'products', filtramos las compras que contengan 
    // al menos un producto con dicha categoría.
    let filteredPurchases = purchases || [];
    if (categoria && categoria !== 'todas') {
      filteredPurchases = filteredPurchases.filter(purchase => 
        purchase.products && purchase.products.some((p: any) => p.categoria === categoria)
      );
    }

    return NextResponse.json({ success: true, data: filteredPurchases });

  } catch (error: any) {
    console.error('Error en GET /api/compras:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}