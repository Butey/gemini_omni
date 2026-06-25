/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Settings, 
  BarChart3, 
  MessageSquare, 
  Moon, 
  Sun, 
  ShieldCheck,
  Bell,
  Download,
  Languages,
  LogOut,
  ExternalLink,
  ChevronRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import KnowledgeBase from './components/KnowledgeBase';
import AdminPanel from './components/AdminPanel';
import WidgetPreview from './components/WidgetPreview';
import Analytics from './components/Analytics';
import IntegrationGuide from './components/IntegrationGuide';
import { WidgetUI } from './components/WidgetPreview';
import { AppSettings, User } from './types';
import { translations } from './i18n';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<'ru' | 'en'>('ru');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [user] = useState<User>({
    id: 'u1',
    name: 'Admin User',
    role: 'admin',
    email: 'admin@company.com'
  });

  const t = translations[language];

  // Standalone Widget Mode for Omnidesk Embedding
  const isWidgetMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'widget';

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(setSettings);
  }, []);

  if (isWidgetMode) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-[#09090b]' : 'bg-slate-50'} p-4`}>
        <WidgetUI darkMode={darkMode} t={t} settings={settings} />
      </div>
    );
  }

  const toggleTheme = () => setDarkMode(!darkMode);

  const tabs = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'analytics', label: t.analytics, icon: BarChart3 },
    { id: 'kb', label: t.kb, icon: BookOpen },
    { id: 'admin', label: t.admin, icon: Settings },
    { id: 'integration', label: t.integration, icon: ExternalLink },
  ];

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-[#09090b] text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans antialiased transition-colors duration-500`}>
      {/* Sidebar */}
      <aside className={`w-64 border-r ${darkMode ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-white/80'} backdrop-blur-xl flex flex-col transition-all overflow-hidden relative`}>
        {!darkMode && <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none" />}
        <div className={`p-6 border-b ${darkMode ? 'border-white/10' : 'border-slate-100'} flex items-center gap-3 relative z-10`}>
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight italic">OmniAI Core</span>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 relative z-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                activeTab === tab.id 
                  ? (darkMode ? 'bg-white/10 border-white/10 text-white shadow-lg' : 'bg-white border-slate-200 text-indigo-600 shadow-md shadow-indigo-500/5') 
                  : (darkMode ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'border-transparent text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50')
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-indigo-500' : ''}`} />
              <span className="text-sm font-semibold">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className={`p-4 mt-auto border-t ${darkMode ? 'border-white/10' : 'border-slate-100'} relative z-10`}>
          <div className={`${darkMode ? 'bg-white/5 border-white/5' : 'bg-white/60 border-slate-200 shadow-sm'} rounded-2xl p-4 border backdrop-blur-sm transition-all`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center border-2 border-white text-xs font-bold text-white shadow-lg">
                AU
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold truncate">Admin Corp</span>
                <span className={`text-[10px] font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>SSO Authorized</span>
              </div>
            </div>
            <button className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${darkMode ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50'} border`}>
              <LogOut className="w-3.5 h-3.5" />
              {t.sign_out}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Ambient Backdrop for Light Mode */}
        {!darkMode && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
             <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/40 blur-[120px] rounded-full" />
             <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-50/50 blur-[100px] rounded-full" />
          </div>
        )}

        {/* Header */}
        <header className={`h-16 border-b ${darkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white/60 shadow-sm shadow-slate-200/50'} flex items-center justify-between px-8 backdrop-blur-md transition-all relative z-20`}>
          <div className="flex items-center gap-4">
            <div className={`${darkMode ? 'bg-white/10 border-white/5' : 'bg-white border-slate-200 shadow-sm'} rounded-full px-4 py-1.5 flex items-center gap-2 border`}>
              <span className={`w-1.5 h-1.5 ${darkMode ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'} rounded-full animate-pulse`}></span>
              <span className={`text-[10px] font-bold ${darkMode ? 'text-blue-100' : 'text-slate-600'} uppercase tracking-[0.1em]`}>{t.connected_api}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex ${darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} p-1 rounded-xl border transition-all`}>
              <button 
                onClick={() => setLanguage('ru')}
                className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${language === 'ru' ? (darkMode ? 'bg-white/10 text-white shadow-inner' : 'bg-white text-indigo-600 shadow-md border border-slate-100') : 'text-slate-500 hover:text-slate-700'}`}
              >
                RU
              </button>
              <button 
                onClick={() => setLanguage('en')}
                className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${language === 'en' ? (darkMode ? 'bg-white/10 text-white shadow-inner' : 'bg-white text-indigo-600 shadow-md border border-slate-100') : 'text-slate-500 hover:text-slate-700'}`}
              >
                EN
              </button>
            </div>
            <div className={`w-px h-6 mx-2 ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
            <button className={`p-2.5 rounded-xl transition-all ${darkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-white border border-transparent hover:border-slate-100 shadow-sm text-slate-500 hover:text-indigo-600'}`}>
              <Bell className="w-5 h-5" />
            </button>
            <button 
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl transition-all ${darkMode ? 'hover:bg-white/10 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'bg-white border border-slate-200 shadow-sm text-indigo-600 hover:bg-slate-50'}`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 relative z-10">
          {darkMode && (
            <>
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -mr-48 -mt-48" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none -ml-32 -mb-32" />
            </>
          )}
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + language + darkMode}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
              className="relative z-10 h-full"
            >
              {activeTab === 'dashboard' && <Dashboard darkMode={darkMode} t={t} />}
              {activeTab === 'analytics' && <Analytics darkMode={darkMode} t={t} />}
              {activeTab === 'kb' && <KnowledgeBase darkMode={darkMode} t={t} />}
              {activeTab === 'admin' && <AdminPanel darkMode={darkMode} settings={settings} onUpdate={setSettings} t={t} />}
              {activeTab === 'integration' && <IntegrationGuide darkMode={darkMode} t={t} />}
              {activeTab === 'widget' && <WidgetPreview darkMode={darkMode} t={t} settings={settings} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
