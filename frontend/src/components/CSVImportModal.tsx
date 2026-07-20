import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { importReviewsCsv } from '../api/client';
import { ImportResultResponse } from '../types';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (summary: ImportResultResponse) => void;
}

export default function CSVImportModal({ isOpen, onClose, onImportSuccess }: CSVImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [summary, setSummary] = useState<ImportResultResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus('error');
      setErrorMessage('Lütfen geçerli bir .csv dosyası yükleyin.');
      return;
    }

    setStatus('uploading');
    setErrorMessage('');

    try {
      // Gerçek backend endpoint'i: dosya yüklenir, dil tespiti + Gemini
      // zenginleştirme sunucuda çalışır ve doğrudan veritabanına yazılır.
      const result = await importReviewsCsv(file);
      setSummary(result);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'İçe aktarım sırasında beklenmeyen bir hata oluştu.');
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleClose = () => {
    if (status === 'success' && summary) {
      onImportSuccess(summary);
    }
    onClose();
    setStatus('idle');
    setSummary(null);
    setErrorMessage('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={status === 'uploading' ? undefined : handleClose}
            className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center p-4"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="fixed inset-0 m-auto max-w-lg h-fit bg-white rounded-3xl p-6 shadow-2xl z-50 border border-slate-100 flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">CSV Veri İçe Aktarımı</h3>
              <button
                onClick={handleClose}
                disabled={status === 'uploading'}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content / Body */}
            {status === 'idle' && (
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileSelect}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/40 scale-[0.99]'
                      : 'border-slate-200 hover:border-indigo-400 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">
                    CSV dosyasını buraya sürükleyin veya tıklayın
                  </h4>
                  <p className="text-xs font-semibold text-slate-400">
                    Sadece .csv uzantılı dosyalar kabul edilmektedir
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100 space-y-2 text-xs">
                  <span className="font-bold text-slate-700">Beklenen Format:</span>
                  <p className="font-semibold text-slate-400 leading-relaxed">
                    Zorunlu sütunlar: <code className="text-indigo-600 font-mono text-[10px] bg-indigo-50 px-1 py-0.5 rounded">review_id, text</code>.
                    İsteğe bağlı <code className="text-indigo-600 font-mono text-[10px] bg-indigo-50 px-1 py-0.5 rounded">date</code> (YYYY-MM-DD) sütunu da desteklenir.
                  </p>
                  <p className="font-semibold text-slate-400">
                    Dil, ülke, seyahat tipi, duygu ve anahtar kelimeler sunucu tarafında otomatik olarak analiz edilir.
                  </p>
                </div>
              </div>
            )}

            {status === 'uploading' && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <h4 className="text-sm font-bold text-slate-700 mb-1">Yorumlar Analiz Ediliyor</h4>
                <p className="text-xs font-semibold text-slate-400 max-w-xs leading-relaxed">
                  Dosya sunucuya yüklendi; dil tespiti ve yapay zeka zenginleştirmesi sürüyor. Yorum sayısına göre bu işlem biraz sürebilir.
                </p>
              </div>
            )}

            {status === 'success' && summary && (
              <div className="space-y-5">
                <div className="bg-emerald-50 rounded-2xl p-5 flex items-start gap-4 border border-emerald-100">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900 mb-1">İçe Aktarım Tamamlandı</h4>
                    <p className="text-xs font-semibold text-emerald-700">
                      Dosyanız işlendi ve sonuçlar veritabanına kaydedildi.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400">Toplam Satır</p>
                    <p className="text-lg font-extrabold text-slate-800">{summary.total_rows}</p>
                  </div>
                  <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <p className="text-[11px] font-semibold text-emerald-600">İçe Aktarılan</p>
                    <p className="text-lg font-extrabold text-emerald-700">{summary.imported}</p>
                  </div>
                  <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-100">
                    <p className="text-[11px] font-semibold text-amber-600">Atlanan</p>
                    <p className="text-lg font-extrabold text-amber-700">{summary.skipped}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400">Tekrar Eden</p>
                    <p className="text-lg font-extrabold text-slate-800">{summary.duplicates}</p>
                  </div>
                  <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-100 col-span-2">
                    <p className="text-[11px] font-semibold text-rose-600">Analiz Hatası (zenginleştirme başarısız)</p>
                    <p className="text-lg font-extrabold text-rose-700">{summary.enrichment_failed}</p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-3">
                  <button
                    onClick={handleClose}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm shadow-indigo-100"
                  >
                    Tamamlandı
                  </button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="bg-rose-50 rounded-2xl p-5 flex items-start gap-4 border border-rose-100">
                  <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900 mb-1">Hata Oluştu</h4>
                    <p className="text-xs font-semibold text-rose-700">{errorMessage}</p>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => setStatus('idle')}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm shadow-indigo-100"
                  >
                    Yeniden Dene
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
