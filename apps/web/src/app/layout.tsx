import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BazilBot Universe — Device Control Hub',
  description: 'A clean, premium dashboard to control all your devices from one place.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BazilBot Universe',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f2f2f2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body antialiased" style={{ backgroundColor: '#f2f2f2' }}>
        {/* App shell */}
        <div className="relative min-h-dvh flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
