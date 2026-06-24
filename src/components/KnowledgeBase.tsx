import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Tag, 
  FileText, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  History,
  BrainCircuit,
  MessageSquareQuote
} from 'lucide-react';
import { KnowledgeBaseItem } from '../types';

export default function KnowledgeBase({ darkMode, t }: { darkMode: boolean, t: any }) {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/knowledge-base')
      .then(res => res.json())
      .then(setItems);
  }, []);

  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(search.toLowerCase()) || 
    i.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className={`text-4xl font-black tracking-tight italic ${darkMode ? 'bg-gradient-to-r from-white to-slate-500' : 'bg-gradient-to-r from-slate-900 to-slate-500'} bg-clip-text text-transparent`}>{t.context_engine}</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">{t.context_desc}</p>
        </div>
        <div className="flex items-center gap-4">
          <button className={`px-6 py-3 rounded-2xl flex items-center gap-2 text-[10px] font-black border transition-all uppercase tracking-[0.2em] ${darkMode ? 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10' : 'border-slate-200 bg-white shadow-lg shadow-slate-200/40 text-slate-500 hover:text-indigo-600'}`}>
             <BrainCircuit className="w-4 h-4" />
             {t.reindex_kb}
          </button>
          <button className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] flex items-center gap-2 transition-all shadow-[0_10px_25px_rgba(79,70,229,0.3)] uppercase tracking-[0.2em]">
            <Plus className="w-5 h-5" />
            {t.add_entity}
          </button>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className={`p-3 rounded-3xl border ${darkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/80 shadow-2xl shadow-slate-200/20'} backdrop-blur-md flex items-center gap-6`}>
        <div className={`flex-1 flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all focus-within:border-indigo-500/40 ${darkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
          <Search className="w-5 h-5 text-slate-500" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search_placeholder} 
            className={`bg-transparent border-none outline-none text-xs w-full font-bold ${darkMode ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'}`}
          />
        </div>
        <div className={`hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl border ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
           <button className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-[0.1em] transition-all ${darkMode ? 'bg-white/10 text-white' : 'bg-white text-indigo-600 shadow-sm'}`}>ALL</button>
           <button className="px-6 py-2 rounded-xl text-[10px] font-black text-slate-500 hover:text-indigo-600 uppercase tracking-[0.1em] transition-all">ARTICLES</button>
           <button className="px-6 py-2 rounded-xl text-[10px] font-black text-slate-500 hover:text-indigo-600 uppercase tracking-[0.1em] transition-all">TICKET_LOGS</button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredItems.map(item => (
          <div key={item.id} className={`p-8 rounded-[2rem] border transition-all group relative hover:scale-[1.02] active:scale-95 ${darkMode ? 'border-white/10 bg-white/5 hover:border-indigo-500/30 hover:bg-white/10' : 'border-slate-200 bg-white shadow-xl shadow-slate-200/50 hover:border-indigo-500/40 hover:shadow-2xl'}`}>
            <button className={`absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl ${darkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-50 text-slate-400'}`}>
              <MoreVertical className="w-5 h-5" />
            </button>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 border transition-transform group-hover:scale-110 group-hover:rotate-3 ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'bg-indigo-50 border-indigo-100 shadow-lg shadow-indigo-500/5'}`}>
               <FileText className={`w-7 h-7 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <h3 className={`font-black text-xl mb-4 italic tracking-tight line-clamp-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
            <p className={`text-xs mb-8 line-clamp-3 leading-relaxed font-bold tracking-tight ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {item.content}
            </p>
            <div className="flex items-center flex-wrap gap-2.5">
              {item.tags.map(tag => (
                <span key={tag} className={`text-[9px] font-black px-4 py-1.5 rounded-xl border uppercase tracking-[0.2em] shadow-sm ${darkMode ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                  {tag}
                </span>
              ))}
            </div>
            <div className={`mt-10 pt-8 border-t flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? 'border-white/5 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
               <div className="flex items-center gap-2">
                 <History className="w-4 h-4 text-indigo-500/60" />
                 <span>Synced 2h ago</span>
               </div>
               <div className="flex gap-6">
                 <button className="hover:text-indigo-600 transition-colors pointer-events-auto">EDIT</button>
                 <button className="hover:text-red-500 transition-colors pointer-events-auto">DELETE</button>
               </div>
            </div>
          </div>
        ))}

        {/* Training Placeholder */}
        <div className={`p-10 rounded-[2rem] border-2 border-dashed transition-all group flex flex-col items-center justify-center text-center cursor-pointer min-h-[350px] backdrop-blur-sm ${darkMode ? 'border-white/10 bg-white/5 hover:border-indigo-500/40' : 'border-slate-200 bg-slate-50 hover:border-indigo-500/40 hover:bg-white'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-8 border-2 group-hover:scale-110 transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'}`}>
              <Plus className={`w-10 h-10 ${darkMode ? 'text-indigo-500/40 group-hover:text-indigo-400' : 'text-indigo-600/40 group-hover:text-indigo-600'}`} />
            </div>
            <h4 className={`font-black mb-2 uppercase tracking-[0.3em] text-xs ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t.ingest_data}</h4>
            <p className="text-[10px] text-slate-500 max-w-[200px] font-black leading-relaxed uppercase tracking-widest">{t.ingest_desc}</p>
        </div>
      </div>
    </div>
  );
}
