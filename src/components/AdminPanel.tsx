import React, { useState, useRef } from 'react';
import QuickActionsEditor from './QuickActionsEditor';
import { 
  Terminal, 
  Cpu, 
  Key, 
  Wrench, 
  BellRing, 
  ShieldAlert,
  Save,
  RefreshCw,
  Globe,
  Monitor,
  Activity,
  Info,
  Layers,
  Upload,
  BookOpen,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { AppSettings } from '../types';

export default function AdminPanel({ 
  darkMode, 
  settings, 
  onUpdate,
  t
}: { 
  darkMode: boolean, 
  settings: AppSettings | null,
  onUpdate: (s: AppSettings) => void,
  t: any
}) {
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [syncingBookStack, setSyncingBookStack] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSkills = () => {
    try {
      return JSON.parse(localSettings?.skills || "[]");
    } catch {
      return [];
    }
  };

  const updateSkills = (skills: any[]) => {
    if (!localSettings) return;
    setLocalSettings({ ...localSettings, skills: JSON.stringify(skills, null, 2) });
  };

  const toggleSkill = (id: string) => {
    const skills = getSkills();
    const updated = skills.map((s: any) => s.id === id ? { ...s, enabled: !s.enabled } : s);
    updateSkills(updated);
  };

  const deleteSkill = (id: string) => {
    const skills = getSkills();
    const updated = skills.filter((s: any) => s.id !== id);
    updateSkills(updated);
  };

  const addManualSkill = () => {
    if (!newSkillName.trim()) return;
    const skills = getSkills();
    skills.push({
      id: Math.random().toString(36).substr(2, 5),
      name: newSkillName,
      content: "# New Skill\nDefine capabilities here...",
      enabled: true,
      source: 'manual',
      imported_at: new Date().toISOString()
    });
    updateSkills(skills);
    setNewSkillName('');
  };

  const handleBookStackSync = async () => {
    if (!localSettings?.bookstack_url || !localSettings?.bookstack_token_id || !localSettings?.bookstack_token_secret) return;
    
    setSyncingBookStack(true);
    try {
      const res = await fetch('/api/admin/bookstack/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: localSettings.bookstack_url,
          id: localSettings.bookstack_token_id,
          secret: localSettings.bookstack_token_secret
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingBookStack(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !localSettings) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      let currentSkills = [];
      try {
        currentSkills = JSON.parse(localSettings.skills || "[]");
      } catch {
        currentSkills = [];
      }

      currentSkills.push({
        id: Math.random().toString(36).substr(2, 5),
        name: file.name,
        content: content.substring(0, 1000) + "...",
        enabled: true,
        source: 'local_upload',
        imported_at: new Date().toISOString()
      });

      setLocalSettings({ ...localSettings, skills: JSON.stringify(currentSkills, null, 2) });
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!localSettings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSettings)
      });
      const data = await res.json();
      onUpdate(data.settings);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (key: string) => {
    if (!localSettings) return;
    const url = (localSettings as any)[key];
    if (!url) return;
    
    setImporting(key);
    try {
      const res = await fetch('/api/admin/skills/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type: key.includes('url') ? 'file' : 'repo' })
      });
      const data = await res.json();
      if (data.skills) {
        setLocalSettings({ ...localSettings, skills: data.skills });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(null);
    }
  };

  if (!localSettings) return <div className="animate-pulse flex items-center justify-center h-64">Loading settings...</div>;

  const sections = [
    { title: t.core_config, icon: Cpu, fields: [
      { key: 'llm_endpoint', label: 'LLM Endpoint', type: 'text', help: t.desc_llm_endpoint },
      { key: 'model_name', label: 'Model Name', type: 'text', help: t.desc_model_name },
      { key: 'api_key_env_var', label: 'API Key Env Variable', type: 'text', help: t.desc_api_key },
      { key: 'system_prompt', label: 'Global Instructions', type: 'textarea', help: t.desc_prompt },
    ]},
    { title: t.params_config, icon: Activity, fields: [
      { key: 'temperature', label: 'Temperature', type: 'number', help: t.desc_temp },
      { key: 'top_p', label: 'Top P', type: 'number', help: t.desc_top_p },
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', help: t.desc_tokens },
    ]},
    { title: t.integration_config, icon: Layers, fields: [
      { key: 'skill_import_url', label: t.label_skill_url, type: 'text', help: t.desc_skill_url, canImport: true },
      { key: 'skill_repo_url', label: t.label_repo_url, type: 'text', help: t.desc_repo_url, canImport: true },
      { key: 'mcp_servers', label: t.label_mcp, type: 'textarea', help: t.desc_mcp },
      { key: 'context_files', label: t.label_files, type: 'text', help: t.desc_files },
    ]},
    { title: t.bookstack_config, icon: BookOpen, fields: [
      { key: 'bookstack_url', label: 'Instance URL', type: 'text', help: t.desc_bookstack_url },
      { key: 'bookstack_token_id', label: 'Token ID', type: 'text', help: t.desc_bookstack_id },
      { key: 'bookstack_token_secret', label: 'Token Secret', type: 'text', help: t.desc_bookstack_secret },
    ], canSync: true },
    { title: t.omnidesk_config, icon: Key, fields: [
      { key: 'omnidesk_api_key', label: 'Omnidesk API Key', type: 'text', help: t.desc_omnidesk_api },
      { key: 'omnidesk_email', label: 'Admin Email', type: 'text', help: t.desc_omnidesk_email },
    ]},
    { title: t.skill_mgmt_title, icon: Wrench, isSkills: true },
    { title: 'Localizations & UI', icon: Monitor, fields: [
      { key: 'language', label: 'Default Language', type: 'select', options: ['en', 'ru'] },
      { key: 'theme', label: 'Default Theme', type: 'select', options: ['light', 'dark'] },
      { key: 'quick_actions', label: 'Quick Actions', type: 'quick_actions', help: 'Configure buttons to quickly send predefined prompts.' },
    ]},
  ];

  return (
    <div className="max-w-6xl space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className={`text-4xl font-black tracking-tight italic ${darkMode ? 'bg-gradient-to-r from-white to-slate-500' : 'bg-gradient-to-r from-slate-900 to-slate-500'} bg-clip-text text-transparent`}>{t.sys_arch}</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">{t.sys_arch_desc}</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-[0_10px_25px_rgba(79,70,229,0.3)] uppercase tracking-[0.2em]"
        >
          {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {t.deploy_config}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {sections.map((section, idx) => (
          <div key={idx} className={`p-10 rounded-[2.5rem] border transition-all ${darkMode ? 'border-white/10 bg-white/5 shadow-2xl' : 'border-slate-200 bg-white shadow-2xl shadow-slate-200/50'}`}>
            <div className="flex items-center gap-5 mb-12">
              <div className={`p-3 rounded-2xl border transition-all ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                <section.icon className="w-6 h-6" />
              </div>
              <h3 className={`font-black text-xl italic tracking-tight ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{section.title}</h3>
              {(section as any).canSync && (
                <button 
                  onClick={handleBookStackSync}
                  disabled={syncingBookStack}
                  className="ml-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {syncingBookStack ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync Docs
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {(section as any).isSkills ? (
                <div className="md:col-span-2 lg:col-span-3 space-y-8">
                   <div className="flex flex-col sm:flex-row gap-4 mb-10">
                      <input 
                        type="text" 
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        placeholder={t.skill_name_placeholder}
                        className={`flex-1 p-5 rounded-2xl border transition-all font-bold text-xs outline-none focus:border-indigo-500/50 ${darkMode ? 'bg-black/40 border-white/10 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                      />
                      <button 
                         onClick={addManualSkill}
                         className="px-8 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 uppercase tracking-[0.2em]"
                      >
                         <Plus className="w-5 h-5" />
                         {t.add_skill_manually}
                      </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {getSkills().map((skill: any) => (
                        <div key={skill.id} className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
                           <div className="flex items-center gap-5">
                              <div className={`p-3 rounded-xl transition-all ${skill.enabled ? (darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : (darkMode ? 'bg-zinc-800 text-zinc-600' : 'bg-slate-50 text-slate-400')}`}>
                                 <Wrench className="w-5 h-5" />
                              </div>
                              <div>
                                 <h4 className={`font-black tracking-tight ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{skill.name}</h4>
                                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{skill.source} • {skill.imported_at?.split('T')[0]}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <button 
                                onClick={() => toggleSkill(skill.id)}
                                className={`p-3 rounded-xl transition-all ${skill.enabled ? 'text-indigo-500 bg-indigo-500/10' : 'text-slate-500 bg-slate-500/10'}`}
                                title={t.skill_toggle}
                              >
                                {skill.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                              </button>
                              <button 
                                onClick={() => deleteSkill(skill.id)}
                                className="p-3 rounded-xl text-red-400 hover:text-red-500 bg-red-500/10 transition-all"
                                title={t.skill_delete}
                              >
                                <Trash2 className="w-6 h-6" />
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ) : section.fields.map((field) => (
                <div key={field.key} className={`space-y-4 ${field.type === 'textarea' || field.type === 'quick_actions' ? 'md:col-span-2 lg:col-span-3' : ''}`}>
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">{field.label}</label>
                    {(field as any).help && (
                      <div className="group relative">
                        <Info className="w-3.5 h-3.5 text-slate-600 cursor-help transition-colors hover:text-indigo-500" />
                        <div className={`absolute bottom-full right-0 mb-2 w-64 p-3 rounded-xl text-[10px] font-bold leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-all scale-95 group-hover:scale-100 z-50 border ${darkMode ? 'bg-zinc-900 border-white/10 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-xl'}`}>
                          {(field as any).help}
                        </div>
                      </div>
                    )}
                  </div>
                  {field.type === 'quick_actions' ? (
                    <QuickActionsEditor
                      value={(localSettings as any)[field.key] || ''}
                      onChange={(newVal) => setLocalSettings({ ...localSettings, [field.key]: newVal })}
                      darkMode={darkMode}
                    />
                  ) : field.type === 'textarea' ? (
                    <div className="relative group/textarea">
                      <textarea 
                        value={(localSettings as any)[field.key]}
                        onChange={(e) => setLocalSettings({ ...localSettings, [field.key]: e.target.value })}
                        className={`w-full h-48 p-6 pr-16 rounded-2xl border transition-all resize-none font-mono text-xs leading-relaxed outline-none focus:border-indigo-500/50 ${darkMode ? 'bg-black/40 border-white/10 text-indigo-100' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                      />
                      {field.key === 'skills' && (
                        <div className="absolute right-4 top-4 flex flex-col gap-2">
                           <input 
                             type="file" 
                             ref={fileInputRef} 
                             onChange={handleFileUpload} 
                             accept=".md,.json,.txt" 
                             className="hidden" 
                           />
                           <button 
                             onClick={() => fileInputRef.current?.click()}
                             className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all active:scale-95"
                             title="Upload Skill File"
                           >
                             <Upload className="w-4 h-4" />
                           </button>
                        </div>
                      )}
                    </div>
                  ) : field.type === 'select' ? (
                    <div className="relative">
                      <select 
                        value={(localSettings as any)[field.key]}
                        onChange={(e) => setLocalSettings({ ...localSettings, [field.key]: e.target.value })}
                        className={`w-full p-5 rounded-2xl border transition-all font-black text-xs appearance-none cursor-pointer outline-none focus:border-indigo-500/50 ${darkMode ? 'bg-black/40 border-white/10 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                      >
                        {field.options?.map(opt => <option key={opt} value={opt} className={darkMode ? "bg-zinc-900" : "bg-white"}>{opt.toUpperCase()}</option>)}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                         <Monitor className="w-4 h-4" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={(localSettings as any)[field.key]}
                        onChange={(e) => setLocalSettings({ ...localSettings, [field.key]: field.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                        className={`flex-1 p-5 rounded-2xl border transition-all font-bold text-xs outline-none focus:border-indigo-500/50 ${darkMode ? 'bg-black/40 border-white/10 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                      />
                      {(field as any).canImport && (
                        <button
                          onClick={() => handleImport(field.key)}
                          disabled={importing === field.key}
                          className="px-6 py-4 sm:py-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          {importing === field.key ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : t.import_btn}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className={`p-10 rounded-[3rem] border transition-all ${darkMode ? 'border-red-500/20 bg-red-500/5 backdrop-blur-md' : 'border-red-100 bg-red-50 shadow-2xl shadow-red-500/10'}`}>
           <div className="flex items-center gap-5 mb-8 text-red-500">
             <ShieldAlert className="w-8 h-8 drop-shadow-[0_0_12px_rgba(239,68,68,0.3)]" />
             <h3 className="font-black text-2xl tracking-tight italic">{t.danger_zone}</h3>
           </div>
           <p className={`text-xs font-bold uppercase tracking-tight leading-relaxed mb-10 max-w-2xl ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
             {t.danger_desc}
           </p>
           <div className="flex flex-wrap gap-6">
             <button className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-[10px] font-black transition-all shadow-lg shadow-red-600/30 uppercase tracking-[0.2em] active:scale-95">
               {t.factory_reset}
             </button>
             <button className={`px-10 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-[0.2em] border ${darkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 shadow-sm'}`}>
               {t.internal_logs}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
