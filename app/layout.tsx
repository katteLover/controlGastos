import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import './globals.css'; // Asegúrate de importar tus estilos globales de Tailwind

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ticket AI - Gestor de Gastos Inteligente',
  description: 'Analiza tus tickets de compra y gestiona tus finanzas con Inteligencia Artificial',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} bg-emerald-50/30 dark:bg-dark-bg text-gray-900 dark:text-dark-text min-h-screen transition-colors duration-200`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}