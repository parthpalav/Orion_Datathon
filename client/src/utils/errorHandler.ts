// Utility to extract error message from axios errors
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if ('response' in error) {
      const axiosError = error as { response?: { data?: { error?: string; message?: string } } };
      return axiosError.response?.data?.error || axiosError.response?.data?.message || error.message;
    }
    return error.message;
  }
  return 'An unknown error occurred';
};
