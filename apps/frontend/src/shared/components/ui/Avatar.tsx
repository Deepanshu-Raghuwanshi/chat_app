import React from 'react';
import { cn } from '../../utils/cn';

interface AvatarProps extends React.ComponentProps<'div'> {
  avatarUrl?: string | null;
  fullName?: string | null;
  username?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Avatar = ({
  avatarUrl,
  fullName,
  username,
  size = 'md',
  className,
  ...props
}: AvatarProps) => {
  const initials = (fullName || username || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-16 text-xl',
    xl: 'size-24 text-3xl',
  };

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full bg-slate-100 items-center justify-center font-medium text-slate-600',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={fullName || username || 'Avatar'}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export { Avatar };
