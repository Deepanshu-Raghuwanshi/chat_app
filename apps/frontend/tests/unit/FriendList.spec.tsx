import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FriendList } from '../../src/features/friends/components/FriendList';
import { renderWithIntl } from '../utils/render';
import { useFriends, useIncomingRequests, useRecommendations, useRespondToRequest, useSendFriendRequest } from '../../src/features/friends/hooks/useFriends';

// Mock the dependencies
vi.mock('../../src/features/friends/hooks/useFriends');

describe('FriendList Component', () => {
  const mockFriends = [
    { id: '1', username: 'john_doe', fullName: 'John Doe', avatarUrl: null }
  ];

  const mockRequests = [
    { id: 'r1', senderId: '2', sender: { username: 'jane_smith', fullName: 'Jane Smith', avatarUrl: null } }
  ];

  const mockRecommendations = [
    { id: 'rec1', username: 'bob_brown', fullName: 'Bob Brown', avatarUrl: null }
  ];

  it('should render Friends and Recommendations in "friends" tab', () => {
    vi.mocked(useFriends).mockReturnValue({ data: mockFriends, isLoading: false } as unknown as ReturnType<typeof useFriends>);
    vi.mocked(useIncomingRequests).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useIncomingRequests>);
    vi.mocked(useRecommendations).mockReturnValue({ data: mockRecommendations, isLoading: false } as unknown as ReturnType<typeof useRecommendations>);
    vi.mocked(useRespondToRequest).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useRespondToRequest>);
    vi.mocked(useSendFriendRequest).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useSendFriendRequest>);

    renderWithIntl(<FriendList activeTab="friends" />);

    // Should show Friends section header
    expect(screen.getByText(/friends/i, { selector: 'h2' })).toBeTruthy();
    // Should show John Doe
    expect(screen.getByText('John Doe')).toBeTruthy();
    // Should not show John Doe's username
    expect(screen.queryByText('@john_doe')).toBeNull();

    // Should show Recommendations section header
    expect(screen.getByText(/recommended for you/i)).toBeTruthy();
    // Should show Bob Brown
    expect(screen.getByText('Bob Brown')).toBeTruthy();
    // Should not show Bob Brown's username
    expect(screen.queryByText('@bob_brown')).toBeNull();

    // Should not show Incoming Requests section header
    expect(screen.queryByText(/incoming requests/i)).toBeNull();
  });

  it('should render Incoming Requests in "requests" tab', () => {
    vi.mocked(useFriends).mockReturnValue({ data: mockFriends, isLoading: false } as unknown as ReturnType<typeof useFriends>);
    vi.mocked(useIncomingRequests).mockReturnValue({ data: mockRequests, isLoading: false } as unknown as ReturnType<typeof useIncomingRequests>);
    vi.mocked(useRecommendations).mockReturnValue({ data: mockRecommendations, isLoading: false } as unknown as ReturnType<typeof useRecommendations>);
    vi.mocked(useRespondToRequest).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useRespondToRequest>);
    vi.mocked(useSendFriendRequest).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useSendFriendRequest>);

    renderWithIntl(<FriendList activeTab="requests" />);

    // Should show Incoming Requests section header
    expect(screen.getByText(/incoming requests/i)).toBeTruthy();
    // Should show Jane Smith
    expect(screen.getByText('Jane Smith')).toBeTruthy();
    // Should not show Jane Smith's username
    expect(screen.queryByText('@jane_smith')).toBeNull();

    // Should not show Friends section
    expect(screen.queryByText(/friends/i, { selector: 'h2' })).toBeNull();
    
    // Should not show Recommendations when requests exist (per logic)
    expect(screen.queryByText(/recommended for you/i)).toBeNull();
  });

  it('should show Recommendations and "No requests" message in "requests" tab when no requests exist', () => {
    vi.mocked(useFriends).mockReturnValue({ data: mockFriends, isLoading: false } as unknown as ReturnType<typeof useFriends>);
    vi.mocked(useIncomingRequests).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useIncomingRequests>);
    vi.mocked(useRecommendations).mockReturnValue({ data: mockRecommendations, isLoading: false } as unknown as ReturnType<typeof useRecommendations>);
    vi.mocked(useRespondToRequest).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useRespondToRequest>);
    vi.mocked(useSendFriendRequest).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useSendFriendRequest>);

    renderWithIntl(<FriendList activeTab="requests" />);

    // Should show "No incoming requests" message
    expect(screen.getByText(/no incoming requests/i)).toBeTruthy();

    // Should show Recommendations section header
    expect(screen.getByText(/recommended for you/i)).toBeTruthy();
    // Should show Bob Brown
    expect(screen.getByText('Bob Brown')).toBeTruthy();

    // Should not show Friends section
    expect(screen.queryByText(/friends/i, { selector: 'h2' })).toBeNull();
  });
});
