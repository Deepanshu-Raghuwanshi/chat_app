import type { Metadata } from 'next';
import './globals.css';
import TanstackProvider from '../src/core/providers/TanstackProvider';
import { AnimatedBackground } from '../src/shared/components/AnimatedBackground';
import { Navbar } from '../src/shared/components/Navbar';
import { MainContent } from './MainContent';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Chat App',
  description: 'Production-grade chat application',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <TanstackProvider>
            <Navbar />
            <AnimatedBackground />
            <MainContent>
              {children}
            </MainContent>
          </TanstackProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
