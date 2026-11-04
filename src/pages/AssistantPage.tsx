import { useState, useRef, useEffect } from 'react';
import { Transaction } from '@/types';
import { AssistantMessage } from '@/types/stage2';
import { processQuery, SUGGESTED_QUESTIONS } from '@/utils/assistant';
import { uuidSimple } from '@/utils/uuid';
import { formatINR, formatDate } from '@/utils/format';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/types';
import PageHeader from '@/components/PageHeader';
import { Bot, Send, MessageCircle, Calculator, Lightbulb, Sparkles } from 'lucide-react';

interface AssistantPageProps {
  transactions: Transaction[];
}

export default function AssistantPage({ transactions }: AssistantPageProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && transactions.length > 0) {
      setMessages([{
        id: uuidSimple(),
        role: 'assistant',
        content: `Hello! I'm your RupeeFlow Financial Assistant. I can answer questions about your ${transactions.length} loaded transactions using a local query engine. Ask me about spending by category, income, comparisons, duplicates, largest transactions, and more.`,
      }]);
    }
  }, [transactions.length, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(query?: string) {
    const q = query ?? input.trim();
    if (!q || isProcessing) return;
    setIsProcessing(true);
    setInput('');

    const userMsg: AssistantMessage = { id: uuidSimple(), role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const result = processQuery(q, transactions);
      const assistantMsg: AssistantMessage = {
        id: uuidSimple(),
        role: 'assistant',
        content: result.answer,
        transactions: result.transactions,
        calculation: result.calculation,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsProcessing(false);
    }, 300);
  }

  return (
    <div>
      <PageHeader title="Financial Assistant" subtitle="Ask questions about your finances using a local query engine" icon={<Bot className="w-5 h-5" />} />

      <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-200'
              }`}>
                {msg.role === 'user' ? <MessageCircle className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-slate-600" />}
              </div>
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                <div className={`rounded-xl p-4 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}>
                  <p className="text-sm whitespace-pre-line">{msg.content}</p>
                </div>

                {/* Calculations */}
                {msg.calculation && msg.calculation.length > 0 && (
                  <div className="mt-2 rf-card p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calculator className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supporting Calculations</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {msg.calculation.map((c, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg p-2">
                          <p className="text-xs text-slate-400">{c.label}</p>
                          <p className="text-sm font-semibold text-slate-700">{c.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transaction Records */}
                {msg.transactions && msg.transactions.length > 0 && (
                  <div className="mt-2 rf-card p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supporting Records ({msg.transactions.length})</span>
                    </div>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {msg.transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type === 'credit' ? 'bg-green-500' : 'bg-red-400'}`} />
                            <span className="text-slate-600">{formatDate(t.date)}</span>
                            <span className="text-slate-700 truncate">{t.description}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="rf-badge text-[10px]" style={{ backgroundColor: `${CATEGORY_COLORS[t.category]}15`, color: CATEGORY_COLORS[t.category] }}>
                              {CATEGORY_LABELS[t.category]}
                            </span>
                            <span className={`font-medium ${t.type === 'credit' ? 'text-green-600' : 'text-slate-700'}`}>
                              {t.type === 'credit' ? '+' : '−'}{formatINR(t.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-slate-600" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length <= 1 && transactions.length > 0 && (
          <div className="pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium text-slate-500">Suggested questions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.slice(0, 6).map((q) => (
                <button key={q} onClick={() => handleSend(q)} className="rf-badge bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100 text-xs px-3 py-1.5">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 pt-3 border-t border-slate-200">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your spending, income, categories, duplicates..."
            className="rf-input flex-1"
            disabled={isProcessing}
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || isProcessing} className="rf-btn-primary">
            <Send className="w-4 h-4" /> Send
          </button>
        </div>

        {/* Honest labeling */}
        <div className="mt-2 text-center">
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
            <Sparkles className="w-3 h-3" /> Local query engine · No external AI API configured · Calculations are based on your loaded transaction data
          </span>
        </div>
      </div>
    </div>
  );
}
