export const getErrorMessage = (error, fallback = 'Something went wrong') => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first?.msg) return first.msg;
  }
  if (typeof error?.response?.data?.message === 'string') {
    return error.response.data.message;
  }
  if (!error?.response) return 'Network error. Check your connection.';
  return fallback;
};
