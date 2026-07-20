import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, X, Send, Upload, Loader2, Bot, AlertCircle } from 'lucide-react';
import { sendChatMessage } from '../api/client';
import { ChatHistoryItem } from '../types';

// Sohbet widget'i için görüntülenen tek mesaj. 'error' rolü yalnızca UI
// içindir; backend'e gönderilecek geçmişe dahil edilmez (types.ts'teki
// ChatHistoryItem yalnızca 'user'/'assistant' kabul eder).
interface DisplayMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

interface ChatWidgetProps {
  onOpenCSVImport: () => void;
}

// Backend ChatRequest.history alanı en fazla 20 tur kabul eder (chat.py).
const MAX_HISTORY_TURNS = 20;

export default function ChatWidget({ onOpenCSVImport }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  // "CSV İçe Aktar" tool'u: Gemini'ye gitmez, doğrudan mevcut import
  // modalını açar (App.tsx'teki isCSVOpen state'i üzerinden).
  const handleImportClick = () => {
    onOpenCSVImport();
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: 'CSV içe aktarma penceresini açtım; dosyanı oradan yükleyebilirsin.' },
    ]);
  };

  // Normal metin gönderimi: buraya düşen her şey normal Gemini sohbetine gider.
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const history: ChatHistoryItem[] = messages
      .filter((m): m is DisplayMessage & { role: 'user' | 'assistant' } => m.role !== 'error')
      .slice(-MAX_HISTORY_TURNS)
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsSending(true);
    try {
      const { reply, action } = await sendChatMessage(text, history);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      // Gemini'nin import_csv function call'ını tetiklediği durum: buton ile
      // aynı sonuca gider, mevcut CSVImportModal'ı açar.
      if (action === 'import_csv') {
        onOpenCSVImport();
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: err instanceof Error ? err.message : 'Sohbet yanıtı alınamadı.' },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 flex items-center justify-center transition-all active:scale-95"
        aria-label={isOpen ? 'Sohbeti kapat' : 'Asistanı aç'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="fixed bottom-24 right-6 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Asistan</h3>
                <p className="text-[11px] font-semibold text-slate-400">Panel hakkında sor ya da CSV içe aktar</p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                    <Bot className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                    Merhaba! Yorumlar, oteller veya dashboard hakkında soru sorabilir; ya da aşağıdaki
                    butonla CSV içe aktarabilirsin.
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'error' ? (
                    <div className="max-w-[85%] bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold px-3.5 py-2.5 rounded-2xl flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{m.content}</span>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-md'
                      }`}
                    >
                      {m.content}
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-100 text-slate-400 px-3.5 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs font-semibold">Yazıyor...</span>
                  </div>
                </div>
              )}
            </div>

            {/* CSV tool: Gemini'ye gitmez, mevcut import modalını açar */}
            <div className="px-4 pt-2 shrink-0">
              <button
                onClick={handleImportClick}
                className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                CSV İçe Aktar
              </button>
            </div>

            {/* Metin girişi: normal Gemini sohbeti buradan devam eder */}
            <div className="p-4 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                placeholder="Bir mesaj yaz..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm transition-all outline-none text-slate-700 placeholder:text-slate-400 font-medium disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition-colors"
                aria-label="Gönder"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
