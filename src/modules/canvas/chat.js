/**
 * Pecut AI — Workspace Canvas Interactive AI Chat Pane
 * Apache-2.0 License
 */

import { saveWorkspace, getActiveWorkspace } from '../workspaceStorage.js';
import { completeChat, getActiveProviderInfo } from '../../services/ai/client.js';
import { openAIModal } from '../aiModal.js';
import { showToast, escapeHtml } from '../../utils/helpers.js';
import { renderThinkingBox } from '../../utils/markdown.js';
import { appState } from '../storage.js';
import { formatChatMessage } from './format.js';
import { applyContentToDocument } from './editor.js';

let isAiGenerating = false;

/**
 * Renders the chat message stream for the active workspace.
 */
export function renderChatStream() {
  const container = document.getElementById('canvasChatStream');
  if (!container) return;

  const ws = getActiveWorkspace();
  const messages = ws.messages || [];

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state-sm" style="margin: auto; text-align: center; color: var(--text-tertiary); padding: 2rem 1rem;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.5;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <p style="margin: 0; font-size: 0.9rem;">Belum ada percakapan di proyek ini.</p>
        <small style="color: var(--text-secondary);">Ketik ide prompt Anda di bawah untuk mulai berdiskusi dengan AI.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isAssistant = msg.role === 'assistant';
    const thinkingHtml = isAssistant ? renderThinkingBox(msg.reasoning) : '';

    return `
      <div class="canvas-chat-msg ${escapeHtml(msg.role)}" data-msg-id="${escapeHtml(msg.id || '')}">
        ${thinkingHtml}
        <div class="canvas-msg-body">${formatChatMessage(msg.content)}</div>
        ${isAssistant ? `
          <div class="canvas-msg-actions">
            <button type="button" class="btn btn-secondary btn-xs apply-to-canvas-btn" title="Terapkan teks/prompt ini ke lembar kerja kanan">
              <span>📥 Terapkan ke Kanvas</span>
            </button>
            <button type="button" class="btn btn-ghost btn-xs copy-msg-btn" title="Salin pesan">
              <span>📋 Salin</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Wire action buttons
  container.querySelectorAll('.apply-to-canvas-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgEl = btn.closest('.canvas-chat-msg');
      const msgId = msgEl.getAttribute('data-msg-id');
      const targetMsg = messages.find(m => m.id === msgId);
      if (targetMsg) {
        applyContentToDocument(targetMsg.content);
      }
    });
  });

  container.querySelectorAll('.copy-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgEl = btn.closest('.canvas-chat-msg');
      const msgId = msgEl.getAttribute('data-msg-id');
      const targetMsg = messages.find(m => m.id === msgId);
      if (targetMsg) {
        navigator.clipboard.writeText(targetMsg.content);
        showToast('Pesan disalin ke clipboard!');
      }
    });
  });

  // Auto scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Sends a chat message to the active AI provider with bounded history.
 */
export async function sendChatMessage() {
  if (isAiGenerating) return;

  const input = document.getElementById('canvasChatInput');
  if (!input) return;
  const userText = input.value.trim();
  if (!userText) return;

  const ws = getActiveWorkspace();
  const providerInfo = getActiveProviderInfo();

  // Guard: Zero-key state
  if (!providerInfo.hasKey && providerInfo.provider !== 'custom' && providerInfo.provider !== 'ninerouter') {
    const stream = document.getElementById('canvasChatStream');
    if (stream) {
      const banner = document.createElement('div');
      banner.className = 'canvas-chat-msg system';
      banner.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 0.85rem; text-align: center;">
          <p style="margin: 0 0 0.5rem; color: #f59e0b; font-weight: 600;">Kunci API Belum Dikonfigurasi (BYOK)</p>
          <p style="margin: 0 0 0.65rem; font-size: 0.82rem; color: var(--text-secondary);">Untuk mengobrol interaktif dengan AI secara gratis, silakan masukkan API Key Groq atau Gemini Anda.</p>
          <button type="button" class="btn btn-primary btn-xs" id="canvasOpenByokBtn">⚡ Hubungkan API Key Gratis</button>
        </div>
      `;
      stream.appendChild(banner);
      stream.scrollTop = stream.scrollHeight;

      document.getElementById('canvasOpenByokBtn')?.addEventListener('click', openAIModal);
    }
    return;
  }

  // Clear input
  input.value = '';

  // Append user message
  const now = new Date().toISOString();
  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: userText,
    timestamp: now
  };

  const updatedMessages = [...(ws.messages || []), userMsg];
  saveWorkspace({
    id: ws.id,
    messages: updatedMessages
  });
  renderChatStream();

  // Render live streaming assistant message
  const stream = document.getElementById('canvasChatStream');
  const liveEl = document.createElement('div');
  liveEl.className = 'canvas-chat-msg assistant live-streaming';
  liveEl.id = 'canvasLiveAssistantMsg';
  liveEl.innerHTML = `
    <div style="font-size: 0.74rem; color: var(--text-tertiary); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
      <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981;"></span>
      <span>⚡ Pecut AI (${escapeHtml(providerInfo.name)}) sedang merespon...</span>
    </div>
    <div class="canvas-live-thinking"></div>
    <div class="canvas-live-content">
      <em style="color: var(--text-tertiary); font-size: 0.85rem;">Menghubungkan...</em>
    </div>
  `;
  if (stream) {
    stream.appendChild(liveEl);
    stream.scrollTop = stream.scrollHeight;
  }

  isAiGenerating = true;
  const sendBtn = document.getElementById('canvasSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    // Construct persona-infused system prompt
    let systemPrompt = `You are Pecut AI, a versatile, intelligent AI assistant and expert coder (similar to Hermes, Claude, and OpenCoder).
Directly fulfill the user's request:
- If the user asks for code, web HTML/CSS/JS, Python scripts, or full pages: write the complete, functional code directly in appropriate markdown code fences. Do NOT write a prompt about it; build the actual code requested!
- If the user asks a question, requests an explanation, analysis, or creative writing: answer directly and thoroughly.
- If the user asks to design or optimize a prompt: craft the structured prompt.
- Always be helpful, precise, and output clean Markdown with language tags for all code blocks.`;

    if (ws.contextProfileId) {
      const profile = (appState.profiles || []).find(p => p.id === ws.contextProfileId);
      if (profile) {
        systemPrompt += `\n\n[Active Persona]\nRole: ${profile.role || profile.name}\nTone: ${profile.tone || 'Professional'}\nContext: ${profile.context || ''}\nConstraints: ${profile.constraints || ''}`;
      }
    }

    // Pass latest canvas document context if present
    const docContext = ws.documentContent?.trim();
    if (docContext) {
      systemPrompt += `\n\nCurrent Canvas Document Draft:\n"""\n${docContext.slice(0, 3000)}\n"""`;
    }

    // Bounded clean history (latest 10 messages, excluding errors)
    const historyPayload = updatedMessages
      .filter(m => !m.isError && !(m.id || '').startsWith('msg_err_'))
      .slice(-10)
      .map(m => ({
        role: m.role,
        content: (m.content || m.reasoning || '').trim()
      }))
      .filter(m => m.content.length > 0);

    let renderPending = false;
    let latestStreamData = null;
    let lastRenderTimestamp = 0;

    const flushCanvasStreamUI = () => {
      if (!latestStreamData || !liveEl.isConnected) return;
      const { text, reasoning } = latestStreamData;
      const thinkingEl = liveEl.querySelector('.canvas-live-thinking');
      const contentEl = liveEl.querySelector('.canvas-live-content');

      if (thinkingEl && reasoning) {
        let detailsBox = thinkingEl.querySelector('.thinking-box');
        if (!detailsBox) {
          thinkingEl.innerHTML = renderThinkingBox(reasoning);
        } else {
          const bodyEl = detailsBox.querySelector('.thinking-box-body');
          const summaryEl = detailsBox.querySelector('summary');
          if (bodyEl) {
            bodyEl.innerHTML = escapeHtml(reasoning.trim()).replace(/\n/g, '<br>');
          }
          if (summaryEl) {
            const wordCount = reasoning.trim().split(/\s+/).length;
            summaryEl.textContent = `💭 Thinking (${wordCount} kata)`;
          }
        }
      }

      if (contentEl && text) {
        contentEl.innerHTML = formatChatMessage(text);
      }

      if (stream) {
        const isNearBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 220;
        if (isNearBottom) {
          stream.scrollTop = stream.scrollHeight;
        }
      }
    };

    const onChunk = (chunkData) => {
      latestStreamData = chunkData;
      const now = performance.now();
      if (!renderPending) {
        const timeSinceLast = now - lastRenderTimestamp;
        if (timeSinceLast >= 35) {
          renderPending = true;
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              renderPending = false;
              lastRenderTimestamp = performance.now();
              flushCanvasStreamUI();
            });
          } else {
            renderPending = false;
            lastRenderTimestamp = now;
            flushCanvasStreamUI();
          }
        } else {
          renderPending = true;
          setTimeout(() => {
            if (typeof requestAnimationFrame === 'function') {
              requestAnimationFrame(() => {
                renderPending = false;
                lastRenderTimestamp = performance.now();
                flushCanvasStreamUI();
              });
            } else {
              renderPending = false;
              lastRenderTimestamp = performance.now();
              flushCanvasStreamUI();
            }
          }, 35 - timeSinceLast);
        }
      }
    };

    const response = await completeChat({
      systemPrompt,
      messages: historyPayload,
      temperature: 0.3,
      maxTokens: 8192,
      onChunk
    });

    // Remove live indicator
    liveEl.remove();

    const assistantMsg = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content: response.text || response.reasoning || '',
      reasoning: response.reasoning || '',
      timestamp: new Date().toISOString()
    };

    saveWorkspace({
      id: ws.id,
      messages: [...updatedMessages, assistantMsg]
    });

    renderChatStream();
  } catch (err) {
    liveEl.remove();
    showToast(`AI Error: ${err.message}`, 4000);

    const errorMsg = {
      id: 'msg_err_' + Date.now(),
      role: 'assistant',
      content: `⚠️ **Gagal menghubungi AI:** ${err.message}\n\nSilakan periksa koneksi atau ganti model di AI Connection Settings.`,
      timestamp: new Date().toISOString()
    };

    saveWorkspace({
      id: ws.id,
      messages: [...updatedMessages, errorMsg]
    });
    renderChatStream();
  } finally {
    isAiGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}
