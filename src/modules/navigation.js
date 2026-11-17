/**
 * Pecut AI — Navigation & View Routing
 * Apache-2.0 License
 */

import { appState, updateGlobalCounters } from './storage.js';
import { escapeHtml } from '../utils/helpers.js';

const viewRefreshHandlers = {};

export function registerViewHandler(viewId, handler) {
  viewRefreshHandlers[viewId] = handler;
}

export function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));

  const targetSec = document.getElementById(`view-${viewId}`);
  if (targetSec) {
    targetSec.classList.add('active');
    window.scrollTo(0, 0);
  }

  const activeNav = document.querySelector(`.sidebar-nav .nav-item[data-nav="${viewId}"]`);
  if (activeNav) {
    activeNav.classList.add('active');
  }

  // Update topbar title
  const titles = {
    overview: 'Overview',
    canvas: 'Workspace Canvas',
    builder: 'Prompt Builder',
    optimizer: 'Prompt Optimizer',
    flow: 'Pecut Flow (Workflows)',
    library: 'Prompt Library',
    templates: 'Templates',
    profiles: 'Context Profiles',
    history: 'Execution History',
    settings: 'Settings'
  };
  const titleEl = document.getElementById('viewTitle');
  if (titleEl) {
    titleEl.textContent = titles[viewId] || 'Workspace';
  }

  // Refresh registered view handler
  if (typeof viewRefreshHandlers[viewId] === 'function') {
    viewRefreshHandlers[viewId]();
  }
}

export function updateOverviewMetrics() {
  updateGlobalCounters();
  const recentList = document.getElementById('recentHistoryList');
  if (!recentList) return;

  if (appState.history.length === 0) {
    recentList.innerHTML = '<div class="empty-state-sm">No recent activity yet. Run a prompt in Builder or Optimizer.</div>';
    return;
  }

  recentList.innerHTML = appState.history.slice(0, 4).map(item => `
    <div class="recent-hist-item">
      <div class="recent-hist-info">
        <h5>${escapeHtml(item.snippet || 'Workflow Execution')}</h5>
        <span>${escapeHtml(item.category || 'General')} • ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="restoreHistoryItem('${item.id}')">Restore</button>
    </div>
  `).join('');
}

export function initNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item, [data-nav-target], .sidebar-header .logo');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-nav') || item.getAttribute('data-nav-target') || 'overview';
      switchView(targetView);

      // Close mobile sidebar if open
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    });
  });

  const mobileToggle = document.getElementById('mobileToggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.add('open');
    });
  }

  const mobileCloseBtn = document.getElementById('mobileCloseBtn');
  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    });
  }

  // Register overview view handler
  registerViewHandler('overview', updateOverviewMetrics);
}
