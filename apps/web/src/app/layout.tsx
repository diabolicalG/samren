import './globals.css';
import { Inter } from 'next/font/google';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { Navigation } from '@samren/ui';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Samren - Anime Streaming Marketplace',
  description: 'A modern anime streaming marketplace built with Next.js and Express',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReactQueryProvider>
          <div className="flex h-screen bg-background text-foreground">
            <Navigation />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
