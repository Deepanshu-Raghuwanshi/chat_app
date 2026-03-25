import type { Metadata } from 'next';
import './globals.css';
import TanstackProvider from '../src/core/providers/TanstackProvider';
import { AnimatedBackground } from '../src/shared/components/AnimatedBackground';
import { Navbar } from '../src/shared/components/Navbar';
import { MainContent } from './MainContent';

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
          <Navbar />
          <AnimatedBackground />
          <MainContent>
            {children}
          </MainContent>
        </TanstackProvider>
      </body>
    </html>
  );
}
