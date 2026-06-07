import type { RepairOrder, StructuredROExtraction, TechnicianSession } from '@/types';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ session: TechnicianSession }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => apiFetch<{ session: TechnicianSession | null }>('/api/auth/me'),

  acceptConsent: () =>
    apiFetch<{ consentAt: string }>('/api/consent', { method: 'POST' }),

  listRepairOrders: () => apiFetch<{ repairOrders: RepairOrder[] }>('/api/repair-orders'),

  getRepairOrder: (id: string) => apiFetch<{ repairOrder: RepairOrder }>(`/api/repair-orders/${id}`),

  createRepairOrder: (data: Partial<RepairOrder>) =>
    apiFetch<{ repairOrder: RepairOrder }>('/api/repair-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRepairOrder: (id: string, data: Partial<RepairOrder>) =>
    apiFetch<{ repairOrder: RepairOrder }>(`/api/repair-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRepairOrder: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/repair-orders/${id}`, { method: 'DELETE' }),

  extractRO: (imageDataUrls: string[]) =>
    apiFetch<StructuredROExtraction>('/api/repair-orders/extract', {
      method: 'POST',
      body: JSON.stringify({ imageDataUrls }),
    }),

  generateStory: (roId: string, lineId: string) =>
    apiFetch<{ warrantyStory: string }>(`/api/repair-orders/${roId}/lines/${lineId}/generate-story`, {
      method: 'POST',
    }),

  decodeVin: (vin: string) =>
    apiFetch<{
      vin: string;
      year: string;
      make: string;
      model: string;
      engine: string;
      trim: string;
      valid: boolean;
    }>('/api/vin/decode', {
      method: 'POST',
      body: JSON.stringify({ vin }),
    }),
};