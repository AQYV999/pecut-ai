/**
 * Pecut AI — AI Connection & BYOK Modal Controller
 * Apache-2.0 License
 */

import { PROVIDER_PRESETS } from '../data/models.js';
import { loadBYOKConfig, saveBYOKConfig, clearBYOKConfig } from './storage.js';
import { testAIConnection, getActiveProviderInfo, fetchProviderModels } from '../services/ai/client.js';
import { showToast, escapeHtml } from '../utils/helpers.js';

let activeDraftProvider = 'openrouter';

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

  const config = loadBYOKConfig();
  activeDraftProvider = config.provider || 'openrouter';

  const providerSelect = document.getElementById('byokProviderSelect');
  const baseUrlInput = document.getElementById('byokBaseUrlInput');
  const apiKeyInput = document.getElementById('byokApiKeyInput');
  const modelInput = document.getElementById('byokModelInput');
  const docsLink = document.getElementById('byokGetDocsLink');
  const testStatus = document.getElementById('byokTestStatus');

  if (testStatus) {
    testStatus.textContent = '';
    testStatus.className = 'test-status-text';
  }

  if (providerSelect) providerSelect.value = activeDraftProvider;
  if (baseUrlInput) baseUrlInput.value = config.baseUrl;
  if (apiKeyInput) {
    apiKeyInput.value = config.apiKey;
    apiKeyInput.type = 'password';
  }
  if (modelInput) modelInput.value = config.model;

  const preset = PROVIDER_PRESETS[activeDraftProvider] || PROVIDER_PRESETS.openrouter;
  if (docsLink) {
    docsLink.href = preset.docsUrl;
    docsLink.textContent = `Get ${preset.name} Key ↗`;
  }

  renderModelPresets(activeDraftProvider, config.model);
  updateLocalTip(activeDraftProvider, config.baseUrl);
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

  // Provider change handler
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      const selected = providerSelect.value;
      activeDraftProvider = selected;
      const preset = PROVIDER_PRESETS[selected] || PROVIDER_PRESETS.openrouter;

      const modelInput = document.getElementById('byokModelInput');
      const apiKeyInput = document.getElementById('byokApiKeyInput');
      const docsLink = document.getElementById('byokGetDocsLink');

      if (baseUrlInput) baseUrlInput.value = preset.baseUrl;
      if (modelInput) modelInput.value = preset.defaultModel;
      if (apiKeyInput) apiKeyInput.placeholder = preset.placeholder;
      if (docsLink) {
        docsLink.href = preset.docsUrl;
        docsLink.textContent = `Get ${preset.name} Key ↗`;
      }

      renderModelPresets(selected, preset.defaultModel);
      updateLocalTip(selected, preset.baseUrl);
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
        showToast('AI Provider & BYOK settings saved to browser!');
      }
    });
  }

  // Clear button
  const clearBtn = document.getElementById('byokClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your saved API key and reset to demo mode?')) {
        clearBYOKConfig();
        const apiKeyInput = document.getElementById('byokApiKeyInput');
        if (apiKeyInput) apiKeyInput.value = '';
        updateTopbarAIStatus();
        closeAIModal();
        showToast('API Key cleared. Reverted to Demo mode.');
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
