/**
 * Pecut AI — Provider Presets & AI Model Definitions
 * Apache-2.0 License
 */

export const PROVIDER_PRESETS = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: 'Popular & Multi-Model',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', isFree: true },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', isFree: true },
      { id: 'mistralai/mistral-small-24b-instruct-2501:free', name: 'Mistral Small 24B (Free)', isFree: true },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', isFree: false },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', isFree: false }
    ],
    placeholder: 'sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://openrouter.ai/keys'
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Google AI Studio',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.8-flash',
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Active Standard)', isFree: true }
    ],
    placeholder: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Ultra Fast Inference',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'qwen/qwen3.8-27b',
    models: [
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (High Speed)', isFree: true },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', isFree: true },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', isFree: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', isFree: true }
    ],
    placeholder: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://console.groq.com/keys'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    badge: 'Standard API',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', isFree: false },
      { id: 'gpt-4o', name: 'GPT-4o', isFree: false }
    ],
    placeholder: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  kilo: {
    id: 'kilo',
    name: 'Kilo Gateway (Multi-Model & Routing)',
    badge: 'Universal AI Gateway',
    baseUrl: 'https://api.kilo.ai/api/gateway',
    defaultModel: 'kilo-auto/balanced',
    models: [
      { id: 'kilo-auto/balanced', name: 'Auto Balanced (Smart Routing)', isFree: false },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', isFree: false },
      { id: 'openai/gpt-4o', name: 'GPT-4o', isFree: false },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', isFree: false },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', isFree: false }
    ],
    placeholder: 'kilo_xxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://kilo.ai'
  },
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM (Ultra Compute)',
    badge: 'NVIDIA AI Foundation',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (Free Tier)', isFree: true },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B (High Reasoning)', isFree: true },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 (Thinking)', isFree: true },
      { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', isFree: true },
      { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B Instruct', isFree: true }
    ],
    placeholder: 'nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://build.nvidia.com'
  },
  ninerouter: {
    id: 'ninerouter',
    name: '9Router (Local Gateway / Tunnel)',
    badge: 'Local Gateway / Tunnel',
    baseUrl: 'http://localhost:20128/v1',
    defaultModel: 'VibeCoding',
    models: [
      { id: 'VibeCoding', name: 'VibeCoding (Default Combo)', isFree: true },
      { id: 'combo-mletre', name: 'Combo Mletre (Vision+Doc)', isFree: true },
      { id: 'groq/qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq)', isFree: true },
      { id: 'af/llama-instant', name: 'Llama Instant', isFree: true }
    ],
    placeholder: 'sk-... (from 9Router Dashboard: Titik Akhir & Kunci)',
    docsUrl: 'http://localhost:20128/dashboard/endpoint'
  },
  custom: {
    id: 'custom',
    name: 'Custom / Local (Ollama, LMStudio, vLLM)',
    badge: 'Self-Hosted / Local',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3:latest',
    models: [
      { id: 'llama3:latest', name: 'Ollama: llama3:latest', isFree: true },
      { id: 'mistral:latest', name: 'Ollama: mistral:latest', isFree: true },
      { id: 'qwen2.5:latest', name: 'Ollama: qwen2.5:latest', isFree: true }
    ],
    placeholder: 'Optional API Key (or empty for Ollama)',
    docsUrl: 'https://ollama.com'
  }
};
