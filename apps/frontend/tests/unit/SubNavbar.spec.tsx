import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SubNavbar } from '../../src/features/friends/components/SubNavbar';
import { renderWithIntl } from '../utils/render';
import { simulate } from '../utils/simulate';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';

describe('SubNavbar Component', () => {
  const mockOnTabChange = vi.fn();

  it('should render icons and request count badge', () => {
    renderWithIntl(
      <SubNavbar 
        activeTab="friends" 
        onTabChange={mockOnTabChange} 
        requestCount={5} 
      />
    );

    // Check for Friends icon button (by title)
    const friendsTab = screen.getByTitle(/friends/i);
    expect(friendsTab).toBeTruthy();

    // Check for Requests icon button (by title)
    const requestsTab = screen.getByTitle(/requests/i);
    expect(requestsTab).toBeTruthy();

    // Check for request count badge
    const badge = screen.getByText('5');
    expect(badge).toBeTruthy();
  });

  it('should call onTabChange when clicked', async () => {
    renderWithIntl(
      <SubNavbar 
        activeTab="friends" 
        onTabChange={mockOnTabChange} 
      />
    );

    const requestsTab = screen.getByTitle(/requests/i);
    await simulate.click(requestsTab);

    expect(mockOnTabChange).toHaveBeenCalledWith('requests');
  });

  it('should highlight the active tab', () => {
    const { rerender } = renderWithIntl(
      <SubNavbar 
        activeTab="friends" 
        onTabChange={mockOnTabChange} 
      />
    );

    const friendsTab = screen.getByTitle(/friends/i);
    expect(friendsTab.className).toContain('text-primary');

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SubNavbar 
          activeTab="requests" 
          onTabChange={mockOnTabChange} 
        />
      </NextIntlClientProvider>
    );

    const requestsTab = screen.getByTitle(/requests/i);
    expect(requestsTab.className).toContain('text-primary');
  });
});
