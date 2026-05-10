import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import messages from '../../messages/en.json';

export function renderWithIntl(
  ui: React.ReactElement,
  { locale = 'en', ...options } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
    options
  );
}

// Re-export everything from RTL
export * from '@testing-library/react';
