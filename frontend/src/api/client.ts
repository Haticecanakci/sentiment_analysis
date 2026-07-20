// Backend (FastAPI) ile konuşan tek fetch katmanı. Tüm bileşenler veriyi
// buradaki fonksiyonlar üzerinden alır; mock veri veya doğrudan fetch
// çağrısı bileşenlerde bulunmaz.

import {
  DashboardResponse,
  FilterOptionsResponse,
  HealthResponse,
  ImportResultResponse,
  ReviewDetail,
  ReviewListResponse,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      `Backend'e ulaşılamadı (${API_BASE_URL}). Sunucunun çalıştığından ve CORS ayarlarının doğru olduğundan emin olun.`
    );
  }

  if (!response.ok) {
    let detail = response.statusText || `İstek başarısız oldu (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // Yanıt gövdesi JSON değilse statusText kullanılır.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface ReviewQueryParams {
  country?: string;
  travelerType?: string;
  sentimentLabel?: string;
  language?: string;
  search?: string;
  dateRange?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

/** GET /health — API + DB bağlantı durumu (Header'daki canlı gösterge için). */
export function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

/** GET /dashboard — KPI kartları ve grafiklerin ihtiyaç duyduğu tüm agregasyonlar. */
export function fetchDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>('/dashboard');
}

/** GET /reviews — filtre/arama/sayfalama ile yorum listesi. */
export function fetchReviews(
  params: ReviewQueryParams = {},
  signal?: AbortSignal
): Promise<ReviewListResponse> {
  const qs = buildQuery({
    country: params.country,
    traveler_type: params.travelerType,
    sentiment_label: params.sentimentLabel,
    language: params.language,
    search: params.search,
    date_range: params.dateRange,
    sort: params.sort,
    page: params.page,
    page_size: params.pageSize,
  });
  return request<ReviewListResponse>(`/reviews${qs}`, { signal });
}

/** GET /reviews/filters — filtre dropdown'ları için distinct değerler. */
export function fetchReviewFilters(): Promise<FilterOptionsResponse> {
  return request<FilterOptionsResponse>('/reviews/filters');
}

/** GET /reviews/{id} — otel ve anahtar kelimeler dahil tek yorum detayı. */
export function fetchReviewDetail(id: number, signal?: AbortSignal): Promise<ReviewDetail> {
  return request<ReviewDetail>(`/reviews/${id}`, { signal });
}

/** POST /reviews/import — CSV dosyasını yükler, pipeline'ı çalıştırır, özet döner. */
export function importReviewsCsv(file: File): Promise<ImportResultResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return request<ImportResultResponse>('/reviews/import', {
    method: 'POST',
    body: formData,
  });
}
