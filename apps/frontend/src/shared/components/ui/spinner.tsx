import React from 'react';
import { Loader2Icon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useTranslations } from 'next-intl';


function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  const t = useTranslations('common.buttons');
  return (
    <Loader2Icon
      role="status"
      aria-label={t('loading')}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
