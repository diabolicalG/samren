import './globals.css';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { AdminSidebar } from '@/components/AdminSidebar';

export const metadata = {
  title: 'Samren Admin',
  description: 'Samren - Anime streaming marketplace admin dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <div className="flex h-screen bg-background text-foreground">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
