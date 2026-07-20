import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardResponse } from '../types';
import { sentimentDotColors } from '../lib/labels';

// Uygulamanın vurgu rengi (bkz. Tailwind indigo-600) — tek serili bar
// grafiklerinde tüm barlar aynı slotu (kimlik yerine marka rengini) taşır.
const ACCENT_COLOR = '#4f46e5';

const tooltipStyle = { borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 };

interface AnalyticsChartsProps {
  dashboard: DashboardResponse | null;
  loading: boolean;
}

export default function AnalyticsCharts({ dashboard, loading }: AnalyticsChartsProps) {
  // --- DUYGU DAĞILIMI (Donut) ---
  const sentimentItems = dashboard?.sentiment_distribution ?? [];
  const sentimentTotal = sentimentItems.reduce((sum, item) => sum + item.count, 0);

  // Halkanın matematiğini (dilim açıları, boşluklar, yuvarlatma) recharts
  // hesaplıyor; elle strokeDasharray/offset hesaplamak dilimler arasında
  // görünür boşluklara/örtüşmelere yol açıyordu.
  const sentimentSlices = sentimentItems
    .filter(item => item.count > 0)
    .map(item => ({
      ...item,
      pct: sentimentTotal > 0 ? (item.count / sentimentTotal) * 100 : 0,
      color: sentimentDotColors[item.value] ?? '#94a3b8',
    }));
  const hasMultipleSlices = sentimentSlices.length > 1;

  // --- SEYAHAT TİPİ DAĞILIMI (Dikey barlar) ---
  const travelerItems = dashboard?.traveler_type_distribution ?? [];

  // --- EN ÇOK YORUM GELEN ÜLKELER (Yatay barlar) ---
  const topCountries = (dashboard?.top_countries ?? []).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Duygu Dağılımı Donut Chart */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-all duration-300">
        <h4 className="text-sm font-semibold text-slate-700 mb-6">Duygu Dağılımı</h4>
        <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
          {loading ? (
            <div className="text-sm text-slate-400 font-medium">Yükleniyor...</div>
          ) : sentimentTotal > 0 ? (
            <>
              <div className="w-44 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentSlices}
                      dataKey="count"
                      nameKey="value"
                      cx="50%"
                      cy="50%"
                      startAngle={90}
                      endAngle={-270}
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={hasMultipleSlices ? 3 : 0}
                      cornerRadius={hasMultipleSlices ? 4 : 0}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {sentimentSlices.map(slice => (
                        <Cell key={slice.value} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} yorum`, name]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold text-slate-800">{sentimentTotal}</span>
                <span className="text-xs font-semibold text-slate-400">Toplam</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400 font-medium">Veri bulunamadı</div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          {sentimentSlices.map(slice => (
            <div key={slice.value} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }}></span>
              <span className="text-xs font-medium text-slate-600">
                {slice.value} ({slice.count} yorum • {Math.round(slice.pct)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Seyahat Tipi Dağılımı (Vertical Bars) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
        <h4 className="text-sm font-semibold text-slate-700 mb-6">Seyahat Tipi Dağılımı</h4>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-slate-400 font-medium">
            Yükleniyor...
          </div>
        ) : travelerItems.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={travelerItems} margin={{ top: 16, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#e1e0d9" />
              <XAxis
                dataKey="value"
                tickLine={false}
                axisLine={{ stroke: '#e1e0d9' }}
                tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                interval={0}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                cursor={{ fill: 'rgba(79,70,229,0.06)' }}
                formatter={(value: number) => [`${value} yorum`, 'Yorum Sayısı']}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="count" fill={ACCENT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-slate-400 font-medium">
            Veri bulunamadı
          </div>
        )}
      </div>

      {/* 3. En Çok Yorum Gelen Ülkeler (Horizontal Progress Bars) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
        <h4 className="text-sm font-semibold text-slate-700 mb-6">En Çok Yorum Gelen Ülkeler</h4>
        {loading ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-slate-400 font-medium">
            Yükleniyor...
          </div>
        ) : topCountries.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topCountries} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }} barCategoryGap="30%">
              <CartesianGrid horizontal={false} stroke="#e1e0d9" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="value"
                tickLine={false}
                axisLine={false}
                width={36}
                tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                tickFormatter={(value: string) => (value === 'UNKNOWN' ? 'UNK' : value)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(79,70,229,0.06)' }}
                formatter={(value: number) => [`${value} yorum`, 'Yorum Sayısı']}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="count" fill={ACCENT_COLOR} radius={[0, 4, 4, 0]} maxBarSize={18}>
                <LabelList
                  dataKey="count"
                  position="right"
                  formatter={(value: number) => `${value} yorum`}
                  style={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-sm text-slate-400 font-medium">
            Veri bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}
