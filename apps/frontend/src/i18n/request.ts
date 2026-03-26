import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, Locale } from './config';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  const validatedLocale = (locale && locales.includes(locale as Locale) ? locale : defaultLocale) as string;

  return {
    locale: validatedLocale,
    messages: (await import(`../../messages/${validatedLocale}.json`)).default
  };
});
