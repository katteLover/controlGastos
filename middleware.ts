import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Inicializamos un cliente temporal para leer las cookies de sesión
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        detectSessionInUrl: false
      }
    }
  );

  // NOTA: En un entorno de producción real con Next.js 14, se suele utilizar 
  // el paquete @supabase/ssr para transferir las cookies automáticamente de forma nativa.
  // Aquí emulamos la verificación básica leyendo el token de sesión.
  const token = req.cookies.get('sb-access-token')?.value;
  const { data: { user } } = token 
    ? await supabase.auth.getUser(token) 
    : { data: { user: null } };

  const url = req.nextUrl.clone();
  const { pathname } = url;

  // 1. Definición de rutas
  const isPublicRoute = ['/', '/login', '/register', '/auth/callback'].includes(pathname); 
  const isProtectedRoute = pathname.startsWith('/dashboard') || 
                            pathname.startsWith('/admin') || 
                            pathname.startsWith('/settings') || 
                            (pathname.startsWith('/api') && !pathname.startsWith('/api/public'));

  // 2. Redirección por falta de autenticación
  if (!user && isProtectedRoute) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 3. Redirección si ya está logueado e intenta ir a Login/Registro
  if (user && isPublicRoute && pathname !== '/auth/callback') {
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // 4. Protección específica para la ruta /admin (Solo rol 'admin')
  if (user && pathname.startsWith('/admin')) {
    // Usamos el cliente del servidor para validar el rol de forma segura en la DB
    const serverSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      url.pathname = '/dashboard'; 
      return NextResponse.redirect(url); // Redirige si es un 'user' ordinario
    }
  }

  return res;
}

// Configuración de las rutas que el middleware debe evaluar
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};