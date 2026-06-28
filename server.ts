import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { AppSettings, AnalyticsRecord, KnowledgeBaseItem } from "./src/types";

if (fs.existsSync(path.join(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.join(process.cwd(), '.env.local') });
}
dotenv.config();

const app = express();
app.set('trust proxy', true);
const PORT = 3000;

app.use(express.json());

// CORS & Headers for Iframe Embedding
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  // NOTE: Cloud Run preview URLs automatically add X-Frame-Options SAMEORIGIN.
  // When deployed to your own VPS, this will allow embedding.
  res.removeHeader('X-Frame-Options');
  next();
});

// Persistence configuration
const STORAGE_DIR = path.join(process.cwd(), 'storage');
const SETTINGS_FILE = path.join(STORAGE_DIR, 'settings.json');
const KB_FILE = path.join(STORAGE_DIR, 'kb.json');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// In-memory data store (simulating a DB)
let settings: AppSettings = {
  llm_endpoint: "gemini",
  model_name: "gemini-3.5-flash",
  custom_models: "",
  api_key: process.env.GEMINI_API_KEY || "",
  system_prompt: "You are a helpful technical support assistant for our internal tool and BookStack. Use the provided context to answer user queries accurately and professionally. Всегда отвечай на русском языке, если только клиент не пишет на другом языке или нет прямого запроса на перевод.",
  temperature: 0.7,
  top_p: 0.95,
  max_tokens: 2048,
  skills: JSON.stringify([
    {
      id: "s1",
      name: "Technical Support Expert",
      content: "# Technical Support Skill\n- Priority: High\n- Capabilities: Troubleshooting, Documentation lookup, Ticket classification\n- Guidelines: Be concise, use professional tone, always verify user ID.",
      enabled: true,
      source: "integrated",
      imported_at: new Date().toISOString()
    },
    {
      id: "s2",
      name: "Agentic Optimization",
      content: "# Agentic Optimization Skill\n- Capabilities: Chain-of-thought verification, Self-correction, Resource allocation\n- Goal: Minimize token usage while maximizing accuracy.",
      enabled: true,
      source: "integrated",
      imported_at: new Date().toISOString()
    }
  ], null, 2),
  mcp_servers: "{}",
  context_files: "/data/knowledge_index.bin",
  skill_import_url: "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/support-agent.md",
  skill_repo_url: "https://github.com/sickn33/antigravity-awesome-skills",
  bookstack_url: "",
  bookstack_token_id: "",
  bookstack_token_secret: "",
  omnidesk_api_key: "",
  omnidesk_email: "",
  omnidesk_domain: "iridi.omnidesk.ru",
  enable_context: true,
  notification_channels: {
    telegram: { enabled: false, chat_id: "" },
    gotify: { enabled: false, url: "" }
  },
  theme: 'dark',
  language: 'ru',
  quick_actions: JSON.stringify([
    { icon: '📊', ru: 'Анализ кейса', en: 'Analyze Case', prompt: 'Проанализируй этот тикет и дай краткую сводку.' },
    { icon: '❓', ru: 'Что запросить', en: 'What to ask', prompt: 'Что еще нужно запросить у клиента для решения проблемы?' },
    { icon: '✂️', ru: 'Сократить', en: 'Shorten', prompt: 'Сократи предложенный ответ, сделай его более лаконичным.' },
    { icon: '📝', ru: 'Формально', en: 'Formal', prompt: 'Перепиши ответ в более формальном и деловом стиле.' },
    { icon: '🌐', ru: 'На English', en: 'To English', prompt: 'Переведи ответ на английский язык.' },
    { icon: '💡', ru: 'Просто', en: 'Simple', prompt: 'Объясни решение простыми словами, без сложных терминов.' }
  ])
};

let analyticsLogs: AnalyticsRecord[] = [];
let knowledgeBase: KnowledgeBaseItem[] = [
  { id: '1', title: 'BookStack Integration', content: 'BookStack can be integrated via webhooks and custom widgets.', tags: ['integration', 'bookstack'] },
  { id: '2', title: 'Resetting Password', content: 'To reset the password, go to settings and click on "Forgot Password".', tags: ['account', 'security'] }
];

// Load persisted data if available
const loadData = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
    }
    if (fs.existsSync(KB_FILE)) {
      knowledgeBase = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading persisted data:', err);
  }
};

const saveData = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    fs.writeFileSync(KB_FILE, JSON.stringify(knowledgeBase, null, 2));
  } catch (err) {
    console.error('Error saving data:', err);
  }
};

loadData();

// Gemini Initialization
let ai = new GoogleGenAI({
  apiKey: settings.api_key || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper for logging
const logAnalytics = (action: AnalyticsRecord['action'], metadata: any) => {
  const record: AnalyticsRecord = {
    id: Math.random().toString(36).substr(2, 9),
    action,
    metadata,
    timestamp: new Date().toISOString()
  };
  analyticsLogs.push(record);
  console.log(`[Analytics] ${action}:`, metadata);
};

// --- API Routes ---

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return next();

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader === `Bearer ${adminPassword}`) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
};

app.post("/api/auth/login", (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return res.json({ success: true, token: "no-password-required" });

  const { password } = req.body;
  if (password === adminPassword) {
    return res.json({ success: true, token: password });
  }
  return res.status(401).json({ error: "Invalid password" });
});

app.get("/api/auth/status", (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  res.json({ required: !!adminPassword });
});

async function fetchOmnideskTicketContext(caseNumber: string) {
  console.log('fetchOmnideskTicketContext called with:', caseNumber);
  console.log('Settings:', !!settings.omnidesk_domain, !!settings.omnidesk_api_key, !!settings.omnidesk_email);
  if (!settings.omnidesk_domain || !settings.omnidesk_api_key || !settings.omnidesk_email) return null;
  try {
    const caseIdMatch = caseNumber.match(/([0-9-]+)$/);
    if (!caseIdMatch) {
      console.log('No case id match found in', caseNumber);
      return null;
    }
    const caseId = caseIdMatch[1];
    
    const domain = settings.omnidesk_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const auth = Buffer.from(`${settings.omnidesk_email}:${settings.omnidesk_api_key}`).toString('base64');
    
    console.log(`Fetching from: https://${domain}/api/cases/${caseId}.json`);
    const caseRes = await fetch(`https://${domain}/api/cases/${caseId}.json`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    
    console.log('caseRes status:', caseRes.status);
    if (!caseRes.ok) {
      console.log('caseRes text:', await caseRes.text());
      return null;
    }
    const caseData = await caseRes.json();
    const caseInfo = caseData.case || {};
    
    const msgsRes = await fetch(`https://${domain}/api/cases/${caseId}/messages.json`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    console.log('msgsRes status:', msgsRes.status);
    let description = '';
    if (msgsRes.ok) {
      const msgsData = await msgsRes.json();
      
      let msgsArray: any[] = [];
      if (Array.isArray(msgsData)) {
        msgsArray = msgsData;
      } else if (msgsData._embedded?.messages) {
        msgsArray = msgsData._embedded.messages;
      } else if (typeof msgsData === 'object' && msgsData !== null) {
        // Handle {"0": {"message": ...}, "1": ...}
        msgsArray = Object.values(msgsData);
      }
      
      description = msgsArray.map((m: any) => {
        const msg = m.message || m;
        return `${msg.user_id ? 'CLIENT' : 'STAFF'}: ${msg.content_html ? msg.content_html.replace(/<[^>]+>/g, '') : msg.content}`;
      }).join('\n\n');
    }
    
    console.log('Extracted description length:', description.length);
    return {
      subject: caseInfo.subject || '',
      description: description || 'No messages found.'
    };
  } catch (err) {
    console.error('Error fetching Omnidesk ticket:', err);
    return null;
  }
}

// Suggestions Engine
app.post("/api/chat", async (req, res) => {
  const { ticketContext, history, userQuery } = req.body;
  
  let actualTicketContext = ticketContext;
  if (ticketContext?.id && (!ticketContext.description || ticketContext.description.includes('Context fetched from active Omnidesk ticket'))) {
    const fetchedContext = await fetchOmnideskTicketContext(ticketContext.id);
    if (fetchedContext) {
      actualTicketContext = { ...ticketContext, ...fetchedContext };
    }
  }

  logAnalytics('chat_request', { ticketId: actualTicketContext?.id });

  try {
    let dynamicKnowledge = '';
    
    // Dynamically search BookStack if configured
    if (settings.bookstack_url && settings.bookstack_token_id && settings.bookstack_token_secret) {
      try {
        const searchQuery = encodeURIComponent(userQuery || actualTicketContext?.subject || 'help');
        const searchRes = await fetch(`${settings.bookstack_url.replace(/\/$/, '')}/api/search?query=${searchQuery}&count=3`, {
          headers: {
            'Authorization': `Token ${settings.bookstack_token_id}:${settings.bookstack_token_secret}`
          },
          signal: AbortSignal.timeout(10000)
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const pages = (searchData.data || []).filter((item: any) => item.type === 'page').slice(0, 3);
          
          for (const page of pages) {
            const pageRes = await fetch(`${settings.bookstack_url.replace(/\/$/, '')}/api/pages/${page.id}`, {
              headers: {
                'Authorization': `Token ${settings.bookstack_token_id}:${settings.bookstack_token_secret}`
              },
              signal: AbortSignal.timeout(10000)
            });
            if (pageRes.ok) {
              const pageData = await pageRes.json();
              let cleanContent = pageData.markdown || pageData.html || '';
              if (!pageData.markdown && pageData.html) {
                cleanContent = pageData.html.replace(/<[^>]*>?/gm, '');
              }
              dynamicKnowledge += `- BookStack: ${pageData.name}: ${cleanContent.substring(0, 2000)}\n`;
            }
          }
        }
      } catch (err) {
        console.error("BookStack Dynamic Search Error:", err);
      }
    }

    const prompt = `
      Context: ${settings.system_prompt}
      
      Relevant Knowledge Base:
      ${knowledgeBase.map(item => `- ${item.title}: ${item.content}`).join('\n')}
      ${dynamicKnowledge}
      
      Ticket Context:
      Subject: ${actualTicketContext?.subject || 'N/A'}
      Description: ${actualTicketContext?.description || 'N/A'}
      
      Chat History: ${JSON.stringify(history)}
      
      Latest User Query: "${userQuery || 'Analyze the ticket and provide suggestions.'}"
      
      Instructions: 
      You are a versatile, helpful AI assistant for a customer support agent. 
      Maintain a free-flowing, natural dialogue with the agent on ANY topic they bring up. 
      DO NOT refuse to answer questions outside of technical support. If the agent asks about general topics (like the weather, math, etc.), answer them naturally.
      When the query relates to the ticket or knowledge base, use the provided context to assist them.
      Always respond directly to the "Latest User Query" taking into account the "Chat History" and context.
      Your conversational response to the agent MUST be placed in the "reply" field. 
      ONLY if the agent asks for a draft to send to the customer, OR if providing a draft would be highly relevant and helpful, you can include up to 3 drafts in the "suggestions" array.
      
      Output ONLY valid JSON in the exact format: 
      { "reply": "Your conversational response to the agent here", "suggestions": [{ "title": "Short title", "text": "Draft reply to customer", "type": "Draft" }] }
      (Return an empty array [] for "suggestions" if no drafts are needed).
    `;

    let isCustom = false;
    let customModelConfig: any = null;
    if (settings.custom_models && settings.custom_models.startsWith('[')) {
      try {
        const parsed = JSON.parse(settings.custom_models);
        customModelConfig = parsed.find((m: any) => m.model_id === settings.model_name);
        if (customModelConfig) isCustom = true;
      } catch (e) {}
    }

    const currentApiKey = isCustom && customModelConfig.api_key ? customModelConfig.api_key : (settings.api_key || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "");
    if (!currentApiKey || currentApiKey.trim() === "") {
      return res.status(400).json({ error: "API key is not configured. Please set it in the Settings panel or in your environment variables." });
    }

    let responseText = '{}';
    try {
      if (isCustom && customModelConfig) {
        const endpoint = customModelConfig.base_url.replace(/\/$/, '') + '/chat/completions';
        const resOpenAI = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentApiKey}`
          },
          body: JSON.stringify({
            model: customModelConfig.model_id,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(60000)
        });
        if (!resOpenAI.ok) {
           const errBody = await resOpenAI.text();
           throw new Error(`OpenAI-compatible API Error: ${resOpenAI.status} - ${errBody}`);
        }
        const dataOpenAI = await resOpenAI.json();
        responseText = dataOpenAI.choices?.[0]?.message?.content || '{}';
      } else {
        let response;
        try {
          response = await ai.models.generateContent({
            model: settings.model_name,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            }
          });
        } catch (apiError: any) {
          if (apiError.message && (apiError.message.includes("API Key not found") || apiError.message.includes("API key not valid"))) {
            throw new Error("The Gemini API key currently configured is invalid or has been revoked. Please check your AI Studio Secrets or the Settings panel and provide a new, valid API key.");
          }
          if (apiError.message && (apiError.message.includes("high demand") || apiError.message.includes("quota") || apiError.message.includes("429")) && settings.model_name === 'gemini-3.5-flash') {
            console.log("gemini-3.5-flash is experiencing high demand or quota limits. Falling back to gemini-2.5-flash...");
            response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              }
            });
          } else {
            throw apiError;
          }
        }
        responseText = response.text || '{}';
      }
    } catch (apiError: any) {
       throw apiError;
    }

    let data;
    try {
      let cleanText = (responseText || '{}').trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
      else if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
      if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
      data = JSON.parse(cleanText.trim() || '{}');
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', responseText);
      data = {
        reply: responseText,
        suggestions: []
      };
    }

    res.json({ 
      reply: data.reply || "I analyzed the context.",
      suggestions: (data.suggestions || []).map((s: any) => ({
        id: Math.random().toString(36).substr(2, 5),
        title: s.title || "Draft",
        text: s.text,
        type: s.type || "Draft",
        model: settings.model_name,
        confidence: 0.9,
        created_at: new Date().toISOString()
      }))
    });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Analytics API
app.get("/api/analytics", requireAuth, (req, res) => {
  res.json(analyticsLogs);
});

// Omnidesk JS Widget
app.get("/api/omnidesk/widget.js", (req, res) => {
  const widgetUrl = `${req.protocol}://${req.get('host')}/?mode=widget`;
  const jsContent = `
(function() {
  console.log('OmniAI Widget: Script loaded (Floating Mode)');
  
  if (document.getElementById('omniai-floating-container')) {
    return; // Already initialized
  }

  // Parse case number from Omnidesk URL
  var caseNumber = '';
  var matchUrl = document.location.href.match(/\\/(\\d+-\\d+)\\/?$/);
  if (matchUrl) {
    caseNumber = matchUrl[1];
  } else if (typeof window.CurrentCaseNumber !== 'undefined') {
    caseNumber = window.CurrentCaseNumber;
  }
  
  var finalWidgetUrl = '${widgetUrl}' + (caseNumber ? '&case_number=' + caseNumber : '');

  // Main container
  var container = document.createElement('div');
  container.id = 'omniai-floating-container';
  container.style.position = 'fixed';
  container.style.bottom = '30px';
  container.style.right = '30px';
  container.style.zIndex = '999999';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'flex-end';
  container.style.fontFamily = 'sans-serif';

  // Iframe container (the chat window)
  var iframeContainer = document.createElement('div');
  iframeContainer.id = 'omniai-iframe-container';
  iframeContainer.style.width = '400px';
  iframeContainer.style.height = '650px';
  iframeContainer.style.marginBottom = '20px';
  iframeContainer.style.borderRadius = '16px';
  iframeContainer.style.boxShadow = '0 10px 40px -10px rgba(0,0,0,0.3)';
  iframeContainer.style.overflow = 'hidden';
  iframeContainer.style.display = 'none';
  iframeContainer.style.opacity = '0';
  iframeContainer.style.transform = 'translateY(20px)';
  iframeContainer.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
  iframeContainer.style.transformOrigin = 'bottom right';
  iframeContainer.style.backgroundColor = '#fff';

  var iframe = document.createElement('iframe');
  iframe.src = finalWidgetUrl;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframeContainer.appendChild(iframe);

  // Floating Action Button
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'omniai-toggle-btn';
  toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  toggleBtn.style.width = '64px';
  toggleBtn.style.height = '64px';
  toggleBtn.style.borderRadius = '32px';
  toggleBtn.style.backgroundColor = '#4f46e5'; // indigo-600
  toggleBtn.style.color = '#fff';
  toggleBtn.style.border = 'none';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.style.boxShadow = '0 4px 16px rgba(79, 70, 229, 0.4)';
  toggleBtn.style.display = 'flex';
  toggleBtn.style.alignItems = 'center';
  toggleBtn.style.justifyContent = 'center';
  toggleBtn.style.transition = 'all 0.2s ease';
  
  toggleBtn.onmouseover = function() {
    toggleBtn.style.transform = 'scale(1.05)';
  };
  toggleBtn.onmouseout = function() {
    toggleBtn.style.transform = 'scale(1)';
  };

  toggleBtn.onclick = function() {
    var isHidden = iframeContainer.style.display === 'none';
    if (isHidden) {
      iframeContainer.style.display = 'block';
      // trigger reflow
      void iframeContainer.offsetWidth;
      iframeContainer.style.opacity = '1';
      iframeContainer.style.transform = 'translateY(0)';
      toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      toggleBtn.style.backgroundColor = '#334155'; // slate-700
    } else {
      iframeContainer.style.opacity = '0';
      iframeContainer.style.transform = 'translateY(20px)';
      setTimeout(function() {
        iframeContainer.style.display = 'none';
      }, 300);
      toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
      toggleBtn.style.backgroundColor = '#4f46e5'; // indigo-600
    }
  };

  container.appendChild(iframeContainer);
  container.appendChild(toggleBtn);
  document.body.appendChild(container);

  // Listen for messages from iframe to inject text into Omnidesk editor
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'OMNIDESK_INJECT_RESPONSE') {
      var editor = document.querySelector('.redactor-editor, .redactor_editor');
      if (editor) {
        var p = document.createElement('p'); 
        p.innerText = e.data.content; 
        editor.appendChild(p);
      } else {
        var ta = document.querySelector('textarea[name="content"], #reply_content, #response_html, .case-response');
        if (ta) {
          ta.value += (ta.value ? '\\n\\n' : '') + e.data.content;
        }
      }
    }
  });

})();
`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(jsContent);
});

// Settings API
app.get("/api/settings", requireAuth, (req, res) => {
  res.json({
    ...settings,
    api_key: settings.api_key || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ""
  });
});

app.post("/api/settings", requireAuth, (req, res) => {
  const previousEffectiveKey = settings.api_key || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  
  settings = { ...settings, ...req.body };
  
  if (settings.api_key === process.env.GEMINI_API_KEY || settings.api_key === process.env.VITE_GEMINI_API_KEY) {
    settings.api_key = "";
  }
  
  const effectiveKey = settings.api_key || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

  if (effectiveKey !== previousEffectiveKey || !ai) {
    ai = new GoogleGenAI({
      apiKey: effectiveKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }
  saveData();
  logAnalytics('api_call', { endpoint: '/api/settings', method: 'POST' });
  res.json({ status: "ok", settings });
});

// Knowledge Base API
app.get("/api/knowledge-base", requireAuth, (req, res) => {
  res.json(knowledgeBase);
});

// Admin Skill Import API
app.post("/api/admin/skills/import", requireAuth, async (req, res) => {
  const { url, type } = req.body;
  logAnalytics('api_call', { endpoint: '/api/admin/skills/import', url, type });

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    
    const content = await response.text();
    
    let currentSkills = [];
    try {
      currentSkills = JSON.parse(settings.skills || "[]");
    } catch {
      currentSkills = [];
    }

    const newSkill = {
      id: Math.random().toString(36).substr(2, 5),
      name: url.split('/').pop(),
      content: content.substring(0, 1000) + "...",
      enabled: true,
      source: url,
      imported_at: new Date().toISOString()
    };

    currentSkills.push(newSkill);
    const updatedSkills = JSON.stringify(currentSkills, null, 2);
    
    res.json({ skills: updatedSkills });
  } catch (error: any) {
    console.error("Import Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin Repo Skills Fetch API
app.post("/api/admin/skills/repo", requireAuth, async (req, res) => {
  const { url } = req.body;
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      // If it's not a GitHub repo, try to fetch it as a custom catalog (e.g., Nvidia NIM or custom JSON)
      const catRes = await fetch(url);
      if (catRes.ok) {
        const data = await catRes.json();
        const items = Array.isArray(data) ? data : (data.files || data.skills || data.models || []);
        
        if (items && items.length > 0) {
          const files = items.map((item: any) => ({
            path: item.name || item.path || item.id,
            url: item.url || item.download_url || url + '/' + (item.id || item.path)
          }));
          return res.json({ files, owner: 'custom', repo: 'catalog', branch: 'main' });
        }
      }
      return res.status(400).json({ error: "Invalid GitHub URL or Unsupported Catalog Format" });
    }
    const [, owner, repoName] = match;
    const repo = repoName.replace(/\.git$/, '');
    
    let apiReq = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
    let branch = 'main';
    
    if (!apiReq.ok) {
      apiReq = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
      branch = 'master';
      if (!apiReq.ok) {
         return res.status(400).json({ error: "Could not fetch repository tree" });
      }
    }
    
    const data = await apiReq.json();
    const files = data.tree.filter((t: any) => t.type === 'blob' && (t.path.endsWith('.md') || t.path.endsWith('.json')));
    res.json({ files, owner, repo, branch });
  } catch(error: any) {
    console.error("Repo Fetch Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin Repo Skills Batch Import API
app.post("/api/admin/skills/import-batch", requireAuth, async (req, res) => {
  const { urls } = req.body;
  try {
    let currentSkills = [];
    try {
      currentSkills = JSON.parse(settings.skills || "[]");
    } catch {
      currentSkills = [];
    }

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const content = await response.text();
          currentSkills.push({
            id: Math.random().toString(36).substr(2, 5),
            name: url.split('/').pop(),
            content: content.substring(0, 1000) + "...",
            enabled: true,
            source: url,
            imported_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`Failed to fetch ${url}`, err);
      }
    }

    const updatedSkills = JSON.stringify(currentSkills, null, 2);
    res.json({ skills: updatedSkills });
  } catch (error: any) {
    console.error("Batch Import Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin BookStack Sync API
app.post("/api/admin/bookstack/sync", requireAuth, async (req, res) => {
  const { url, id, secret } = req.body;
  logAnalytics('api_call', { endpoint: '/api/admin/bookstack/sync', url });

  if (!url || !id || !secret) {
    return res.status(400).json({ error: "Missing BookStack credentials" });
  }

  try {
    let allPages: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    // Fetch all pages (pagination) but DO NOT fetch full HTML/Markdown content
    while (hasMore) {
      const response = await fetch(`${url.replace(/\/$/, '')}/api/pages?count=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Token ${id}:${secret}`
        }
      });

      if (!response.ok) throw new Error(`BookStack Error: ${response.statusText}`);
      
      const data = await response.json();
      const pagesList = data.data || [];
      allPages = allPages.concat(pagesList);
      
      if (offset + limit >= (data.total || 0) || pagesList.length === 0) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }
    
    // Remove old bookstack items from local KB
    knowledgeBase.splice(0, knowledgeBase.length, ...knowledgeBase.filter(item => !item.tags.includes('bookstack')));
    
    // Store lightweight indices (title + link only)
    for (const page of allPages) {
      knowledgeBase.push({
        id: `bookstack-${page.id}`,
        title: page.name,
        content: `BookStack Article ID: ${page.id}. Read more at: ${url.replace(/\/$/, '')}/books/${page.book_id}/page/${page.slug || page.id}`,
        tags: ['bookstack']
      });
    }
    
    saveData();
    
    res.json({ 
      success: true, 
      count: allPages.length,
      message: `Successfully indexed ${allPages.length} articles from BookStack. Full content will be fetched dynamically via RAG.`
    });
  } catch (error: any) {
    console.error("BookStack Sync Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/knowledge-base", requireAuth, (req, res) => {
  const newItem = { id: Math.random().toString(36).substr(2, 9), ...req.body };
  knowledgeBase.push(newItem);
  saveData();
  res.json(newItem);
});

app.put("/api/knowledge-base/:id", requireAuth, (req, res) => {
  const index = knowledgeBase.findIndex(item => item.id === req.params.id);
  if (index !== -1) {
    knowledgeBase[index] = { ...knowledgeBase[index], ...req.body };
    saveData();
    res.json(knowledgeBase[index]);
  } else {
    res.status(404).json({ error: "Item not found" });
  }
});

app.delete("/api/knowledge-base/:id", requireAuth, (req, res) => {
  const index = knowledgeBase.findIndex(item => item.id === req.params.id);
  if (index !== -1) {
    knowledgeBase.splice(index, 1);
    saveData();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Item not found" });
  }
});

// Export Reports (Simulated)
app.get("/api/export/csv", requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=analytics_report.csv');
  const csv = "timestamp,action,metadata\n" + 
    analyticsLogs.map(l => `${l.timestamp},${l.action},"${JSON.stringify(l.metadata).replace(/"/g, '""')}"`).join('\n');
  res.send(csv);
});

// Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
