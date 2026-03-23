import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ForgotPasswordForm } from '../../src/features/auth/components/ForgotPasswordForm';
import { simulate } from '../utils/simulate';
import { useRouter } from 'next/navigation';
import { useForgotPassword } from '../../src/features/auth/hooks/useAuth';
import { showToast } from '../../src/shared/utils/toast';

// Mock the hooks and utilities
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('../../src/features/auth/hooks/useAuth', () => ({
  useForgotPassword: vi.fn(),
}));

vi.mock('../../src/shared/utils/toast', () => ({
  showToast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

describe('ForgotPasswordForm', () => {
  const mockPush = vi.fn();
  const mockForgotPassword = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useForgotPassword).mockReturnValue({
      mutate: mockForgotPassword,
      isPending: false,
      isSuccess: false,
      error: null,
    } as unknown as ReturnType<typeof useForgotPassword>);
  });

  it('renders forgot password form correctly', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByText(/Reset Password/i)).toBeTruthy();
    expect(screen.getByLabelText(/Email Address/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeTruthy();
  });

  it('updates email field on change', async () => {
    render(<ForgotPasswordForm />);
    const emailInput = screen.getByPlaceholderText(/you@example.com/i) as HTMLInputElement;

    await simulate.type(emailInput, 'test@example.com');

    expect(emailInput.value).toBe('test@example.com');
  });

  it('calls forgotPassword mutation on form submit', async () => {
    render(<ForgotPasswordForm />);
    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });

    await simulate.type(emailInput, 'test@example.com');
    await simulate.click(submitButton);

    expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
  });

  it('shows error toast if email is missing', async () => {
    render(<ForgotPasswordForm />);
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });

    await simulate.click(submitButton);

    await waitFor(() => {
      expect(showToast.error).toHaveBeenCalledWith(
        'Missing field',
        'Please enter your email address'
      );
    });
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it('displays success state after successful request', () => {
    vi.mocked(useForgotPassword).mockReturnValue({
      mutate: mockForgotPassword,
      isPending: false,
      isSuccess: true,
      error: null,
    } as unknown as ReturnType<typeof useForgotPassword>);

    render(<ForgotPasswordForm />);

    expect(screen.getByText(/Check your inbox for a password reset link/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Back to Login/i })).toBeTruthy();
  });

  it('navigates to login page when back button is clicked', async () => {
    render(<ForgotPasswordForm />);
    const backButton = screen.getByRole('button', { name: /Back to Login/i });

    await simulate.click(backButton);

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('disables fields and shows spinner when request is pending', () => {
    vi.mocked(useForgotPassword).mockReturnValue({
      mutate: mockForgotPassword,
      isPending: true,
      isSuccess: false,
      error: null,
    } as unknown as ReturnType<typeof useForgotPassword>);

    render(<ForgotPasswordForm />);
    
    expect((screen.getByPlaceholderText(/you@example.com/i) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Sending Link.../i)).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
