import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SetPasswordForm } from '../../src/features/auth/components/SetPasswordForm';
import { simulate } from '../utils/simulate';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSetPassword } from '../../src/features/auth/hooks/useAuth';
import { showToast } from '../../src/shared/utils/toast';

// Mock the hooks and utilities
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('../../src/features/auth/hooks/useAuth', () => ({
  useSetPassword: vi.fn(),
}));

vi.mock('../../src/shared/utils/toast', () => ({
  showToast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

describe('SetPasswordForm', () => {
  const mockPush = vi.fn();
  const mockSetPassword = vi.fn();
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useSearchParams).mockReturnValue({ get: mockGet } as unknown as ReturnType<typeof useSearchParams>);
    mockGet.mockReturnValue('valid-token');
    vi.mocked(useSetPassword).mockReturnValue({
      mutate: mockSetPassword,
      isPending: false,
    } as unknown as ReturnType<typeof useSetPassword>);
  });

  it('renders set password form correctly', () => {
    render(<SetPasswordForm />);
    expect(screen.getByText(/Set Your Password/i)).toBeTruthy();
    expect(screen.getByLabelText(/New Password/i)).toBeTruthy();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Set Password/i })).toBeTruthy();
  });

  it('shows error and redirects if no token is provided', () => {
    mockGet.mockReturnValue(null);
    render(<SetPasswordForm />);
    
    expect(showToast.error).toHaveBeenCalledWith('Invalid link', 'No token provided in the URL');
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('updates password fields on change', async () => {
    render(<SetPasswordForm />);
    const inputs = screen.getAllByPlaceholderText('••••••••') as HTMLInputElement[];
    const passwordInput = inputs[0];
    const confirmInput = inputs[1];

    await simulate.type(passwordInput, 'newpassword123');
    await simulate.type(confirmInput, 'newpassword123');

    expect(passwordInput.value).toBe('newpassword123');
    expect(confirmInput.value).toBe('newpassword123');
  });

  it('calls setPassword mutation on form submit when fields are valid', async () => {
    render(<SetPasswordForm />);
    const inputs = screen.getAllByPlaceholderText('••••••••');
    const passwordInput = inputs[0];
    const confirmInput = inputs[1];
    const submitButton = screen.getByRole('button', { name: /Set Password/i });

    await simulate.type(passwordInput, 'newpassword123');
    await simulate.type(confirmInput, 'newpassword123');
    await simulate.click(submitButton);

    expect(mockSetPassword).toHaveBeenCalledWith(
      { token: 'valid-token', password: 'newpassword123' },
      expect.any(Object)
    );
  });

  it('shows error if passwords do not match', async () => {
    render(<SetPasswordForm />);
    const inputs = screen.getAllByPlaceholderText('••••••••');
    const passwordInput = inputs[0];
    const confirmInput = inputs[1];
    const submitButton = screen.getByRole('button', { name: /Set Password/i });

    await simulate.type(passwordInput, 'newpassword123');
    await simulate.type(confirmInput, 'differentpassword');
    await simulate.click(submitButton);

    expect(showToast.error).toHaveBeenCalledWith('Passwords mismatch', 'Passwords do not match');
    expect(mockSetPassword).not.toHaveBeenCalled();
  });

  it('shows error if password is too short', async () => {
    render(<SetPasswordForm />);
    const inputs = screen.getAllByPlaceholderText('••••••••');
    const passwordInput = inputs[0];
    const confirmInput = inputs[1];
    const submitButton = screen.getByRole('button', { name: /Set Password/i });

    await simulate.type(passwordInput, 'short');
    await simulate.type(confirmInput, 'short');
    await simulate.click(submitButton);

    expect(showToast.error).toHaveBeenCalledWith('Weak password', 'Password must be at least 8 characters long');
    expect(mockSetPassword).not.toHaveBeenCalled();
  });

  it('displays success state after successful set', async () => {
    mockSetPassword.mockImplementation((data, options) => {
      options.onSuccess();
    });

    render(<SetPasswordForm />);
    const inputs = screen.getAllByPlaceholderText('••••••••');
    const passwordInput = inputs[0];
    const confirmInput = inputs[1];
    const submitButton = screen.getByRole('button', { name: /Set Password/i });

    await simulate.type(passwordInput, 'newpassword123');
    await simulate.type(confirmInput, 'newpassword123');
    await simulate.click(submitButton);

    expect(screen.getByText(/Password Set!/i)).toBeTruthy();
    expect(screen.getByText(/Your password has been updated/i)).toBeTruthy();
  });

  it('disables fields and shows spinner when setting is pending', () => {
    vi.mocked(useSetPassword).mockReturnValue({
      mutate: mockSetPassword,
      isPending: true,
    } as unknown as ReturnType<typeof useSetPassword>);

    render(<SetPasswordForm />);
    
    expect((screen.getAllByPlaceholderText('••••••••')[0] as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Setting password.../i)).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
