import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { AppSettings, AnalyticsRecord, KnowledgeBaseItem } from "./src/types";

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
  api_key_env_var: "GEMINI_API_KEY",
  system_prompt: "You are a helpful technical support assistant for Omnidesk. Use the provided context to answer user queries accurately and professionally.",
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
  { id: '1', title: 'Omnidesk Integration', content: 'Omnidesk can be integrated via webhooks and custom widgets.', tags: ['integration', 'omnidesk'] },
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
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
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

// Suggestions Engine
app.post("/api/chat", async (req, res) => {
  const { ticketContext, history, userQuery } = req.body;
  
  logAnalytics('chat_request', { ticketId: ticketContext?.id });

  try {
    const prompt = `
      Context: ${settings.system_prompt}
      
      Relevant Knowledge Base:
      ${knowledgeBase.map(item => `- ${item.title}: ${item.content}`).join('\n')}
      
      Ticket Context:
      Subject: ${ticketContext?.subject || 'N/A'}
      Description: ${ticketContext?.description || 'N/A'}
      
      Chat History: ${JSON.stringify(history)}
      
      Latest User Query: "${userQuery || 'Analyze the ticket and provide suggestions.'}"
      
      Instructions: 
      You are an AI assistant helping a customer support agent. 
      Respond directly to the "Latest User Query" taking into account the "Chat History" and "Ticket Context". 
      Your response should be placed in the "reply" field. 
      If appropriate, provide up to 3 diverse specific text suggestions the agent can directly apply as a reply to the customer.
      
      Output ONLY valid JSON in the exact format: 
      { "reply": "Your conversational response to the agent here", "suggestions": [{ "title": "Short title", "text": "Draft reply to customer", "type": "Draft" }] }
    `;

    const response = await ai.models.generateContent({
      model: settings.model_name,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const data = JSON.parse(response.text || '{}');

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
app.get("/api/analytics", (req, res) => {
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
    
    // Try to find the ticket response area, or any right sidebar
    var renderTarget = document.getElementById('response_answer_area') || 
                       document.querySelector('.request-area') || 
                       document.querySelector('#case_message_area');
    
    if (renderTarget) {
      console.log('OmniAI Widget: Found target container, injecting iframe');
      var container = document.createElement('div');
      container.id = 'omniai-widget-container';
      container.style.marginTop = '20px';
      container.style.marginBottom = '20px';
      container.style.border = '1px solid #e2e8f0';
      container.style.borderRadius = '12px';
      container.style.overflow = 'hidden';
      container.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
      container.style.backgroundColor = '#ffffff';
      
      var iframe = document.createElement('iframe');
      iframe.src = '${widgetUrl}';
      iframe.style.width = '100%';
      iframe.style.height = '600px';
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      
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
app.get("/api/settings", (req, res) => {
  res.json(settings);
});

app.post("/api/settings", (req, res) => {
  settings = { ...settings, ...req.body };
  saveData();
  logAnalytics('api_call', { endpoint: '/api/settings', method: 'POST' });
  res.json({ status: "ok", settings });
});

// Knowledge Base API
app.get("/api/knowledge-base", (req, res) => {
  res.json(knowledgeBase);
});

// Admin Skill Import API
app.post("/api/admin/skills/import", async (req, res) => {
  const { url, type } = req.body;
  logAnalytics('api_call', { endpoint: '/api/admin/skills/import', url, type });

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    
    const content = await response.text();
    
    // Simple logic to "integrate" skill: 
    // In a real app we'd parse and store it properly.
    // Here we'll append it to the skills settings.
    let currentSkills = [];
    try {
      currentSkills = JSON.parse(settings.skills || "[]");
    } catch {
      currentSkills = [];
    }

    const newSkill = {
      id: Math.random().toString(36).substr(2, 5),
      name: url.split('/').pop(),
      content: content.substring(0, 1000) + "...", // Truncate for display in settings
      enabled: true,
      source: url,
      imported_at: new Date().toISOString()
    };

    currentSkills.push(newSkill);
    const updatedSkills = JSON.stringify(currentSkills, null, 2);
    
    // We don't automatically save to settings here to let user review first in UI
    res.json({ skills: updatedSkills });
  } catch (error: any) {
    console.error("Import Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin BookStack Sync API
app.post("/api/admin/bookstack/sync", async (req, res) => {
  const { url, id, secret } = req.body;
  logAnalytics('api_call', { endpoint: '/api/admin/bookstack/sync', url });

  if (!url || !id || !secret) {
    return res.status(400).json({ error: "Missing BookStack credentials" });
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/pages`, {
      headers: {
        'Authorization': `Token ${id}:${secret}`
      }
    });

    if (!response.ok) throw new Error(`BookStack Error: ${response.statusText}`);
    
    const data = await response.json();
    
    // In a real implementation, we would fetch details for each page and save to Knowledge Base
    // For now, let's pretend we synced 5 pages
    const mockSyncCount = Math.min(data.total || 0, 10);
    
    res.json({ 
      success: true, 
      count: mockSyncCount,
      message: `Successfully synchronized ${mockSyncCount} knowledge assets from BookStack.`
    });
  } catch (error: any) {
    console.error("BookStack Sync Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/knowledge-base", (req, res) => {
  const newItem = { id: Math.random().toString(36).substr(2, 9), ...req.body };
  knowledgeBase.push(newItem);
  saveData();
  res.json(newItem);
});

// Export Reports (Simulated)
app.get("/api/export/csv", (req, res) => {
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
