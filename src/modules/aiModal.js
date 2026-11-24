/**
 * Pecut AI — AI Connection & BYOK Modal Controller
 * Apache-2.0 License
 */

import { PROVIDER_PRESETS } from '../data/models.js';
import {
  loadBYOKConfig,
  saveBYOKConfig,
  clearBYOKConfig,
  getProviderProfile,
  loadProviderProfiles
} from './storage.js';
import { testAIConnection, getActiveProviderInfo, fetchProviderModels } from '../services/ai/client.js';
import { showToast, escapeHtml } from '../utils/helpers.js';

let activeDraftProvider = 'openrouter';
let draftProfiles = {};

const PROVIDER_OPTION_LABELS = {
  openrouter: 'OpenRouter (Free & Multi-Model)',
  gemini: 'Google Gemini (Google AI Studio)',
  groq: 'Groq Cloud (Ultra Fast)',
  openai: 'OpenAI (GPT-4o / Mini)',
  kilo: 'Kilo Gateway (Multi-Model & Routing)',
  nvidia: 'NVIDIA NIM (Ultra Compute)',
  ninerouter: '9Router (Local Gateway / Tunnel)',
  custom: 'Custom / Local (Ollama, LMStudio)'
};

function refreshProviderDropdownBadges() {
  const providerSelect = document.getElementById('byokProviderSelect');
  if (!providerSelect) return;
  const savedProfiles = loadProviderProfiles();

  Array.from(providerSelect.options).forEach(opt => {
    const id = opt.value;
    const baseLabel = PROVIDER_OPTION_LABELS[id] || opt.textContent.replace(/\s*\[Tersimpan ✓\]$/, '');
    const saved = savedProfiles[id];
    const hasSavedCreds = Boolean(saved && (saved.apiKey || (id === 'ninerouter' && saved.baseUrl !== PROVIDER_PRESETS.ninerouter.baseUrl)));
    opt.textContent = hasSavedCreds ? `${baseLabel} [Tersimpan ✓]` : baseLabel;
  });
}

function captureCurrentDraft() {
  const baseUrlInput = document.getElementById('byokBaseUrlInput');
  const apiKeyInput = document.getElementById('byokApiKeyInput');
  const modelInput = document.getElementById('byokModelInput');
  if (!activeDraftProvider) return;

  draftProfiles[activeDraftProvider] = {
    provider: activeDraftProvider,
    baseUrl: (baseUrlInput?.value || '').trim(),
    apiKey: (apiKeyInput?.value || '').trim(),
    model: (modelInput?.value || '').trim()
  };
}

function applyProviderProfileToForm(providerId) {
  const preset = PROVIDER_PRESETS[providerId] || PROVIDER_PRESETS.openrouter;
  const profile = draftProfiles[providerId] || getProviderProfile(providerId);

  const baseUrlInput = document.getElementById('byokBaseUrlInput');
  const apiKeyInput = document.getElementById('byokApiKeyInput');
  const modelInput = document.getElementById('byokModelInput');
  const docsLink = document.getElementById('byokGetDocsLink');
  const testStatus = document.getElementById('byokTestStatus');

  if (baseUrlInput) baseUrlInput.value = profile.baseUrl || preset.baseUrl;
  if (apiKeyInput) {
    apiKeyInput.value = profile.apiKey || '';
    apiKeyInput.placeholder = preset.placeholder;
    apiKeyInput.type = 'password';
  }
  if (modelInput) modelInput.value = profile.model || preset.defaultModel;
  if (docsLink) {
    docsLink.href = preset.docsUrl;
    docsLink.textContent = `Get ${preset.name} Key ↗`;
  }
  if (testStatus) {
    testStatus.textContent = '';
    testStatus.className = 'test-status-text';
  }

  renderModelPresets(providerId, profile.model || preset.defaultModel);
  updateLocalTip(providerId, profile.baseUrl || preset.baseUrl);
}

function updateLocalTip(provider, baseUrl) {
  const tipEl = document.getElementById('byokLocalTip');
  if (!tipEl) return;
  const isLocal = provider === 'ninerouter' || provider === 'custom' || (baseUrl && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')));
  if (isLocal) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isHttps) {
      tipEl.innerHTML = `⚠️ <strong>Penting (Web HTTPS Vercel):</strong> Browser memblokir <code>http://localhost</code> karena proteksi Mixed Content.
      <br>• <strong>Solusi 1 (Rekomendasi):</strong> Aktifkan <strong>Tunnel</strong> di dasbor 9Router (klik tombol power Tunnel) lalu masukkan URL HTTPS tunnel-nya ke kolom ini.
      <br>• <strong>Solusi 2:</strong> Jalankan Pecut AI di komputer Anda: <code>npm run dev</code> lalu buka <code>http://localhost:5173</code> (dapat langsung terhubung ke 9Router tanpa tunnel).`;
    } else {
      tipEl.innerHTML = `💡 <strong>Koneksi Lokal:</strong> Pecut AI berjalan di <code>http://localhost</code>, sehingga dapat langsung terhubung ke 9Router di <code>http://localhost:20128/v1</code>!`;
    }
    tipEl.style.display = 'block';
  } else {
    tipEl.style.display = 'none';
  }
}

export function updateTopbarAIStatus() {
  const info = getActiveProviderInfo();
  const apiStatusEl = document.getElementById('apiStatusText');
  const dotEl = document.querySelector('.api-status-badge .status-dot');

  if (apiStatusEl) {
    if (info.hasKey) {
      apiStatusEl.textContent = `${info.name} (${info.model.split('/').pop().replace(':free', '')})`;
      if (dotEl) dotEl.style.backgroundColor = '#10b981';
    } else {
      apiStatusEl.textContent = 'Demo Engine (BYOK Ready)';
      if (dotEl) dotEl.style.backgroundColor = '#f59e0b';
    }
  }

  const settingsSummary = document.getElementById('settingsActiveProviderSummary');
  if (settingsSummary) {
    if (info.hasKey) {
      settingsSummary.innerHTML = `Active Provider: <strong>${escapeHtml(info.name)}</strong> • Model: <code>${escapeHtml(info.model)}</code>`;
    } else {
      settingsSummary.innerHTML = 'Active: <em>Demo Engine (No key configured — Click to connect OpenRouter / Gemini / Groq)</em>';
    }
  }
}

export function renderModelPresets(providerId, currentModel, customModels = null) {
  const container = document.getElementById('byokModelPresets');
  if (!container) return;

  const preset = PROVIDER_PRESETS[providerId] || PROVIDER_PRESETS.openrouter;
  const models = customModels || preset.models || [];

  container.innerHTML = models.map(m => {
    const isSelected = m.id === currentModel;
    return `
      <button type="button" class="model-pill ${isSelected ? 'active' : ''}" data-model-id="${escapeHtml(m.id)}">
        <span>${escapeHtml(m.name)}</span>
        ${m.isFree ? '<span class="pill-free-tag">Free</span>' : ''}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.model-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const modelId = pill.getAttribute('data-model-id');
      const modelInput = document.getElementById('byokModelInput');
      if (modelInput) modelInput.value = modelId;

      container.querySelectorAll('.model-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
}

export function openAIModal() {
  const modal = document.getElementById('aiConnectionModal');
  if (!modal) return;

  draftProfiles = {};
  const config = loadBYOKConfig();
  activeDraftProvider = config.provider || 'openrouter';

  refreshProviderDropdownBadges();

  const providerSelect = document.getElementById('byokProviderSelect');
  if (providerSelect) providerSelect.value = activeDraftProvider;

  applyProviderProfileToForm(activeDraftProvider);
  modal.classList.add('active');
}

export function closeAIModal() {
  const modal = document.getElementById('aiConnectionModal');
  if (modal) modal.classList.remove('active');
}

export function initAIModal() {
  const badgeBtn = document.getElementById('apiStatusBadge');
  if (badgeBtn) badgeBtn.addEventListener('click', openAIModal);

  const openSettingsBtn = document.getElementById('openByokModalBtn');
  if (openSettingsBtn) openSettingsBtn.addEventListener('click', openAIModal);

  const closeBtn = document.getElementById('closeAIModalBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeAIModal);

  const cancelBtn = document.getElementById('byokCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeAIModal);

  // Toggle API key mask/unmask
  const toggleKeyBtn = document.getElementById('byokToggleKeyBtn');
  const apiKeyInput = document.getElementById('byokApiKeyInput');
  if (toggleKeyBtn && apiKeyInput) {
    toggleKeyBtn.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });
  }

  // Base URL input listener for live tip
  const baseUrlInput = document.getElementById('byokBaseUrlInput');
  const providerSelect = document.getElementById('byokProviderSelect');
  if (baseUrlInput && providerSelect) {
    baseUrlInput.addEventListener('input', () => {
      updateLocalTip(providerSelect.value, baseUrlInput.value);
    });
  }

  // Provider change handler (isolated per-provider profile switching)
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      captureCurrentDraft();
      const selected = providerSelect.value;
      activeDraftProvider = selected;
      applyProviderProfileToForm(selected);
    });
  }

  // Fetch live active models button
  const fetchModelsBtn = document.getElementById('byokFetchModelsBtn');
  if (fetchModelsBtn) {
    fetchModelsBtn.addEventListener('click', async () => {
      const provider = document.getElementById('byokProviderSelect')?.value || 'openrouter';
      const baseUrl = (document.getElementById('byokBaseUrlInput')?.value || '').trim();
      const apiKey = (document.getElementById('byokApiKeyInput')?.value || '').trim();
      const statusEl = document.getElementById('byokTestStatus');

      if (!apiKey && provider !== 'custom' && provider !== 'ninerouter') {
        if (statusEl) {
          statusEl.textContent = 'Please enter an API key first to query live models.';
          statusEl.className = 'test-status-text error';
        }
        return;
      }

      const origText = fetchModelsBtn.textContent;
      fetchModelsBtn.disabled = true;
      fetchModelsBtn.textContent = 'Fetching...';
      if (statusEl) {
        statusEl.textContent = 'Querying active models from provider...';
        statusEl.className = 'test-status-text';
      }

      try {
        const liveModels = await fetchProviderModels({ provider, baseUrl, apiKey });
        if (liveModels && liveModels.length > 0) {
          // Render the top chat-friendly models
          renderModelPresets(provider, document.getElementById('byokModelInput')?.value, liveModels.slice(0, 16));
          if (statusEl) {
            statusEl.textContent = `Found ${liveModels.length} active models! Click any pill above to select.`;
            statusEl.className = 'test-status-text success';
          }
          showToast(`Loaded ${liveModels.length} models from ${provider}!`);
        } else {
          throw new Error('No models found on this account.');
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = `Failed to fetch models: ${err.message}`;
          statusEl.className = 'test-status-text error';
        }
      } finally {
        fetchModelsBtn.disabled = false;
        fetchModelsBtn.textContent = origText;
      }
    });
  }

  // Test connection button
  const testBtn = document.getElementById('byokTestBtn');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const provider = document.getElementById('byokProviderSelect')?.value || 'openrouter';
      const baseUrl = (document.getElementById('byokBaseUrlInput')?.value || '').trim();
      const apiKey = (document.getElementById('byokApiKeyInput')?.value || '').trim();
      const model = (document.getElementById('byokModelInput')?.value || '').trim();
      const statusEl = document.getElementById('byokTestStatus');

      if (!apiKey && provider !== 'custom' && provider !== 'ninerouter') {
        if (statusEl) {
          statusEl.textContent = 'Please enter an API key first.';
          statusEl.className = 'test-status-text error';
        }
        return;
      }

      const origHtml = testBtn.innerHTML;
      testBtn.disabled = true;
      testBtn.innerHTML = '<span>Testing...</span>';
      if (statusEl) {
        statusEl.textContent = 'Probing AI endpoint...';
        statusEl.className = 'test-status-text';
      }

      const testResult = await testAIConnection({
        provider,
        baseUrl,
        apiKey,
        model
      });

      testBtn.disabled = false;
      testBtn.innerHTML = origHtml;

      if (statusEl) {
        statusEl.textContent = testResult.message;
        statusEl.className = testResult.success ? 'test-status-text success' : 'test-status-text error';
      }
    });
  }

  // Save button
  const saveBtn = document.getElementById('byokSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const prevConfig = loadBYOKConfig();
      const provider = document.getElementById('byokProviderSelect')?.value || 'openrouter';
      const baseUrl = (document.getElementById('byokBaseUrlInput')?.value || '').trim();
      const apiKey = (document.getElementById('byokApiKeyInput')?.value || '').trim();
      const model = (document.getElementById('byokModelInput')?.value || '').trim();
      const startFreshChat = document.getElementById('byokStartFreshChatCheckbox')?.checked !== false;

      const modelChanged = prevConfig.provider !== provider || prevConfig.model !== model;

      saveBYOKConfig({ provider, baseUrl, apiKey, model });
      draftProfiles = {};
      refreshProviderDropdownBadges();
      updateTopbarAIStatus();
      closeAIModal();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pecut:ai-config-changed', {
          detail: {
            prevConfig,
            nextConfig: { provider, baseUrl, apiKey, model },
            modelChanged,
            startFreshChat
          }
        }));
      }

      if (!modelChanged || !startFreshChat) {
        showToast(`Profil ${PROVIDER_PRESETS[provider]?.name || provider} berhasil disimpan!`);
      }
    });
  }

  // Clear button (clears only the selected provider profile, keeping other providers intact)
  const clearBtn = document.getElementById('byokClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const selected = document.getElementById('byokProviderSelect')?.value || activeDraftProvider;
      const providerName = PROVIDER_PRESETS[selected]?.name || selected;
      if (confirm(`Hapus API Key & pengaturan tersimpan khusus untuk ${providerName}? (Profil provider lain tidak akan terhapus)`)) {
        delete draftProfiles[selected];
        clearBYOKConfig(selected);
        refreshProviderDropdownBadges();
        applyProviderProfileToForm(selected);
        updateTopbarAIStatus();
        showToast(`Profil & API Key ${providerName} telah dihapus.`);
      }
    });
  }

  // Initial status paint
  updateTopbarAIStatus();
}

// Window attachment for inline clicks
if (typeof window !== 'undefined') {
  window.openAIModal = openAIModal;
  window.closeAIModal = closeAIModal;
}
