import { api } from './apiClient';

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials);
  return data;
}

export async function register(details) {
  const { data } = await api.post('/auth/register', details);
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}
