// Sunum amaçlı etiket sözlükleri (gerçek veri değil, yalnızca ISO kod →
// okunabilir isim eşlemesi). Backend'in döndürdüğü kodda olup burada
// karşılığı olmayan değerler bileşenlerde `map[code] || code` deseniyle
// ham koduyla gösterilir.

export const countryNames: { [key: string]: string } = {
  TR: 'Türkiye',
  DE: 'Almanya',
  GB: 'İngiltere',
  RU: 'Rusya',
  FR: 'Fransa',
  US: 'ABD',
  ES: 'İspanya',
  IT: 'İtalya',
  NL: 'Hollanda',
  PL: 'Polonya',
};

export const languageNames: { [key: string]: string } = {
  tr: 'Türkçe (tr)',
  de: 'Almanca (de)',
  en: 'İngilizce (en)',
  ru: 'Rusça (ru)',
  fr: 'Fransızca (fr)',
  es: 'İspanyolca (es)',
  it: 'İtalyanca (it)',
  nl: 'Hollandaca (nl)',
  pl: 'Lehçe (pl)',
  unknown: 'Bilinmiyor',
};

export const dateRangeLabels: { [key: string]: string } = {
  '1w': 'Son 1 Hafta',
  '1m': 'Son 1 Ay',
  '3m': 'Son 3 Ay',
  '6m': 'Son 6 Ay',
  '1y': 'Son 1 Yıl',
};

export const sortOrderLabels: { [key: string]: string } = {
  date_desc: 'Sıralama (Yeni → Eski)',
  date_asc: 'Sıralama (Eski → Yeni)',
};

export const sentimentStyles: { [key: string]: string } = {
  Pozitif: 'bg-emerald-50 text-emerald-700',
  Nötr: 'bg-slate-100 text-slate-700',
  Negatif: 'bg-rose-50 text-rose-700',
};

export const sentimentDotColors: { [key: string]: string } = {
  Pozitif: '#10b981',
  Nötr: '#64748b',
  Negatif: '#f43f5e',
};
