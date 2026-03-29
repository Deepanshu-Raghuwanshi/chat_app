import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecommendationList } from '../../src/features/friends/components/RecommendationList';
import { renderWithIntl } from '../utils/render';
import { simulate } from '../utils/simulate';

describe('RecommendationList Component', () => {
  const mockRecommendations = [
    { id: 'rec1', username: 'bob_brown', fullName: 'Bob Brown', avatarUrl: null }
  ];
  const mockOnSendRequest = vi.fn();

  it('should render recommendations and handle click', async () => {
    renderWithIntl(
      <RecommendationList 
        recommendations={mockRecommendations} 
        onSendRequest={mockOnSendRequest} 
      />
    );

    // Should show section header
    expect(screen.getByText(/recommended for you/i)).toBeTruthy();

    // Should show Bob Brown
    expect(screen.getByText('Bob Brown')).toBeTruthy();
    
    // Should not show Bob Brown's username
    expect(screen.queryByText('@bob_brown')).toBeNull();

    // Should call onSendRequest when Add Friend is clicked
    const addBtn = screen.getByRole('button', { name: /add friend/i });
    await simulate.click(addBtn);

    expect(mockOnSendRequest).toHaveBeenCalledWith('rec1');
  });

  it('should show placeholder when no recommendations', () => {
    renderWithIntl(
      <RecommendationList 
        recommendations={[]} 
        onSendRequest={mockOnSendRequest} 
      />
    );

    expect(screen.getByText(/no new recommendations right now/i)).toBeTruthy();
  });
});
