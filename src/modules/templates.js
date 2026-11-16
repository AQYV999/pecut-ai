/**
 * Pecut AI — Template Showcase & Inspection
 * Apache-2.0 License
 */

import { TEMPLATES_DATA } from '../data/templates.js';
import { switchView, registerViewHandler } from './navigation.js';
import { escapeHtml, showToast } from '../utils/helpers.js';

export function renderTemplates() {
  const grid = document.getElementById('templatesGrid');
  if (!grid) return;

  const searchInput = document.getElementById('templateSearchInput');
  const catFilter = document.getElementById('templateCategoryFilter');

  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const category = catFilter ? catFilter.value : 'all';

  let filtered = TEMPLATES_DATA.filter(t => {
    const matchesQuery = t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query);
    const matchesCat = category === 'all' || t.category === category;
    return matchesQuery && matchesCat;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No templates matching your search.</div>';
    return;
  }

  grid.innerHTML = filtered.map(t => `
    <div class="template-card">
      <div class="card-top-row">
        <span class="badge-cat">${escapeHtml(t.category)}</span>
      </div>
      <h3>${escapeHtml(t.title)}</h3>
      <p>${escapeHtml(t.description)}</p>
      <div class="template-card-footer">
        <button type="button" class="btn btn-secondary btn-sm" onclick="previewTemplate('${t.id}')">Preview</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="useTemplate('${t.id}')">Use Template</button>
      </div>
    </div>
  `).join('');
}

export function previewTemplate(id) {
  const t = TEMPLATES_DATA.find(x => x.id === id);
  if (t) {
    const titleEl = document.getElementById('modalTemplateTitle');
    const catEl = document.getElementById('modalTemplateCat');
    const descEl = document.getElementById('modalTemplateDesc');
    const contentEl = document.getElementById('modalTemplateContent');
    const modal = document.getElementById('templateModal');

    if (titleEl) titleEl.textContent = t.title;
    if (catEl) catEl.textContent = t.category;
    if (descEl) descEl.textContent = t.description;
    if (contentEl) contentEl.textContent = t.content;
    if (modal) modal.classList.add('active');
  }
}

export function useTemplate(id) {
  const t = TEMPLATES_DATA.find(x => x.id === id);
  if (t) {
    const builderObj = document.getElementById('builderObjective');
    if (builderObj) builderObj.value = t.content;
    switchView('builder');
    showToast(`Loaded "${t.title}" into Prompt Builder!`);
  }
}

// Global window attachments for inline event handlers
if (typeof window !== 'undefined') {
  window.previewTemplate = previewTemplate;
  window.useTemplate = useTemplate;
}

export function initTemplates() {
  const searchInput = document.getElementById('templateSearchInput');
  if (searchInput) searchInput.addEventListener('input', renderTemplates);

  const catFilter = document.getElementById('templateCategoryFilter');
  if (catFilter) catFilter.addEventListener('change', renderTemplates);

  const closeBtn = document.getElementById('closeTemplateModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('templateModal');
      if (modal) modal.classList.remove('active');
    });
  }

  const copyBtn = document.getElementById('modalCopyTemplateBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const content = document.getElementById('modalTemplateContent')?.textContent || '';
      navigator.clipboard.writeText(content);
      showToast('Template content copied!');
    });
  }

  const useBtn = document.getElementById('modalUseTemplateBtn');
  if (useBtn) {
    useBtn.addEventListener('click', () => {
      const content = document.getElementById('modalTemplateContent')?.textContent || '';
      const builderObj = document.getElementById('builderObjective');
      if (builderObj) builderObj.value = content;
      const modal = document.getElementById('templateModal');
      if (modal) modal.classList.remove('active');
      switchView('builder');
      showToast('Template loaded into Prompt Builder!');
    });
  }

  registerViewHandler('templates', renderTemplates);
  renderTemplates();
}
