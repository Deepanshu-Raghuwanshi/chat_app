import type { Metadata } from 'next';
import './globals.css';
import TanstackProvider from '../src/core/providers/TanstackProvider';
import { AnimatedBackground } from '../src/shared/components/AnimatedBackground';

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
        <TanstackProvider>
          <AnimatedBackground />
          {children}
        </TanstackProvider>
      </body>
    </html>
  );
}
