import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan las variables de entorno de Supabase (URL o Anon Key)');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseClient = supabase; // Por si algún archivo lo importa con este nombre exacto

export default supabase;