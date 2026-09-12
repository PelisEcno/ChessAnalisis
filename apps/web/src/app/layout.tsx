import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peón Libre",
  description:
    "Analizá tus partidas de Chess.com y Lichess con Stockfish, gratis.",
};

// Oscuro es el default (sin este script, la página ya arranca oscura por
// :root en globals.css); esto solo evita el parpadeo cuando el usuario
// eligió tema claro en una visita anterior.
const THEME_INIT_SCRIPT = `
try {
  if (localStorage.getItem('peon-libre:theme') === 'light') {
    document.documentElement.dataset.theme = 'light';
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
