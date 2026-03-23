import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SignupForm } from '../../src/features/auth/components/SignupForm';
import { simulate } from '../utils/simulate';
import { useRouter } from 'next/navigation';
import { useSignup } from '../../src/features/auth/hooks/useAuth';
import { showToast } from '../../src/shared/utils/toast';

// Mock the hooks and utilities
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('../../src/features/auth/hooks/useAuth', () => ({
  useSignup: vi.fn(),
}));

vi.mock('../../src/shared/utils/toast', () => ({
  showToast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

describe('SignupForm', () => {
  const mockPush = vi.fn();
  const mockSignup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useSignup).mockReturnValue({
      mutate: mockSignup,
      isPending: false,
      isSuccess: false,
      error: null,
    } as unknown as ReturnType<typeof useSignup>);
  });

  it('renders signup form correctly', () => {
    render(<SignupForm />);
    expect(screen.getByText(/Create Your Account/i)).toBeTruthy();
    expect(screen.getByLabelText(/Email Address/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Password$/i)).toBeTruthy();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeTruthy();
  });

  it('updates email, password and confirm password fields on change', async () => {
    render(<SignupForm />);
    const emailInput = screen.getByPlaceholderText(/you@example.com/i) as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText(/Minimum 6 characters/i) as HTMLInputElement;
    const confirmInput = screen.getByPlaceholderText(/Confirm your password/i) as HTMLInputElement;

    await simulate.type(emailInput, 'test@example.com');
    await simulate.type(passwordInput, 'password123');
    await simulate.type(confirmInput, 'password123');

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
    expect(confirmInput.value).toBe('password123');
  });

  it('calls signup mutation on form submit when fields are valid', async () => {
    render(<SignupForm />);
    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/Minimum 6 characters/i);
    const confirmInput = screen.getByPlaceholderText(/Confirm your password/i);
    const submitButton = screen.getByRole('button', { name: /Create Account/i });

    await simulate.type(emailInput, 'test@example.com');
    await simulate.type(passwordInput, 'password123');
    await simulate.type(confirmInput, 'password123');
    await simulate.click(submitButton);

    expect(mockSignup).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('shows error if passwords do not match', async () => {
    render(<SignupForm />);
    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/Minimum 6 characters/i);
    const confirmInput = screen.getByPlaceholderText(/Confirm your password/i);
    const submitButton = screen.getByRole('button', { name: /Create Account/i });

    await simulate.type(emailInput, 'test@example.com');
    await simulate.type(passwordInput, 'password123');
    await simulate.type(confirmInput, 'password456');
    await simulate.click(submitButton);

    expect(showToast.error).toHaveBeenCalledWith('Password mismatch', 'Passwords do not match');
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('shows error if password is too short', async () => {
    render(<SignupForm />);
    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/Minimum 6 characters/i);
    const confirmInput = screen.getByPlaceholderText(/Confirm your password/i);
    const submitButton = screen.getByRole('button', { name: /Create Account/i });

    await simulate.type(emailInput, 'test@example.com');
    await simulate.type(passwordInput, '12345');
    await simulate.type(confirmInput, '12345');
    await simulate.click(submitButton);

    expect(showToast.error).toHaveBeenCalledWith('Weak password', 'Password must be at least 6 characters');
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('displays success state after successful signup', async () => {
    vi.mocked(useSignup).mockReturnValue({
      mutate: mockSignup,
      isPending: false,
      isSuccess: true,
      error: null,
    } as unknown as ReturnType<typeof useSignup>);

    render(<SignupForm />);

    expect(screen.getByText(/Verify Your Email/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Go to Login/i })).toBeTruthy();
  });

  it('navigates to login page from success state', async () => {
    vi.mocked(useSignup).mockReturnValue({
      mutate: mockSignup,
      isPending: false,
      isSuccess: true,
      error: null,
    } as unknown as ReturnType<typeof useSignup>);

    render(<SignupForm />);
    const loginButton = screen.getByRole('button', { name: /Go to Login/i });

    await simulate.click(loginButton);

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('navigates to login page from signup form', async () => {
    render(<SignupForm />);
    const signinButton = screen.getByRole('button', { name: /Sign In/i });

    await simulate.click(signinButton);

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('disables fields and shows spinner when signup is pending', () => {
    vi.mocked(useSignup).mockReturnValue({
      mutate: mockSignup,
      isPending: true,
      isSuccess: false,
      error: null,
    } as unknown as ReturnType<typeof useSignup>);

    render(<SignupForm />);
    
    expect((screen.getByPlaceholderText(/you@example.com/i) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Creating account.../i)).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
