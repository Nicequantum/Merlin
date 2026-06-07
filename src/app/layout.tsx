import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Benz Tech — Dealership Warranty Platform',
  description: 'Mercedes-Benz dealership warranty story platform with audit-safe AI documentation.',
  icons: { icon: '/favicon.ico', apple: '/icon-512.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#1c1c1e', color: '#f5f5f7', border: '1px solid #38383a' },
          }}
        />
      </body>
    </html>
  );
}