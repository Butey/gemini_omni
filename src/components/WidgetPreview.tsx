import React, { useState, useEffect } from 'react';
import { Send, Bot, User, CornerDownRight, Sparkles, Copy, ThumbsUp, ThumbsDown, Brain, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Suggestion } from '../types';

export function WidgetUI({ darkMode, t }: { darkMode: boolean, t: any }) {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'ai' | 'user', text: string, suggestions?: Suggestion[] }[]>([]);

  // Messaging Bridge: Send content to Omnidesk Parent
  const applyDraft = (text: string) => {
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({
        type: 'OMNIDESK_INJECT_RESPONSE',
        content: text
      }, '*');
      
      // Visual feedback
      const btn = document.activeElement as HTMLElement;
      if (btn) {
        const originalText = btn.innerText;
        btn.innerText = t.language === 'ru' ? 'Применено!' : 'Applied!';
        setTimeout(() => { btn.innerText = originalText; }, 2000);
      }
    }
  };

  const handleSend = async (manualText?: string) => {
    const messageText = manualText || input;
    if (!messageText.trim() && !manualText) return;

    if (!manualText) {
      setChatHistory(prev => [...prev, { role: 'user', text: messageText }]);
      setInput('');
    }

    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketContext: {
            id: 'OMNIDESK_ACTIVE_TICKET',
            description: "Context fetched from active Omnidesk ticket..."
          },
          history: chatHistory.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })),
          userQuery: messageText
        })
      });
      const data = await response.json();
      
      setChatHistory(prev => [...prev, { 
        role: 'ai', 
        text: data.reply || (t.language === 'ru' ? 'Вот мои рекомендации по этому тикету:' : 'Here are my recommendations for this ticket:'),
        suggestions: data.suggestions || []
      }]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial greeting/analysis
    if (chatHistory.length === 0) {
      handleSend(t.language === 'ru' ? 'Проанализируй этот тикет' : 'Analyze this ticket');
    }
  }, []);

  return (
    <div className={`h-[calc(100vh-2rem)] p-6 rounded-[2rem] border transition-all flex flex-col ${darkMode ? 'border-indigo-500/30 bg-indigo-500/5 backdrop-blur-xl' : 'border-indigo-100 bg-white shadow-2xl shadow-indigo-500/10'}`}>
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                <Brain className="w-5 h-5 text-white" />
             </div>
             <div>
                <h3 className={`font-black text-lg italic tracking-tight leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t.ai_assistant}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                   <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Active Sync</span>
                </div>
             </div>
          </div>
          <button className={`p-2.5 rounded-xl border transition-colors ${darkMode ? 'border-white/10 hover:bg-white/5 text-slate-400' : 'border-slate-100 hover:bg-slate-50 text-slate-500'}`}>
             <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 mb-6">
          <AnimatePresence>
            {chatHistory.map((msg, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={i} 
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[85%] p-5 rounded-[2rem] text-sm font-bold leading-relaxed ${
                  msg.role === 'user' 
                    ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20')
                    : (darkMode ? 'bg-white/5 border border-white/10 text-slate-200' : 'bg-slate-50 border border-slate-100 text-slate-900')
                }`}>
                  {msg.text}
                </div>
                
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-4 w-full space-y-3">
                    {msg.suggestions.map((s, si) => (
                      <div 
                        key={si}
                        className={`p-4 rounded-2xl border transition-all ${darkMode ? 'bg-black/40 border-white/10 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-500/50 shadow-sm'}`}
                      >
                         <div className="flex items-center justify-between mb-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">{s.type}</span>
                            <span className="text-[9px] font-bold text-slate-500 opacity-50">{s.confidence}% Match</span>
                         </div>
                         <p className={`text-xs font-bold leading-relaxed mb-4 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{s.text}</p>
                         <button 
                           onClick={() => applyDraft(s.text)}
                           className="w-full py-2.5 bg-indigo-600/10 hover:bg-indigo-600 hover:text-white border border-indigo-500/20 text-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                         >
                           {t.language === 'ru' ? 'Вставить в ответ' : 'Insert into Response'}
                         </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex gap-2 p-4">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
            </div>
          )}
        </div>

        <div className="shrink-0 relative">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.language === 'ru' ? 'Спросить ИИ...' : 'Ask AI...'}
            className={`w-full p-5 pr-14 rounded-2xl border outline-none transition-all font-bold text-sm ${
              darkMode 
                ? 'bg-black/40 border-white/10 focus:border-indigo-500/50 text-white placeholder:text-slate-600' 
                : 'bg-slate-50 border-slate-200 focus:border-indigo-500/50 text-slate-900 placeholder:text-slate-400'
            }`}
          />
          <button 
            onClick={() => handleSend()}
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
    </div>
  );
}

export default function WidgetPreview({ darkMode, t }: { darkMode: boolean, t: any }) {
  const [messages, setMessages] = useState([
    { role: 'user', text: t.language === 'ru' ? 'Здравствуйте! Пытаюсь войти в свой аккаунт, но кнопка "Войти" не нажимается. Пробовал в разных браузерах.' : 'Hello! I am trying to log in but the "Login" button is not responding. I have tried multiple browsers.' },
    { role: 'agent', text: t.language === 'ru' ? 'Добрый день! Пожалуйста, очистите кэш вашего браузера и попробуйте еще раз.' : 'Good day! Please clear your browser cache and try again.' },
    { role: 'user', text: t.language === 'ru' ? 'Кэш очистил, проблема осталась. Также не вижу ссылку на сброс пароля.' : "Cleared the cache, but the problem persists. Also, I don't see the reset password link." },
  ]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketContext: {
            id: '#4820',
            subject: 'Login Button Unresponsive',
            status: 'Open',
            priority: 'High',
            description: messages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')
          },
          history: messages
        })
      });
      const data = await response.json();
      setSuggestions(data.suggestions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-10 min-h-[calc(100vh-14rem)] h-auto xl:h-[calc(100vh-14rem)]">
      {/* Mock Omnidesk Ticket Surface */}
      <div className={`flex-1 p-10 rounded-[2.5rem] border transition-all flex flex-col ${darkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-2xl shadow-slate-200/50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100 shadow-sm'}`}>
              <User className="w-7 h-7 text-indigo-500" />
            </div>
            <div>
               <h3 className={`font-black text-2xl italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                 {t.language === 'ru' ? 'Проблема с кнопкой входа' : 'Login Button Unresponsive'}
               </h3>
               <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Ticket #4820</span>
                  <span className="w-1 h-1 bg-slate-500 rounded-full opacity-30" />
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">isbuteev@gmail.com</span>
                  <span className="w-1 h-1 bg-slate-500 rounded-full opacity-30" />
                  <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Status: Open</span>
               </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className={`px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm'}`}>Tech Support</div>
             <div className={`px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>High Priority</div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-8 mb-8 pr-4 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-6 ${msg.role === 'agent' ? 'flex-row-reverse' : ''}`}>
               <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border ${msg.role === 'agent' ? (darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600') : (darkMode ? 'bg-slate-800 border-white/5 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}`}>
                  {msg.role === 'agent' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
               </div>
               <div className={`flex-1 p-6 rounded-3xl border transition-all ${msg.role === 'agent' ? (darkMode ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-indigo-50/30 border-indigo-100/50') : (darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-100')}`}>
                  <div className="flex items-center justify-between mb-3">
                     <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{msg.role === 'agent' ? 'Support Agent' : 'Customer Account'}</span>
                     <span className="text-[9px] font-bold text-slate-500 opacity-50">12:45 PM</span>
                  </div>
                  <p className={`text-sm font-bold leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>{msg.text}</p>
               </div>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col gap-6">
          <div className={`p-6 rounded-3xl border transition-all ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100 shadow-inner'}`}>
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-1">Draft Internal Response</div>
             <div className="flex gap-4">
                <textarea 
                  className={`flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed font-bold ${darkMode ? 'text-slate-300 placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'}`}
                  placeholder={t.language === 'ru' ? 'Напишите сообщение клиенту...' : 'Write message to customer...'}
                  rows={2}
                />
                <div className="flex flex-col gap-2">
                   <button className="p-4 bg-indigo-600 rounded-2xl text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30 active:scale-95">
                      <Send className="w-5 h-5" />
                   </button>
                </div>
             </div>
          </div>

          <button 
            onClick={generateSuggestions}
            disabled={loading}
            className="w-full py-5 bg-indigo-600/10 hover:bg-indigo-500 hover:text-white border border-indigo-500/20 text-indigo-400 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-all uppercase tracking-[0.2em] active:scale-95 disabled:opacity-50"
          >
            {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full" /> : <Sparkles className="w-5 h-5" />}
            {t.generate_rec}
          </button>
          <div className="text-[9px] font-bold text-slate-500 text-center opacity-40 uppercase tracking-[0.1em]">
            Tip: AI suggestions can be directly injected into the reply box
          </div>
        </div>
      </div>

      {/* Widget UI */}
      <div className={`w-full xl:w-[400px] rounded-[3rem] border transition-all flex flex-col overflow-hidden backdrop-blur-2xl shadow-2xl ${darkMode ? 'border-white/10 bg-black/60 shadow-indigo-500/10' : 'border-slate-200 bg-white shadow-slate-200/50'}`}>
        <div className="p-6 bg-indigo-600 text-white flex items-center gap-4 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/50 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner relative z-10">
            <Bot className="w-6 h-6" />
          </div>
          <div className="flex flex-col relative z-10">
            <span className="font-black text-sm tracking-tight">OmniAI Assistant</span>
            <span className="text-[9px] opacity-70 uppercase tracking-[0.2em] font-black">Model v3.5-flash</span>
          </div>
          <div className="ml-auto relative z-10">
             <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence mode="popLayout">
            {suggestions.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-10">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-8 border-2 ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100 shadow-xl shadow-slate-200/50'}`}>
                  <Sparkles className={`w-10 h-10 ${darkMode ? 'text-indigo-500/20' : 'text-indigo-600/30'}`} />
                </div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500 opacity-60">Scanning Knowledge Base...</p>
              </div>
            )}

            {loading && (
              <div className="space-y-6">
                {[1,2,3].map(i => (
                  <div key={i} className={`animate-pulse h-32 rounded-3xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`} />
                ))}
              </div>
            )}

            {suggestions.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-6 rounded-[1.5rem] border transition-all cursor-pointer group relative overflow-hidden ${darkMode ? 'border-white/10 bg-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/30' : 'border-slate-100 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-500/20 shadow-sm'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">Recommendation #{i+1}</span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className={`p-2 rounded-lg text-[9px] font-black flex items-center gap-1.5 transition-all ${darkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-white shadow-sm text-slate-500 border border-slate-200'}`}><Copy className="w-3 h-3" /> COPY</button>
                  </div>
                </div>
                <p className={`text-xs leading-relaxed mb-6 font-bold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                  {s.text}
                </p>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${darkMode ? 'bg-white/5 border-white/5 text-slate-500' : 'bg-white border-slate-100 text-slate-400 shadow-sm'}`}>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    {Math.round(s.confidence * 100)}% Reliable
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    <button className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10 text-slate-500 hover:text-emerald-400' : 'hover:bg-white text-slate-400 hover:text-emerald-500 shadow-sm'}`}><ThumbsUp className="w-4 h-4" /></button>
                    <button className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10 text-slate-500 hover:text-red-400' : 'hover:bg-white text-slate-400 hover:text-red-500 shadow-sm'}`}><ThumbsDown className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="absolute left-0 bottom-0 top-0 w-1 bg-indigo-600 opacity-30" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className={`p-6 border-t ${darkMode ? 'border-white/10 bg-black/40' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className={`flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all focus-within:border-indigo-500/50 ${darkMode ? 'bg-black/40 border-white/10' : 'bg-white border-slate-200 shadow-inner'}`}>
            <input 
              type="text" 
              placeholder="Ask OmniAI specific detail..." 
              className={`flex-1 bg-transparent border-none outline-none text-xs font-bold ${darkMode ? 'text-slate-300 placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'}`}
            />
            <button className="p-2 bg-indigo-600 rounded-xl text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/30">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
