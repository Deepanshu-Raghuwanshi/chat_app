import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Navbar } from '../../src/shared/components/Navbar';
import { renderWithIntl } from '../utils/render';
import { useAuthStore } from '../../src/features/auth/store/useAuthStore';
import { useLogout } from '../../src/features/auth/hooks/useAuth';
import { usePathname } from 'next/navigation';

// Mock the dependencies
vi.mock('../../src/features/auth/store/useAuthStore');
vi.mock('../../src/features/auth/hooks/useAuth');
vi.mock('next/navigation');

describe('Navbar Component', () => {
  const mockUser = {
    email: 'test@example.com',
    username: 'testuser',
    fullName: 'Test User'
  };

  it('should not render when not authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({ isAuthenticated: false, user: null } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useLogout>);
    vi.mocked(usePathname).mockReturnValue('/');

    const { container } = renderWithIntl(<Navbar />);
    expect(container.firstChild).toBeNull();
  });

  it('should render icons and avatar when authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({ isAuthenticated: true, user: mockUser } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useLogout>);
    vi.mocked(usePathname).mockReturnValue('/chat');

    renderWithIntl(<Navbar />);

    // Check for Home icon link (by title)
    const homeLink = screen.getByTitle(/home/i);
    expect(homeLink).toBeTruthy();
    expect(homeLink.getAttribute('href')).toBe('/chat');

    // Check for Friends icon link
    const friendsLink = screen.getByTitle(/friends/i);
    expect(friendsLink).toBeTruthy();
    expect(friendsLink.getAttribute('href')).toBe('/friends');

    // Check for Logout button icon
    const logoutBtn = screen.getByTitle(/logout/i);
    expect(logoutBtn).toBeTruthy();

    // Check for Avatar circle with first letter of email
    const avatar = screen.getByText(/t/i); // First letter of Test User is T
    expect(avatar).toBeTruthy();
    expect(avatar.className).toContain('rounded-full');

    // Ensure no "Online" text is present
    expect(screen.queryByText(/online/i)).toBeNull();
    
    // Ensure no app name text is visible
    expect(screen.queryByText(/chat app/i)).toBeNull();
  });

  it('should show spinner in logout button when pending', () => {
    vi.mocked(useAuthStore).mockReturnValue({ isAuthenticated: true, user: mockUser } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: true } as unknown as ReturnType<typeof useLogout>);
    vi.mocked(usePathname).mockReturnValue('/chat');

    renderWithIntl(<Navbar />);
    
    // Check for spinner
    const logoutBtn = screen.getByTitle(/logout/i);
    expect(logoutBtn.querySelector('svg.animate-spin')).toBeTruthy();
  });
});
