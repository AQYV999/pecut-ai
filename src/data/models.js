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
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)', isFree: true },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Latest Gen)', isFree: true },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (Fast)', isFree: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Reasoning)', isFree: false },
      { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro (Deep Reasoning)', isFree: false },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isFree: true },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', isFree: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Stable)', isFree: true },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', isFree: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', isFree: false }
    ],
    placeholder: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Ultra Fast Inference',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', isFree: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', isFree: true },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', isFree: true }
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
