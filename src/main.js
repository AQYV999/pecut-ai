/**
 * Pecut AI — Application Entry Point
 * Apache-2.0 License
 */

import { initNavigation, updateOverviewMetrics } from './modules/navigation.js';
import { initPromptBuilder } from './modules/builder.js';
import { initOptimizer } from './modules/optimizer.js';
import { initLibrary } from './modules/library.js';
import { initTemplates } from './modules/templates.js';
import { initHistory } from './modules/history.js';
import { initSettings } from './modules/settings.js';
import { initCommandPalette } from './modules/commandPalette.js';
import { updateGlobalCounters, applyTheme, appState } from './modules/storage.js';

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
  initSettings();
  initCommandPalette();

  // 3. Update global counter badges and overview state
  updateGlobalCounters();
  updateOverviewMetrics();
});
