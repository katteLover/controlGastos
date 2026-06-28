import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Faltan las variables de entorno de Supabase en el servidor.');
}

// Cliente administrativo para operaciones del servidor (bypassea RLS)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Evita guardar cookies de sesión en el proceso del servidor
    autoRefreshToken: false
  }
});