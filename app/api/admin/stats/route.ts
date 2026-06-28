import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    // 1. Obtener métricas globales de compras
    const { data: allPurchases, error: purchasesError } = await supabaseServer
      .from('purchases')
      .select('total');

    if (purchasesError) throw purchasesError;

    // 2. Obtener lista completa de usuarios y perfiles
    const { data: profiles, error: profilesError } = await supabaseServer
      .from('profiles')
      .select('*');

    if (profilesError) throw profilesError;

    // Calcular agregaciones globales
    const totalGastoGlobal = allPurchases?.reduce((acc, curr) => acc + Number(curr.total), 0) || 0;
    const totalTicketsGlobal = allPurchases?.length || 0;
    const totalUsuariosGlobal = profiles?.length || 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalGastoGlobal,
        totalTicketsGlobal,
        totalUsuariosGlobal
      },
      usuarios: profiles
    });

  } catch (error: any) {
    console.error('Error en API Admin:', error);
    return NextResponse.json({ error: error.message || 'Error en el panel de administración.' }, { status: 500 });
  }
}