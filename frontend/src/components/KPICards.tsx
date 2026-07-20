import { MessageSquare, Languages, Globe, Users } from 'lucide-react';
import { DashboardResponse } from '../types';
import { countryNames, languageNames } from '../lib/labels';

interface KPICardsProps {
  dashboard: DashboardResponse | null;
  loading: boolean;
}

export default function KPICards({ dashboard, loading }: KPICardsProps) {
  const topLanguage = dashboard?.most_common_language ?? null;
  const topCountry = dashboard?.top_countries?.[0] ?? null;
  const topFamilyCountry = dashboard?.top_family_country ?? null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* KPI 1: Toplam Yorum */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
          <h4 className="text-sm font-semibold text-slate-500">Toplam Yorum</h4>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-slate-800">
            {loading ? '…' : dashboard?.total_reviews ?? 0}
          </span>
        </div>
      </div>

      {/* KPI 2: En Yaygın Dil */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
          <h4 className="text-sm font-semibold text-slate-500">En Yaygın Dil</h4>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Languages className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-xl font-bold text-slate-800 truncate max-w-[150px]" title={topLanguage?.value}>
            {loading ? '…' : topLanguage ? languageNames[topLanguage.value] || topLanguage.value : '-'}
          </span>
          {!loading && topLanguage && (
            <span className="text-sm font-semibold text-slate-400 mb-0.5">{topLanguage.count} yorum</span>
          )}
        </div>
      </div>

      {/* KPI 3: En Çok Yorum Gelen Ülke */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
          <h4 className="text-sm font-semibold text-slate-500">En Çok Yorum Ülkesi</h4>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-slate-800" title={topCountry ? countryNames[topCountry.value] : undefined}>
            {loading ? '…' : topCountry?.value ?? '-'}
          </span>
          {!loading && topCountry && (
            <span className="text-sm font-semibold text-slate-400 mb-1">{topCountry.count} adet</span>
          )}
        </div>
      </div>

      {/* KPI 4: Aile Tipinde Lider Ülke */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
          <h4 className="text-sm font-semibold text-slate-500">Aile Tipinde Lider Ülke</h4>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end gap-3">
          <span
            className="text-3xl font-bold text-slate-800"
            title={topFamilyCountry ? countryNames[topFamilyCountry.value] : undefined}
          >
            {loading ? '…' : topFamilyCountry?.value ?? '-'}
          </span>
          {!loading && topFamilyCountry && (
            <span className="text-sm font-semibold text-slate-400 mb-1">{topFamilyCountry.count} aile</span>
          )}
        </div>
      </div>
    </div>
  );
}
