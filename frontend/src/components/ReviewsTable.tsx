import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, RotateCcw, ChevronLeft, ChevronRight, Filter, AlertCircle, Loader2 } from 'lucide-react';
import { fetchReviewFilters, fetchReviews } from '../api/client';
import { FilterOptionsResponse, ReviewFilters, ReviewListItem } from '../types';
import { countryNames, dateRangeLabels, languageNames, sentimentStyles, sortOrderLabels } from '../lib/labels';
import { formatDate } from '../lib/format';

interface ReviewsTableProps {
  /** Değiştiğinde (örn. CSV içe aktarımı sonrası) listeyi yeniden çeker. */
  refreshSignal: number;
  onReviewSelect: (id: number) => void;
}

const EMPTY_FILTERS: ReviewFilters = {
  search: '',
  country: '',
  language: '',
  travelerType: '',
  sentimentLabel: '',
  dateRange: '',
  sort: 'date_desc',
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function getPageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = Array.from(pages).filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  sorted.forEach((p, idx) => {
    if (idx > 0 && p - (sorted[idx - 1] as number) > 1) result.push('ellipsis');
    result.push(p);
  });
  return result;
}

export default function ReviewsTable({ refreshSignal, onReviewSelect }: ReviewsTableProps) {
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<ReviewFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [items, setItems] = useState<ReviewListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Arama kutusu 400ms debounce ile filters.search'e yansır (her tuş vuruşunda
  // backend'e istek atmamak için).
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
      setPage(1);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  // Filtre dropdown seçenekleri: mount'ta ve import sonrası (yeni distinct
  // değerler doğabileceğinden) yeniden çekilir.
  useEffect(() => {
    let cancelled = false;
    fetchReviewFilters()
      .then(data => {
        if (!cancelled) setFilterOptions(data);
      })
      .catch(err => {
        console.error('Filtre seçenekleri alınamadı:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  // Ana veri çekme: filtre/sayfa/sayfa boyutu her değiştiğinde /reviews'a gider.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchReviews(
      {
        country: filters.country || undefined,
        language: filters.language || undefined,
        travelerType: filters.travelerType || undefined,
        sentimentLabel: filters.sentimentLabel || undefined,
        dateRange: filters.dateRange || undefined,
        sort: filters.sort || undefined,
        search: filters.search || undefined,
        page,
        pageSize,
      },
      controller.signal
    )
      .then(data => {
        setItems(data.items);
        setTotal(data.total);
        setTotalPages(Math.max(data.total_pages, 1));
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Yorumlar alınamadı.');
        setItems([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    filters.country,
    filters.language,
    filters.travelerType,
    filters.sentimentLabel,
    filters.dateRange,
    filters.sort,
    filters.search,
    page,
    pageSize,
    refreshSignal,
    reloadToken,
  ]);

  const handleFilterChange = (key: keyof ReviewFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const isFilterActive = useMemo(() => {
    return (
      searchInput !== '' ||
      filters.country !== '' ||
      filters.language !== '' ||
      filters.travelerType !== '' ||
      filters.sentimentLabel !== '' ||
      filters.dateRange !== ''
    );
  }, [searchInput, filters]);

  const pageWindow = useMemo(() => getPageWindow(page, totalPages), [page, totalPages]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="text-lg font-bold text-slate-800">Yorumlar</h4>
          <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">
            {total} Listelendi
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-4">
          {/* Row 1: Search & Clear Button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-grow min-w-[260px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm transition-all outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                placeholder="Yorumlarda veya özetlerde ara..."
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>

            {isFilterActive && (
              <button
                onClick={clearFilters}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-1.5 border border-rose-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Filtreleri Temizle
              </button>
            )}
          </div>

          {/* Row 2: Select Filters */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrele:</span>
            </div>

            {/* Country Filter */}
            <select
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 cursor-pointer"
              value={filters.country}
              onChange={e => handleFilterChange('country', e.target.value)}
            >
              <option value="">Ülke (Tümü)</option>
              {(filterOptions?.countries ?? []).map(c => (
                <option key={c} value={c}>
                  {countryNames[c] || c} ({c})
                </option>
              ))}
            </select>

            {/* Language Filter */}
            <select
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 cursor-pointer"
              value={filters.language}
              onChange={e => handleFilterChange('language', e.target.value)}
            >
              <option value="">Dil (Tümü)</option>
              {(filterOptions?.languages ?? []).map(l => (
                <option key={l} value={l}>
                  {languageNames[l] || l}
                </option>
              ))}
            </select>

            {/* Travel Type Filter */}
            <select
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 cursor-pointer"
              value={filters.travelerType}
              onChange={e => handleFilterChange('travelerType', e.target.value)}
            >
              <option value="">Seyahat Tipi (Tümü)</option>
              {(filterOptions?.traveler_types ?? []).map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Sentiment Filter */}
            <select
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 cursor-pointer"
              value={filters.sentimentLabel}
              onChange={e => handleFilterChange('sentimentLabel', e.target.value)}
            >
              <option value="">Duygu (Tümü)</option>
              {(filterOptions?.sentiment_labels ?? []).map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Date Range Filter */}
            <select
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 cursor-pointer"
              value={filters.dateRange}
              onChange={e => handleFilterChange('dateRange', e.target.value)}
            >
              <option value="">Tarih Aralığı (Tümü)</option>
              {(filterOptions?.date_ranges ?? ['1w', '1m', '3m', '6m', '1y']).map(d => (
                <option key={d} value={d}>
                  {dateRangeLabels[d] || d}
                </option>
              ))}
            </select>

            {/* Sort Filter */}
            <select
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 cursor-pointer ml-auto"
              value={filters.sort}
              onChange={e => handleFilterChange('sort', e.target.value)}
            >
              {(filterOptions?.sort_orders ?? ['date_desc', 'date_asc']).map(s => (
                <option key={s} value={s}>
                  {sortOrderLabels[s] || s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold p-4 rounded-xl flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button
            onClick={() => setReloadToken(t => t + 1)}
            className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors shrink-0"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-4 px-6">Yorum Detayı</th>
              <th className="py-4 px-6 text-center">Dil</th>
              <th className="py-4 px-6 text-center">Ülke</th>
              <th className="py-4 px-6 text-center">Seyahat Tipi</th>
              <th className="py-4 px-6 text-center">Duygu</th>
              <th className="py-4 px-6 text-center">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                  Yükleniyor...
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map(r => (
                <tr
                  key={r.id}
                  onClick={() => onReviewSelect(r.id)}
                  className="hover:bg-slate-50/50 transition-all duration-150 cursor-pointer group"
                >
                  <td className="py-4 px-6 max-w-md">
                    <p className="font-semibold text-slate-800 truncate mb-0.5">{r.review_text}</p>
                    <p className="text-xs text-slate-400 truncate line-clamp-1">
                      {r.summary || 'Özet bulunamadı.'}
                    </p>
                  </td>
                  <td className="py-4 px-6 text-center text-xs font-bold text-slate-500 uppercase">
                    {r.language || '-'}
                  </td>
                  <td className="py-4 px-6 text-center text-xs font-bold text-slate-500">{r.country || '-'}</td>
                  <td className="py-4 px-6 text-center text-xs font-medium text-slate-600">
                    {r.traveler_type || '-'}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold leading-none ${
                        r.sentiment_label ? sentimentStyles[r.sentiment_label] || 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {r.sentiment_label || 'Bilinmiyor'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center text-xs font-medium text-slate-400 whitespace-nowrap">
                    {formatDate(r.review_date)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                  Seçilen filtrelere uyan hiçbir yorum bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs font-medium text-slate-400">
          Toplam <b>{total}</b> yorum arasından {rangeStart}-{rangeEnd} gösteriliyor ({totalPages} sayfa)
        </span>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400">Sayfa Başına:</span>
            <select
              className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none cursor-pointer"
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-150"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {pageWindow.map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150 ${
                    page === p ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' : 'hover:bg-slate-200/50 text-slate-600'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-150"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
