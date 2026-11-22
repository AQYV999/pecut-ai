/**
 * Pecut AI — Application Entry Point
 * Apache-2.0 License
 */

import { initNavigation, updateOverviewMetrics } from './modules/navigation.js';
import './styles/tailwind.css';
import { initPromptBuilder } from './modules/builder.js';
import { initOptimizer } from './modules/optimizer.js';
import { initLibrary } from './modules/library.js';
import { initTemplates } from './modules/templates.js';
import { initHistory } from './modules/history.js';
import { initSettings } from './modules/settings.js';
import { initProfiles } from './modules/profiles.js';
import { initFlow } from './modules/flow.js';
import { initCanvas } from './modules/canvas.js';
import { initAIChat } from './modules/chat.js';
import { initCommandPalette } from './modules/commandPalette.js';
import { initAIModal, updateTopbarAIStatus } from './modules/aiModal.js';
import { updateGlobalCounters, applyTheme, appState } from './modules/storage.js';
import { checkAIStatus } from './services/ai/index.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Apply theme immediately on boot
  applyTheme(appState.settings.theme);

  // 2. Initialize feature modules
  initNavigation();
  initPromptBuilder();
  initOptimizer();
  initLibrary();
  initTemplates();
  initHistory();
  initProfiles();
  initFlow();
  initCanvas();
  initAIChat();
  initSettings();
  initCommandPalette();
  initAIModal();

  // 3. Update global counter badges and overview state
  updateGlobalCounters();
  updateOverviewMetrics();

  // 4. Initial AI provider status check (cascade: BYOK -> Server .env)
  updateTopbarAIStatus();
});
