import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Space Mish — Device Control Hub',
  description: 'Your iPad becomes the cockpit. Control all your devices from one place.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Space Mish',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050816',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-body antialiased">
        {/* Cosmic background layers */}
        <div className="starfield" />
        <div className="cockpit-grid" />
        <div className="nebula-glow nebula-glow-1" />
        <div className="nebula-glow nebula-glow-2" />

        {/* App shell */}
        <div className="relative min-h-dvh flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
