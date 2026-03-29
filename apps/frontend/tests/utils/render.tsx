import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';

export function renderWithIntl(
  ui: React.ReactElement,
  { locale = 'en', ...options } = {}
) {
  return rtlRender(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
    options
  );
}

// Re-export everything from RTL
export * from '@testing-library/react';
