import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white flex flex-col justify-between">
      {/* Navbar de la Landing */}
      <header className="container mx-auto px-6 py-4 flex justify-between items-center border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-wider text-blue-400">TICKET <span className="text-white">AI</span></h1>
        <Link href="/login" className="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg font-medium transition text-sm">
          Iniciar Sesión
        </Link>
      </header>

      {/* Contenido Principal */}
      <main className="container mx-auto px-6 text-center py-20 flex-1 flex flex-col justify-center items-center max-w-3xl">
        <span className="bg-blue-500/10 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/20 mb-4 animate-pulse">
          Potenciado con Gemini 1.5 Pro
        </span>
        <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          Controla tus finanzas escaneando tus <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">tickets con IA</span>
        </h2>
        <p className="text-slate-400 text-lg mb-8 max-w-xl">
          Sube tus facturas o recibos de compras. Nuestra inteligencia artificial extraerá los productos, precios e impuestos de forma automática.
        </p>
        <div className="flex gap-4">
          <Link href="/register" className="bg-white text-slate-950 hover:bg-slate-200 px-8 py-3 rounded-xl font-semibold transition shadow-lg shadow-white/5">
            Registrarse Gratis
          </Link>
          <Link href="/login" className="border border-slate-700 hover:bg-slate-800/50 px-8 py-3 rounded-xl font-semibold transition">
            Ver mi Dashboard
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-600 border-t border-slate-900">
        &copy; {new Date().getFullYear()} Ticket AI. Todos los derechos reservados.
      </footer>
    </div>
  );
}