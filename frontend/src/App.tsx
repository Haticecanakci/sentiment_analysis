import { useCallback, useEffect, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import KPICards from './components/KPICards';
import AnalyticsCharts from './components/AnalyticsCharts';
import ReviewsTable from './components/ReviewsTable';
import ReviewDrawer from './components/ReviewDrawer';
import CSVImportModal from './components/CSVImportModal';
import { fetchDashboard, fetchHealth } from './api/client';
import { DashboardResponse, ImportResultResponse } from './types';

const HEALTH_POLL_INTERVAL_MS = 30_000;

export default function App() {
  // Dashboard aggregates (KPI cards + charts) — /dashboard
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Live API/DB connectivity — /health
  const [apiConnected, setApiConnected] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  // En son CSV içe aktarım özeti (oturum içi; kalıcı bir "son import" endpoint'i yok)
  const [lastImportSummary, setLastImportSummary] = useState<ImportResultResponse | null>(null);

  // ReviewsTable'a bu sayaç değiştiğinde yeniden veri çekmesini söyler (import sonrası)
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);

  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [isCSVOpen, setIsCSVOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await fetchDashboard();
      setDashboard(data);
    } catch (err) {
      console.error(err);
      setDashboardError(err instanceof Error ? err.message : 'Dashboard verisi alınamadı.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // /health periyodik kontrolü: Header'daki "API: Bağlı • DB: Bağlı" göstergesi
  // artık sabit değer değil, gerçek backend durumunu yansıtır.
  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      try {
        const health = await fetchHealth();
        if (cancelled) return;
        setApiConnected(health.status === 'ok');
        setDbConnected(health.database === 'connected');
      } catch {
        if (cancelled) return;
        setApiConnected(false);
        setDbConnected(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, HEALTH_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleImportSuccess = (summary: ImportResultResponse) => {
    setLastImportSummary(summary);
    loadDashboard();
    setReviewsRefreshKey(prev => prev + 1);
  };

  return (
    <div className="bg-[#f8fafc] text-slate-700 min-h-screen flex font-sans antialiased selection:bg-indigo-50 selection:text-indigo-600">

      {/* 1. Sidebar Navigation */}
      <Sidebar />

      {/* Mobile Sidebar overlay and container */}
      {isMobileMenuOpen && (
        <>
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 z-50 md:hidden"
          />
          <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-50 shadow-2xl p-6 flex flex-col md:hidden">
            <Sidebar />
          </div>
        </>
      )}

      {/* 2. Main Work Area */}
      <main className="flex-1 ml-0 md:ml-[280px] flex flex-col min-h-screen max-w-full overflow-hidden">

        {/* Top Navbar */}
        <Header
          onMenuToggle={() => setIsMobileMenuOpen(prev => !prev)}
          apiConnected={apiConnected}
          dbConnected={dbConnected}
        />

        {/* Dashboard Panels Scroll container */}
        <div className="p-6 space-y-8 overflow-y-auto max-w-[1400px] mx-auto w-full">

          {/* Section 1: Actions & Veri Aktarımı Summary bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Veri Aktarımı</h3>
              {lastImportSummary ? (
                <p className="text-xs font-semibold text-slate-400">
                  Toplam <span className="text-slate-600 font-bold">{lastImportSummary.total_rows}</span> • İçe aktarılan{' '}
                  <span className="text-emerald-600 font-bold">{lastImportSummary.imported}</span> • Atlanan{' '}
                  <span className="text-amber-600 font-bold">{lastImportSummary.skipped}</span> • Tekrar{' '}
                  <span className="text-slate-500 font-bold">{lastImportSummary.duplicates}</span> • Analiz hatası{' '}
                  <span className="text-rose-500 font-bold">{lastImportSummary.enrichment_failed}</span>
                </p>
              ) : (
                <p className="text-xs font-semibold text-slate-400">Bu oturumda henüz CSV içe aktarımı yapılmadı.</p>
              )}
            </div>

            <button
              onClick={() => setIsCSVOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shadow-indigo-100 active:scale-95 duration-150 shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>CSV İçe Aktar</span>
            </button>
          </div>

          {dashboardError && (
            <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold p-4 rounded-2xl flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {dashboardError}
              </span>
              <button
                onClick={loadDashboard}
                className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors shrink-0"
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {/* Section 2: KPI Dynamic Cards */}
          <KPICards dashboard={dashboard} loading={dashboardLoading} />

          {/* Section 3: Graphical Visual Charts Row */}
          <AnalyticsCharts dashboard={dashboard} loading={dashboardLoading} />

          {/* Section 4: Data list Table with filters */}
          <ReviewsTable refreshSignal={reviewsRefreshKey} onReviewSelect={setSelectedReviewId} />
        </div>
      </main>

      {/* 3. Sliding Detail Drawer */}
      <ReviewDrawer reviewId={selectedReviewId} onClose={() => setSelectedReviewId(null)} />

      {/* 4. Interactive Dialog Modals */}
      <CSVImportModal
        isOpen={isCSVOpen}
        onClose={() => setIsCSVOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
