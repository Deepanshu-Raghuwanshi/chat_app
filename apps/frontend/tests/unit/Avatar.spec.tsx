import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Avatar } from '../../src/shared/components/ui/Avatar';
import { renderWithIntl } from '../utils/render';

describe('Avatar Component', () => {
  it('renders initials when no avatarUrl is provided', () => {
    renderWithIntl(<Avatar fullName="John Doe" username="johndoe" />);
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('renders username initial when fullName is missing', () => {
    renderWithIntl(<Avatar username="johndoe" />);
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('renders image when avatarUrl is provided', () => {
    const url = 'https://example.com/avatar.jpg';
    renderWithIntl(<Avatar avatarUrl={url} fullName="John Doe" />);
    const img = screen.getByRole('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(url);
    expect(img.getAttribute('alt')).toBe('John Doe');
  });

  it('renders initials as fallback if image fails or is empty', () => {
    renderWithIntl(<Avatar avatarUrl="" fullName="John Doe" />);
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('applies size classes correctly', () => {
    const { container } = renderWithIntl(<Avatar size="lg" />);
    expect((container.firstChild as HTMLElement).className).toContain('size-16');
  });
});
