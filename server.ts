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
  api_key_pool: "",
  system_prompt: "You are the iRidi Knowledge Assistant. Your role is to help both iRidi employees and external users understand and work with iRidi products.\n\nSOURCES AND CONTEXT:\nYou must answer questions ONLY using verified information from the official iRidi documentation, which includes:\n- dev.iridi.com\n- doc.iridi.com\n- devbms.iridi.com/scada\n- The provided local Knowledge Base articles, linked files, web documents, and custom materials.\n\nSTRICT RULES OF RELIABILITY:\n- Never invent features or technical details.\n- Never speculate.\n- If information is unavailable or uncertain in the provided context (neither in the official websites nor in the local Knowledge Base), you must explicitly state: \"This information is not available in the known documentation.\" It is always better to report that information is not found than to invent it.\n\nRESPONSE FORMAT AND STYLE:\n- Prefer concise, structured responses.\n- Use step-by-step instructions where applicable.\n- Include configuration examples and code blocks if they are documented.\n- Adapt the depth of your explanation depending on the user.\n- Always reply in Russian unless requested otherwise.",
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
      // Upgrade system prompt if it contains old default value
      if (settings.system_prompt && settings.system_prompt.startsWith("You are a helpful technical support assistant")) {
        settings.system_prompt = "You are the iRidi Knowledge Assistant. Your role is to help both iRidi employees and external users understand and work with iRidi products.\n\nSOURCES AND CONTEXT:\nYou must answer questions ONLY using verified information from the official iRidi documentation, which includes:\n- dev.iridi.com\n- doc.iridi.com\n- devbms.iridi.com/scada\n- The provided local Knowledge Base articles, linked files, web documents, and custom materials.\n\nSTRICT RULES OF RELIABILITY:\n- Never invent features or technical details.\n- Never speculate.\n- If information is unavailable or uncertain in the provided context (neither in the official websites nor in the local Knowledge Base), you must explicitly state: \"This information is not available in the known documentation.\" It is always better to report that information is not found than to invent it.\n\nRESPONSE FORMAT AND STYLE:\n- Prefer concise, structured responses.\n- Use step-by-step instructions where applicable.\n- Include configuration examples and code blocks if they are documented.\n- Adapt the depth of your explanation depending on the user.\n- Always reply in Russian unless requested otherwise.";
        saveData();
      }
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

// API Key Rotation Helpers
let lastUsedKeyIndex = 0;

const maskApiKey = (key: string): string => {
  if (!key) return "N/A";
  if (key.length <= 10) return "***";
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
};

const getApiKeysPool = (): string[] => {
  const keys: string[] = [];
  
  // 1. Primary key
  const primaryKey = settings.api_key || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  if (primaryKey && primaryKey.trim()) {
    keys.push(primaryKey.trim());
  }
  
  // 2. Backup pool keys
  if (settings.api_key_pool) {
    const backupKeys = settings.api_key_pool
      .split(/[\n,;]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
      
    for (const key of backupKeys) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }
  
  return keys;
};

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

async function resolveCaseId(caseNumber: string): Promise<string | null> {
  if (!settings.omnidesk_domain || !settings.omnidesk_api_key || !settings.omnidesk_email) return null;
  const caseIdMatch = caseNumber.match(/([0-9-]+)$/);
  if (!caseIdMatch) return null;
  let caseId = caseIdMatch[1];
  
  if (caseId.includes('-')) {
    try {
      const domain = settings.omnidesk_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const auth = Buffer.from(`${settings.omnidesk_email}:${settings.omnidesk_api_key}`).toString('base64');
      console.log(`Resolving case_number ${caseId} via search`);
      const searchRes = await fetch(`https://${domain}/api/cases.json?case_number=${caseId}`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const casesArray = Array.isArray(searchData) ? searchData : Object.values(searchData).filter((v: any) => v && v.case);
        const caseObj = casesArray.find((c: any) => c.case && c.case.case_number === caseId);
        if (caseObj && caseObj.case) {
          return caseObj.case.case_id.toString();
        } else {
           const firstItem = casesArray[0];
           if (firstItem && firstItem.case) {
             return firstItem.case.case_id.toString();
           }
        }
      }
    } catch (e) {
      console.error('Error resolving caseId:', e);
    }
  }
  return caseId;
}

async function fetchOmnideskTicketContext(caseNumber: string) {
  console.log('fetchOmnideskTicketContext called with:', caseNumber);
  console.log('Settings:', !!settings.omnidesk_domain, !!settings.omnidesk_api_key, !!settings.omnidesk_email);
  if (!settings.omnidesk_domain || !settings.omnidesk_api_key || !settings.omnidesk_email) return null;
  try {
    const caseId = await resolveCaseId(caseNumber);
    if (!caseId) {
      console.log('Could not resolve case ID for', caseNumber);
      return null;
    }
    
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
        msgsArray = Object.values(msgsData).filter((v: any) => v && typeof v === 'object' && v.message);
      }
      
      description = msgsArray.map((m: any) => {
        const msg = m.message || m;
        const text = msg.content_html ? msg.content_html.replace(/<[^>]+>/g, '') : (msg.content || '');
        return `${msg.user_id ? 'CLIENT' : 'STAFF'}: ${text}`;
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

app.post("/api/omnidesk/cases/:caseNumber/messages", async (req, res) => {
  const { caseNumber } = req.params;
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }
  if (!settings.omnidesk_domain || !settings.omnidesk_api_key || !settings.omnidesk_email) {
    return res.status(400).json({ error: "Omnidesk API is not configured in Settings" });
  }

  try {
    const resolvedId = await resolveCaseId(caseNumber);
    if (!resolvedId) {
      return res.status(404).json({ error: "Could not resolve case ID" });
    }

    const domain = settings.omnidesk_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const auth = Buffer.from(`${settings.omnidesk_email}:${settings.omnidesk_api_key}`).toString('base64');

    console.log(`Adding message to case ${resolvedId} via Omnidesk API`);
    const omniRes = await fetch(`https://${domain}/api/cases/${resolvedId}/messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          content: content
        }
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (omniRes.ok) {
      const data = await omniRes.json();
      return res.json({ success: true, data });
    } else {
      const errText = await omniRes.text();
      console.error('Omnidesk error while adding message:', errText);
      return res.status(omniRes.status).json({ error: errText });
    }
  } catch (error: any) {
    console.error("Error adding message via Omnidesk API:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/omnidesk/cases/:caseNumber/notes", async (req, res) => {
  const { caseNumber } = req.params;
  const { content, staff_id, staff_email } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }
  if (!settings.omnidesk_domain || !settings.omnidesk_api_key || !settings.omnidesk_email) {
    return res.status(400).json({ error: "Omnidesk API is not configured in Settings" });
  }

  try {
    const resolvedId = await resolveCaseId(caseNumber);
    if (!resolvedId) {
      return res.status(404).json({ error: "Could not resolve case ID" });
    }

    const domain = settings.omnidesk_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const auth = Buffer.from(`${settings.omnidesk_email}:${settings.omnidesk_api_key}`).toString('base64');

    console.log(`Adding note to case ${resolvedId} via Omnidesk API, staff_id: ${staff_id}, staff_email: ${staff_email}`);
    
    const notePayload: any = {
      content: content
    };
    if (staff_id) {
      notePayload.staff_id = staff_id;
    } else if (staff_email) {
      notePayload.staff_email = staff_email;
    }

    const omniRes = await fetch(`https://${domain}/api/cases/${resolvedId}/notes.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        note: notePayload
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (omniRes.ok) {
      const data = await omniRes.json();
      return res.json({ success: true, data });
    } else {
      const errText = await omniRes.text();
      console.error('Omnidesk error while adding note:', errText);
      return res.status(omniRes.status).json({ error: errText });
    }
  } catch (error: any) {
    console.error("Error adding note via Omnidesk API:", error);
    return res.status(500).json({ error: error.message });
  }
});

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
              let pageUrl = '';
              let bookSlug = '';
              if (pageData.book_id) {
                try {
                  const bookRes = await fetch(`${settings.bookstack_url.replace(/\/$/, '')}/api/books/${pageData.book_id}`, {
                    headers: {
                      'Authorization': `Token ${settings.bookstack_token_id}:${settings.bookstack_token_secret}`
                    },
                    signal: AbortSignal.timeout(5000)
                  });
                  if (bookRes.ok) {
                    const bookData = await bookRes.json();
                    if (bookData && bookData.slug) {
                      bookSlug = bookData.slug;
                    }
                  }
                } catch (e) {
                  console.error("Failed to fetch book slug dynamically during search:", e);
                }
              }

              if (bookSlug) {
                pageUrl = `${settings.bookstack_url.replace(/\/$/, '')}/books/${bookSlug}/page/${pageData.slug || pageData.id}`;
              } else if (pageData.url) {
                try {
                  const urlObj = new URL(pageData.url);
                  pageUrl = `${settings.bookstack_url.replace(/\/$/, '')}${urlObj.pathname}`;
                } catch (e) {
                  const path = pageData.url.startsWith('/') ? pageData.url : `/${pageData.url}`;
                  pageUrl = `${settings.bookstack_url.replace(/\/$/, '')}${path}`;
                }
              } else {
                pageUrl = `${settings.bookstack_url.replace(/\/$/, '')}/books/${pageData.book_id}/page/${pageData.slug || pageData.id}`;
              }
              dynamicKnowledge += `- BookStack Article "${pageData.name}" (Direct URL: ${pageUrl}): ${cleanContent.substring(0, 2000)}\n`;
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
      
      CRITICAL FOR BOOKSTACK ARTICLES:
      If you refer to any BookStack article or recommend a wiki page, you MUST ALWAYS provide the direct clickable Markdown link for it in the format: [Article Name](URL).
      The URL is provided in the source metadata (e.g. "Direct URL: ..." or "Read more at: ...").
      NEVER just output the article name, ID, or slug as plain text without a direct Markdown link! Always wrap it in [Article Name](URL).
      
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

    const pool = getApiKeysPool();
    if (pool.length === 0) {
      return res.status(400).json({ error: "API key is not configured. Please set it in the Settings panel or in your environment variables." });
    }

    let responseText = '{}';
    let success = false;
    let lastError: any = null;

    const startIndex = lastUsedKeyIndex % pool.length;
    lastUsedKeyIndex = (startIndex + 1) % pool.length;

    for (let i = 0; i < pool.length; i++) {
      const currentIdx = (startIndex + i) % pool.length;
      const activeKey = pool[currentIdx];
      const masked = maskApiKey(activeKey);
      
      console.log(`[Rotation] Attempting LLM call using key index ${currentIdx} (${masked})`);
      
      try {
        if (isCustom && customModelConfig) {
          const endpoint = customModelConfig.base_url.replace(/\/$/, '') + '/chat/completions';
          const resOpenAI = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeKey}`
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
          success = true;
        } else {
          const activeAi = new GoogleGenAI({
            apiKey: activeKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });
          
          let response;
          try {
            response = await activeAi.models.generateContent({
              model: settings.model_name,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              }
            });
          } catch (apiError: any) {
            if (apiError.message && (apiError.message.includes("API Key not found") || apiError.message.includes("API key not valid"))) {
              throw new Error("The Gemini API key currently configured is invalid or has been revoked.");
            }
            if (apiError.message && (apiError.message.includes("high demand") || apiError.message.includes("quota") || apiError.message.includes("429")) && settings.model_name === 'gemini-3.5-flash') {
              console.log("[Rotation] gemini-3.5-flash is experiencing high demand or quota limits. Falling back to gemini-2.5-flash...");
              response = await activeAi.models.generateContent({
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
          success = true;
        }

        if (success) {
          console.log(`[Rotation] LLM call succeeded with key index ${currentIdx} (${masked})`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.error(`[Rotation] Error with key index ${currentIdx} (${masked}):`, err.message || err);
      }
    }

    if (!success) {
      throw lastError || new Error("All API keys in the pool failed to generate content.");
    }

    let data;
    let cleanText = (responseText || '{}').trim();
    try {
      // 1. Strip thought/reasoning tags (including unclosed tags)
      cleanText = cleanText.replace(/<(thought|thinking|reasoning|cot)>[\s\S]*?<\/\1>/gi, '');
      cleanText = cleanText.replace(/<(thought|thinking|reasoning|cot)>[\s\S]*/gi, '');
      cleanText = cleanText.trim();
      
      // 2. Strip markdown code blocks
      let jsonText = cleanText;
      if (jsonText.startsWith('```json')) jsonText = jsonText.substring(7);
      else if (jsonText.startsWith('```')) jsonText = jsonText.substring(3);
      if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
      jsonText = jsonText.trim();
      
      // 3. Extract JSON object boundary
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
      }
      
      data = JSON.parse(jsonText || '{}');
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', responseText);
      // Clean up the fallback text too, so we don't show the technical thought block to the user
      data = {
        reply: cleanText || responseText,
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
  console.log('OmniAI Widget: Script loaded');
  
  function initWidget() {
    if (document.getElementById('omniai-widget-container')) {
      return true; // Already initialized
    }
    
    // Try to find the ticket response area to inject below it
    var renderTarget = document.getElementById('reply_wrapper') ||
                       document.querySelector('.reply-wrapper') ||
                       document.getElementById('reply_block') ||
                       document.getElementById('msg_form') ||
                       document.querySelector('.msg-form') ||
                       document.getElementById('response_answer_area') || 
                       document.querySelector('.request-area') || 
                       document.querySelector('#case_message_area') ||
                       document.querySelector('.case-content');
    
    if (renderTarget) {
      console.log('OmniAI Widget: Found target container, injecting iframe');
      var container = document.createElement('div');
      container.id = 'omniai-widget-container';
      container.style.marginTop = '20px';
      container.style.marginBottom = '40px';
      container.style.width = '100%';
      container.style.clear = 'both';
      
      var iframe = document.createElement('iframe');
      iframe.src = '${widgetUrl}';
      iframe.style.width = '100%';
      iframe.style.height = '600px';
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      iframe.style.borderRadius = '12px';
      iframe.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
      
      container.appendChild(iframe);
      
      // Insert after the target if possible
      if (renderTarget.parentNode) {
          renderTarget.parentNode.insertBefore(container, renderTarget.nextSibling);
      } else {
          renderTarget.appendChild(container);
      }
      return true;
    }
    
    return false;
  }

  // Attempt immediately
  if (!initWidget()) {
    console.log('OmniAI Widget: Target not found yet, starting polling...');
    // If not found, poll the DOM (for SPAs or async loading)
    var attempts = 0;
    var interval = setInterval(function() {
      attempts++;
      if (initWidget() || attempts > 20) { // Try for 10 seconds (20 * 500ms)
        if (attempts > 20 && !document.getElementById('omniai-widget-container')) {
           console.log('OmniAI Widget: Giving up on finding target, injecting to body');
           var bodyTarget = document.body;
           if(bodyTarget) {
               // Fallback: just append it somewhere visible
               var container = document.createElement('div');
               container.id = 'omniai-widget-container';
               container.style.position = 'fixed';
               container.style.bottom = '20px';
               container.style.right = '20px';
               container.style.width = '400px';
               container.style.height = '600px';
               container.style.zIndex = '999999';
               container.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
               container.style.borderRadius = '12px';
               container.style.overflow = 'hidden';
               container.style.backgroundColor = '#ffffff';
               
               var iframe = document.createElement('iframe');
               iframe.src = '${widgetUrl}';
               iframe.style.width = '100%';
               iframe.style.height = '100%';
               iframe.style.border = 'none';
               
               container.appendChild(iframe);
               bodyTarget.appendChild(container);
           }
        }
        clearInterval(interval);
      }
    }, 500);
  }
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
    
    // Pre-fetch all books to build a map of book_id -> book_slug
    const bookIdToSlug: Record<number, string> = {};
    try {
      let booksOffset = 0;
      let booksLimit = 100;
      let hasMoreBooks = true;
      while (hasMoreBooks) {
        const booksResponse = await fetch(`${url.replace(/\/$/, '')}/api/books?count=${booksLimit}&offset=${booksOffset}`, {
          headers: {
            'Authorization': `Token ${id}:${secret}`
          }
        });
        if (!booksResponse.ok) {
          console.error(`Failed to fetch BookStack books: ${booksResponse.statusText}`);
          break;
        }
        const booksData = await booksResponse.json();
        const booksList = booksData.data || [];
        for (const book of booksList) {
          if (book.id && book.slug) {
            bookIdToSlug[book.id] = book.slug;
          }
        }
        if (booksOffset + booksLimit >= (booksData.total || 0) || booksList.length === 0) {
          hasMoreBooks = false;
        } else {
          booksOffset += booksLimit;
        }
      }
    } catch (err) {
      console.error("Error pre-fetching BookStack books for slug map:", err);
    }

    // Store lightweight indices (title + link only)
    for (const page of allPages) {
      let pageUrl = '';
      const bookSlug = bookIdToSlug[page.book_id];
      if (bookSlug) {
        pageUrl = `${url.replace(/\/$/, '')}/books/${bookSlug}/page/${page.slug || page.id}`;
      } else if (page.url) {
        try {
          const urlObj = new URL(page.url);
          pageUrl = `${url.replace(/\/$/, '')}${urlObj.pathname}`;
        } catch (e) {
          const path = page.url.startsWith('/') ? page.url : `/${page.url}`;
          pageUrl = `${url.replace(/\/$/, '')}${path}`;
        }
      } else {
        pageUrl = `${url.replace(/\/$/, '')}/books/${page.book_id}/page/${page.slug || page.id}`;
      }

      knowledgeBase.push({
        id: `bookstack-${page.id}`,
        title: page.name,
        content: `BookStack Article ID: ${page.id}. Read more at: ${pageUrl}`,
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

// Omnidesk ticket learning endpoint
app.post("/api/admin/tickets/learn", requireAuth, async (req, res) => {
  const { periodDays = 30, limit = 5 } = req.body;
  logAnalytics('api_call', { endpoint: '/api/admin/tickets/learn', periodDays, limit });

  const hasConfig = settings.omnidesk_domain && settings.omnidesk_api_key && settings.omnidesk_email;

  if (!hasConfig) {
    // Demo / Fallback Mode when Omnidesk is not configured
    console.log("[Ticket Learning] Omnidesk not configured. Running in Demo Mode.");
    
    const demoTickets = [
      {
        id: "demo-t1",
        subject: "Проблема с подключением к SCADA серверу",
        messages: [
          { role: "CLIENT", text: "Здравствуйте! Не могу подключиться к SCADA серверу iRidi со смартфона. Пишет ошибку Connection Refused. На самом сервере всё запущено." },
          { role: "STAFF", text: "Добрый день! Проверьте, разрешен ли порт 8000 (или тот, который вы указали в настройках) в брандмауэре операционной системы сервера. Также убедитесь, что смартфон находится в той же локальной сети, либо настроен проброс портов на роутере." },
          { role: "CLIENT", text: "Да, действительно брандмауэр блокировал порт 8000. Отключил или добавил правило — теперь всё подключается моментально! Спасибо!" }
        ]
      },
      {
        id: "demo-t2",
        subject: "Сброс пароля от учетной записи девелопера",
        messages: [
          { role: "CLIENT", text: "Привет! Забыл пароль от кабинета разработчика iRidi. Ссылка на сброс не приходит на почту dev@company.com. Что делать?" },
          { role: "STAFF", text: "Приветствую! Проверьте папку 'Спам' или 'Рассылки'. Если письма там нет, возможно ваш почтовый сервер блокирует наши домены iridi.com. Мы отправили вам временный пароль вручную. Смените его в профиле сразу после входа." },
          { role: "CLIENT", text: "Нашел в спаме! Спасибо за оперативный ответ, временный пароль подошел, сменил на свой." }
        ]
      },
      {
        id: "demo-t3",
        subject: "Таймаут опроса Modbus устройств",
        messages: [
          { role: "CLIENT", text: "При опросе модулей Modbus RTU через шлюз iRidi UMC часто возникают ошибки таймаута в логах. Период опроса стоит 100мс." },
          { role: "STAFF", text: "Здравствуйте! Период опроса 100мс слишком мал для шины RS-485, особенно если на ней висит несколько устройств. Рекомендуется увеличить период опроса (Poll Interval) до 500-1000мс и убедиться, что установлены согласующие резисторы 120 Ом на концах линии." },
          { role: "CLIENT", text: "Поставил 800мс и доставил терминаторы — ошибки полностью пропали! Спасибо за совет." }
        ]
      }
    ];

    const results = [];
    const pool = getApiKeysPool();
    
    for (const ticket of demoTickets) {
      try {
        const prompt = `
          Проанализируй следующий тикет поддержки и составь на его основе качественную статью для Базы Знаний.
          Статья должна содержать Краткое описание проблемы и Пошаговое решение.
          
          Тема тикета: ${ticket.subject}
          Диалог:
          ${ticket.messages.map(m => `${m.role}: ${m.text}`).join('\n')}
          
          Верни ответ в формате JSON:
          {
            "title": "Краткое техническое название проблемы",
            "content": "Подробное описание проблемы и пошаговая инструкция по решению."
          }
        `;
        
        let title = `Решение: ${ticket.subject}`;
        let content = ticket.messages.map(m => `${m.role}: ${m.text}`).join('\n\n');
        
        if (pool.length > 0) {
          try {
            const activeAi = new GoogleGenAI({ apiKey: pool[0] });
            const response = await activeAi.models.generateContent({
              model: settings.model_name,
              contents: prompt,
              config: { responseMimeType: 'application/json' }
            });
            const text = response.text || '{}';
            const parsed = JSON.parse(text);
            if (parsed.title) title = parsed.title;
            if (parsed.content) content = parsed.content;
          } catch (llmErr) {
            console.error("LLM Generation in Demo Learn failed, using local generation fallback:", llmErr);
          }
        }
        
        const newItem: KnowledgeBaseItem = {
          id: `learned-demo-${ticket.id}`,
          title: title,
          content: content,
          tags: ['learned-ticket', 'demo-case']
        };
        
        const existingIdx = knowledgeBase.findIndex(item => item.id === newItem.id);
        if (existingIdx !== -1) {
          knowledgeBase[existingIdx] = newItem;
        } else {
          knowledgeBase.push(newItem);
        }
        results.push(newItem);
      } catch (err) {
        console.error("Error analyzing demo ticket:", err);
      }
    }
    
    saveData();
    // Simulate real network delay for UX satisfaction
    await new Promise(resolve => setTimeout(resolve, 2000));
    return res.json({ success: true, count: results.length, isDemo: true, items: results });
  }

  // Real Omnidesk integration mode
  try {
    const domain = settings.omnidesk_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const auth = Buffer.from(`${settings.omnidesk_email}:${settings.omnidesk_api_key}`).toString('base64');

    console.log(`[Ticket Learning] Fetching cases from https://${domain}/api/cases.json`);
    const casesRes = await fetch(`https://${domain}/api/cases.json?limit=50`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!casesRes.ok) {
      const errText = await casesRes.text();
      throw new Error(`Omnidesk API returned ${casesRes.status}: ${errText}`);
    }

    const casesData = await casesRes.json();
    let casesArray: any[] = [];
    if (Array.isArray(casesData)) {
      casesArray = casesData;
    } else if (typeof casesData === 'object' && casesData !== null) {
      casesArray = Object.values(casesData).filter((v: any) => v && v.case);
    }

    // Filter closed/resolved cases
    const eligibleCases = casesArray
      .map((c: any) => c.case || c)
      .filter((c: any) => {
        const isResolved = c.status === 'resolved' || c.status === 'closed';
        if (!isResolved) return false;
        
        // Filter by date
        const createdAt = new Date(c.created_at);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - periodDays);
        return createdAt >= cutoffDate;
      })
      .slice(0, limit); // Respect limit

    console.log(`[Ticket Learning] Found ${eligibleCases.length} eligible resolved cases within ${periodDays} days.`);

    const results = [];
    const pool = getApiKeysPool();

    for (const kase of eligibleCases) {
      const caseId = kase.case_id;
      const caseNumber = kase.case_number;
      
      // Fetch messages
      const msgsRes = await fetch(`https://${domain}/api/cases/${caseId}/messages.json`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (!msgsRes.ok) continue;

      const msgsData = await msgsRes.json();
      let msgsArray: any[] = [];
      if (Array.isArray(msgsData)) {
        msgsArray = msgsData;
      } else if (msgsData._embedded?.messages) {
        msgsArray = msgsData._embedded.messages;
      } else if (typeof msgsData === 'object' && msgsData !== null) {
        msgsArray = Object.values(msgsData).filter((v: any) => v && (v.message || v));
      }

      const dialogue = msgsArray.map((m: any) => {
        const msg = m.message || m;
        const text = msg.content_html ? msg.content_html.replace(/<[^>]+>/g, '') : (msg.content || '');
        return `${msg.user_id ? 'CLIENT' : 'STAFF'}: ${text}`;
      }).join('\n\n');

      let title = `Решение тикета #${caseNumber}: ${kase.subject}`;
      let content = dialogue;

      if (pool.length > 0 && dialogue.trim().length > 50) {
        try {
          const prompt = `
            Проанализируй диалог технической поддержки и сформируй на его основе полезную статью для Базы Знаний.
            Выдели ключевую проблему клиента и итоговое решение, которое помогло.
            Избегай лишней вежливости и приветствий, пиши кратко и по делу.
            
            Тема: ${kase.subject}
            История обращений:
            ${dialogue}
            
            Выведи строго валидный JSON в формате:
            {
              "title": "Понятное и емкое техническое название проблемы",
              "content": "Суть проблемы и конкретные шаги, которые привели к решению."
            }
          `;

          const activeAi = new GoogleGenAI({ apiKey: pool[0] });
          const response = await activeAi.models.generateContent({
            model: settings.model_name,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
          });
          const text = response.text || '{}';
          const parsed = JSON.parse(text);
          if (parsed.title) title = parsed.title;
          if (parsed.content) content = parsed.content;
        } catch (err) {
          console.error(`[Ticket Learning] Failed to use LLM for case ${caseNumber}:`, err);
        }
      }

      const newItem: KnowledgeBaseItem = {
        id: `learned-ticket-${caseNumber}`,
        title: title,
        content: content,
        tags: ['learned-ticket', `case-${caseNumber}`]
      };

      // Push and update
      const existingIdx = knowledgeBase.findIndex(item => item.id === newItem.id);
      if (existingIdx !== -1) {
        knowledgeBase[existingIdx] = newItem;
      } else {
        knowledgeBase.push(newItem);
      }
      results.push(newItem);
    }

    saveData();
    res.json({ success: true, count: results.length, isDemo: false, items: results });
  } catch (error: any) {
    console.error("Real Ticket Learning Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/knowledge-base", requireAuth, (req, res) => {
  const newItem = { id: Math.random().toString(36).substr(2, 9), ...req.body };
  knowledgeBase.push(newItem);
  saveData();
  res.json(newItem);
});

app.post("/api/knowledge-base/scrape", requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText} (${response.status})`);
    }
    const html = await response.text();

    // Extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : url;
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean html body content
    let bodyText = html;
    bodyText = bodyText.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
    bodyText = bodyText.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
    bodyText = bodyText.replace(/<!--([\s\S]*?)-->/g, '');
    bodyText = bodyText.replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<\/tr>/gi, '\n');
    bodyText = bodyText.replace(/<[^>]*>/g, ' ');
    bodyText = bodyText
      .replace(/&nbsp;/g, ' ')
      .replace(/\r\n|\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();

    // Limit length to avoid too large prompts
    const maxLen = 15000;
    const content = bodyText.length > maxLen ? bodyText.substring(0, maxLen) + "\n\n[Content truncated due to length limits...]" : bodyText;

    const newItem = {
      id: `link-${Math.random().toString(36).substr(2, 9)}`,
      title: title || `Imported URL: ${url}`,
      content: `Source Link: ${url}\n\n${content}`,
      tags: ['link', 'imported']
    };

    knowledgeBase.push(newItem);
    saveData();

    res.json(newItem);
  } catch (error: any) {
    console.error("Scraping Error:", error);
    res.status(500).json({ error: error.message });
  }
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
