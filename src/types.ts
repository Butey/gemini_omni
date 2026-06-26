/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  user_id: string;
  user_name: string;
  status: string;
  priority: string;
  created_at: string;
  channel: string;
}

export interface Suggestion {
  id: string;
  text: string;
  model: string;
  confidence: number;
  created_at: string;
}

export interface AnalyticsRecord {
  id: string;
  action: 'suggestion_generated' | 'suggestion_applied' | 'suggestion_rejected' | 'api_call' | 'chat_request';
  metadata: any;
  timestamp: string;
}

export interface KnowledgeBaseItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

export interface CustomModelConfig {
  id: string;
  name: string;
  base_url: string;
  model_id: string;
  api_key: string;
}

export interface AppSettings {
  llm_endpoint: string;
  model_name: string;
  custom_models?: string;
  api_key: string;
  system_prompt: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  skills: string;
  mcp_servers: string;
  context_files: string;
  skill_import_url: string;
  skill_repo_url: string;
  bookstack_url: string;
  bookstack_token_id: string;
  bookstack_token_secret: string;
  omnidesk_api_key: string;
  omnidesk_email: string;
  enable_context: boolean;
  notification_channels: {
    telegram: { enabled: boolean; chat_id: string };
    gotify: { enabled: boolean; url: string };
  };
  theme: 'light' | 'dark';
  language: 'ru' | 'en';
  quick_actions?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
  email: string;
}
