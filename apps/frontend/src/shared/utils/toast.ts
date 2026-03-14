import { toast } from 'sonner';

export const showToast = {
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      position: 'bottom-right',
      richColors: true,
    });
  },
  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      position: 'bottom-right',
      richColors: true,
    });
  },
  loading: (message: string) => {
    return toast.loading(message, {
      position: 'bottom-right',
    });
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages);
  },
};

export default showToast;
