import type { Metadata } from 'next';
import './globals.css';
import TanstackProvider from '../src/core/providers/TanstackProvider';

export const metadata: Metadata = {
  title: 'Chat App',
  description: 'Production-grade chat application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TanstackProvider>{children}</TanstackProvider>
      </body>
    </html>
  );
}
