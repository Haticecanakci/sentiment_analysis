import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Calendar, Clock, Building, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { fetchReviewDetail } from '../api/client';
import { ReviewDetail } from '../types';
import { countryNames, languageNames, sentimentStyles } from '../lib/labels';
import { formatDate, formatDateTime } from '../lib/format';

interface ReviewDrawerProps {
  reviewId: number | null;
  onClose: () => void;
}

export default function ReviewDrawer({ reviewId, onClose }: ReviewDrawerProps) {
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reviewId === null) {
      setReview(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setReview(null);

    fetchReviewDetail(reviewId, controller.signal)
      .then(data => setReview(data))
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Yorum detayı alınamadı.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [reviewId]);

  const isOpen = reviewId !== null;
  const hotelLocation = review?.hotel
    ? [review.hotel.city, review.hotel.country ? countryNames[review.hotel.country] || review.hotel.country : null]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900 z-50 cursor-pointer"
          />

          {/* Sliding Drawer Container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[460px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-100"
          >
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Yorum Detayı</h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loading && (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                  <p className="text-xs font-semibold text-slate-400">Yorum detayı yükleniyor...</p>
                </div>
              )}

              {!loading && error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold p-4 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && review && (
                <>
                  {/* Metadata Badges */}
                  <div className="flex flex-wrap gap-2.5 pb-4 border-b border-slate-100">
                    {/* Sentiment Badge */}
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                        review.sentiment_label
                          ? `${sentimentStyles[review.sentiment_label] || 'bg-slate-100 text-slate-700'} border-transparent`
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      {review.sentiment_label || 'Bilinmiyor'}
                    </span>

                    {/* Language Code */}
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-bold border border-slate-100">
                      🌐 {review.language ? languageNames[review.language] || review.language : 'Bilinmiyor'}
                    </span>

                    {/* Country Code */}
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-bold border border-slate-100">
                      📍 {review.country ? `${countryNames[review.country] || review.country} (${review.country})` : 'Bilinmiyor'}
                    </span>

                    {/* Travel Type */}
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100/50">
                      👥 {review.traveler_type || 'Bilinmiyor'}
                    </span>
                  </div>

                  {/* Original Review Text */}
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Orijinal Metin</h3>
                    <div className="relative bg-slate-50 border-l-4 border-indigo-500 p-4 rounded-r-xl">
                      <p className="text-sm font-medium text-slate-700 italic leading-relaxed">
                        "{review.review_text}"
                      </p>
                    </div>
                  </div>

                  {/* AI Generated Summary card */}
                  <div className="bg-gradient-to-br from-indigo-50/50 to-indigo-100/20 p-5 rounded-2xl border border-indigo-100/60 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-100/30 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="text-indigo-600 w-4.5 h-4.5" />
                      <h3 className="text-sm font-bold text-indigo-900">Yapay Zeka Analiz Özeti</h3>
                    </div>
                    <p className="text-xs font-medium text-indigo-950 leading-relaxed">
                      {review.summary || 'Bu yorum için özet üretilememiş.'}
                    </p>
                  </div>

                  {/* Keywords section */}
                  <div className="space-y-2.5">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Anahtar Kelimeler</h3>
                    <div className="flex flex-wrap gap-2">
                      {review.keywords && review.keywords.length > 0 ? (
                        review.keywords.map((k, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200/60 text-slate-600 rounded-lg text-xs font-semibold transition-all cursor-default"
                          >
                            #{k}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">Anahtar kelime bulunamadı</span>
                      )}
                    </div>
                  </div>

                  {/* Technical/Meta Details Card */}
                  <div className="space-y-2.5 pt-4 border-t border-slate-100">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Meta Detaylar</h3>
                    <div className="bg-slate-50/60 rounded-xl border border-slate-100 p-4 space-y-3.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> Yorum Tarihi
                        </span>
                        <span className="text-slate-700 font-bold">{formatDate(review.review_date)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Sisteme Eklenme
                        </span>
                        <span className="text-slate-700 font-bold">{formatDateTime(review.created_at)}</span>
                      </div>
                      <div className="h-px bg-slate-200/50 w-full"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5" /> Otel Adı
                        </span>
                        <span className="text-slate-700 font-bold">{review.hotel?.name || 'Bilinmiyor'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> Konum
                        </span>
                        <span className="text-slate-700 font-bold">{hotelLocation || 'Bilinmiyor'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
