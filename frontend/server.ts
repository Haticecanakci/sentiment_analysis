import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Initialize Gemini Client Lazily (avoids crash if key is missing on startup)
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for Gemini operations');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 1. Endpoint: Analyze a Single Review with Gemini
app.post('/api/analyze', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text field is required' });
  }

  try {
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Lütfen aşağıdaki otel misafir yorumunu analiz et. Analiz sonucunda şu bilgileri çıkar:
1. Duygu Durumu (Sentiment): Sadece "Pozitif", "Nötr" veya "Negatif" değerlerinden birini seç.
2. Dil Kodu (Language): Yorumun orijinal dil kodu (örn: "tr", "en", "de", "ru", "fr").
3. Türkçe Özet (Summary): Yorumun Türkçe dilinde yazılmış, 1-2 cümlelik nesnel ve profesyonel bir özetini çıkar.
4. Anahtar Kelimeler (Keywords): Yorumdan çıkarılan en önemli 3-4 adet Türkçe anahtar kelimeyi bir liste olarak ver.

Yorum metni: "${text}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: {
              type: Type.STRING,
              description: 'Must be exactly: "Pozitif", "Nötr", or "Negatif"'
            },
            language: {
              type: Type.STRING,
              description: 'MIME language code like tr, en, de, ru, fr'
            },
            summary: {
              type: Type.STRING,
              description: 'Concise summary of the comment written in Turkish'
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of 3-4 Turkish keyword tags extracted from the text'
            }
          },
          required: ['sentiment', 'language', 'summary', 'keywords']
        }
      }
    });

    const outputText = response.text?.trim() || '{}';
    const analysisResult = JSON.parse(outputText);
    res.json(analysisResult);
  } catch (err: any) {
    console.error('Gemini Analyze API Error:', err.message);
    res.status(500).json({ error: err.message || 'Gemini Analizi sırasında hata oluştu' });
  }
});

// 2. Endpoint: Generate Executive Strategic Report from Review dataset
app.post('/api/report', async (req, res) => {
  const { focusArea, reviews } = req.body;
  if (!reviews || !Array.isArray(reviews)) {
    return res.status(400).json({ error: 'Reviews array is required' });
  }

  try {
    const ai = getGeminiClient();

    const focusMapping: { [key: string]: string } = {
      general: 'Genel Otel Durum Analizi (Genel memnuniyet, güçlü ve zayıf yanlar)',
      service: 'Hizmet ve Personel (Resepsiyon hızı, temizlik kalitesi, personel misafirperverliği)',
      food: 'Yemek ve Mutfak Kalitesi (Çeşitlilik, yemek sıcaklığı, bar kokteylleri ve lezzet)',
      facilities: 'Aktivite ve Tesisler (Havuz hijyeni, özel plaj konforu, spa hizmetleri ve gürültü/müzik kontrolü)'
    };

    const focusText = focusMapping[focusArea] || focusMapping.general;

    const datasetStr = reviews.map((r, i) => `Yorum ${i+1} (${r.travelType}, ${r.sentiment}): "${r.text}"`).join('\n');

    const prompt = `Aşağıda, Grand Anatolia Resort oteline ait misafir yorumları verilmiştir. 
Lütfen bu verileri analiz ederek otel yöneticileri için stratejik bir analiz raporu hazırla. 
Raporun odak alanı: "${focusText}" olmalıdır.

Aşağıdaki şemaya tam uyacak şekilde bir JSON yanıtı döndür:
1. focus: Raporun odak başlığı (Türkçe).
2. overallSummary: Otel için çıkarılan stratejik durumu anlatan 2-3 cümlelik Türkçe yönetici özeti.
3. strengths: Müşteri memnuniyetini sağlayan en güçlü 3 yön (Türkçe cümleler listesi).
4. weaknesses: Geliştirilmesi gereken ve eleştirilen en önemli 3 zayıf yön (Türkçe cümleler listesi).
5. recommendations: Otel yönetimi için yapay zeka tarafından hazırlanan somut aksiyon planları ve 3 adet stratejik tavsiye (Türkçe cümleler listesi).

Misafir Yorumları Veri Kümesi:
${datasetStr}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            focus: { type: Type.STRING },
            overallSummary: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['focus', 'overallSummary', 'strengths', 'weaknesses', 'recommendations']
        }
      }
    });

    const outputText = response.text?.trim() || '{}';
    const reportResult = JSON.parse(outputText);
    res.json({ report: reportResult });
  } catch (err: any) {
    console.error('Gemini Report API Error:', err.message);
    res.status(500).json({ error: err.message || 'Gemini Raporu derleme sırasında hata oluştu' });
  }
});

// Start server and handle Vite Middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OK] Server running on http://localhost:${PORT}`);
  });
}

startServer();
