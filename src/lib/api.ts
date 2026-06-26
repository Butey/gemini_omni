export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem('admin_token');
  
  const options = init || {};
  if (token && typeof input === 'string' && input.startsWith('/api/')) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  const response = await fetch(input, options);

  if (response.status === 401 && typeof input === 'string' && input !== '/api/auth/login' && input !== '/api/auth/status') {
    localStorage.removeItem('admin_token');
    window.dispatchEvent(new Event('auth_required'));
  }

  return response;
};
