// Backend yanıt şemalarıyla birebir eşleşen tipler (bkz. backend/app/schemas/*.py).
// Alan adları backend'deki gibi snake_case tutulur; dönüşüm burada yapılmaz.

export interface CountItem {
  value: string;
  count: number;
}

export interface DashboardResponse {
  total_reviews: number;
  top_countries: CountItem[];
  top_family_country: CountItem | null;
  most_common_language: CountItem | null;
  sentiment_distribution: CountItem[];
  traveler_type_distribution: CountItem[];
}

export interface HotelOut {
  id: number;
  name: string | null;
  country: string | null;
  city: string | null;
}

export interface ReviewListItem {
  id: number;
  review_text: string;
  language: string | null;
  country: string | null;
  traveler_type: string | null;
  sentiment_label: string | null;
  summary: string | null;
  review_date: string | null;
  created_at: string;
}

export interface ReviewDetail extends ReviewListItem {
  hotel: HotelOut | null;
  keywords: string[];
}

export interface ReviewListResponse {
  items: ReviewListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FilterOptionsResponse {
  countries: string[];
  languages: string[];
  traveler_types: string[];
  sentiment_labels: string[];
  date_ranges: string[];
  sort_orders: string[];
}

export interface ImportResultResponse {
  total_rows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  enrichment_failed: number;
}

export interface HealthResponse {
  status: string;
  database: string;
}

// UI tarafındaki filtre/sıralama seçimleri; `/reviews` sorgu parametrelerine
// birebir dönüştürülür (bkz. src/api/client.ts -> fetchReviews).
export interface ReviewFilters {
  search: string;
  country: string;
  language: string;
  travelerType: string;
  sentimentLabel: string;
  dateRange: string;
  sort: string;
}
