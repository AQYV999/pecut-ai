/**
 * Pecut AI — Context Profiles Management
 * Apache-2.0 License
 */

import { appState, saveState } from './storage.js';
import { switchView, registerViewHandler } from './navigation.js';
import { escapeHtml, showToast } from '../utils/helpers.js';

export function renderProfiles() {
  const grid = document.getElementById('profilesGrid');
  if (!grid) return;

  const searchInput = document.getElementById('profileSearchInput');
  const catFilter = document.getElementById('profileCategoryFilter');

  const query = searchInput ? searchInput.value.toLowerCase() : '';
  const category = catFilter ? catFilter.value : 'all';

  let filtered = appState.profiles.filter(p => {
    const matchesQuery =
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      (p.role && p.role.toLowerCase().includes(query));
    const matchesCat = category === 'all' || p.category === category;
    return matchesQuery && matchesCat;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No context profiles found. Create a new profile to standardize your prompts.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="prompt-card profile-card">
      <div class="card-top-row">
        <span class="badge-cat">${escapeHtml(p.category || 'General')}</span>
        <div class="card-actions-top">
          <button type="button" class="btn-icon" onclick="openEditProfileModal('${p.id}')" title="Edit Profile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="btn-icon" onclick="deleteProfile('${p.id}')" title="Delete Profile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <h3>${escapeHtml(p.name)}</h3>
      <p style="margin-bottom:0.75rem;">${escapeHtml(p.description)}</p>
      <div class="profile-details-preview" style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1rem; line-height:1.4;">
        <div><strong>Role:</strong> ${escapeHtml(p.role || '-')}</div>
        <div><strong>Tone:</strong> ${escapeHtml(p.tone || '-')}</div>
      </div>
      <div class="prompt-card-footer">
        <span>${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Preset'}</span>
        <button type="button" class="btn btn-primary btn-sm" onclick="injectProfileIntoBuilder('${p.id}')">Use in Builder</button>
      </div>
    </div>
  `).join('');
}

export function populateProfileDropdown() {
  const select = document.getElementById('builderProfileSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Apply a Context Profile (Optional) --</option>' +
    appState.profiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.category})</option>`).join('');

  if (currentVal) select.value = currentVal;
}

export function injectProfileIntoBuilder(id) {
  const profile = appState.profiles.find(p => p.id === id);
  if (!profile) return;

  const roleEl = document.getElementById('builderRole');
  const contextEl = document.getElementById('builderContext');
  const toneEl = document.getElementById('builderTone');
  const constraintsEl = document.getElementById('builderConstraints');
  const selectEl = document.getElementById('builderProfileSelect');

  if (roleEl && profile.role) roleEl.value = profile.role;
  if (contextEl && profile.context) contextEl.value = profile.context;
  if (toneEl && profile.tone) toneEl.value = profile.tone;
  if (constraintsEl && profile.constraints) constraintsEl.value = profile.constraints;
  if (selectEl) selectEl.value = profile.id;

  switchView('builder');
  showToast(`Context Profile "${profile.name}" injected into Builder!`);
}

export function openNewProfileModal() {
  document.getElementById('profileModalId').value = '';
  document.getElementById('profileModalName').value = '';
  document.getElementById('profileModalCategory').value = 'General';
  document.getElementById('profileModalRole').value = '';
  document.getElementById('profileModalTone').value = 'Professional & Authoritative';
  document.getElementById('profileModalDesc').value = '';
  document.getElementById('profileModalContext').value = '';
  document.getElementById('profileModalConstraints').value = '';
  document.getElementById('profileModalTitle').textContent = 'Create Context Profile';
  document.getElementById('profileModal')?.classList.add('active');
}

export function openEditProfileModal(id) {
  const profile = appState.profiles.find(p => p.id === id);
  if (!profile) return;

  document.getElementById('profileModalId').value = profile.id;
  document.getElementById('profileModalName').value = profile.name;
  document.getElementById('profileModalCategory').value = profile.category || 'General';
  document.getElementById('profileModalRole').value = profile.role || '';
  document.getElementById('profileModalTone').value = profile.tone || 'Professional & Authoritative';
  document.getElementById('profileModalDesc').value = profile.description || '';
  document.getElementById('profileModalContext').value = profile.context || '';
  document.getElementById('profileModalConstraints').value = profile.constraints || '';
  document.getElementById('profileModalTitle').textContent = 'Edit Context Profile';
  document.getElementById('profileModal')?.classList.add('active');
}

export function closeProfileModal() {
  document.getElementById('profileModal')?.classList.remove('active');
}

export function saveProfileModal() {
  const id = document.getElementById('profileModalId').value;
  const name = (document.getElementById('profileModalName')?.value || '').trim();
  const category = document.getElementById('profileModalCategory')?.value || 'General';
  const role = (document.getElementById('profileModalRole')?.value || '').trim();
  const tone = document.getElementById('profileModalTone')?.value || 'Professional & Authoritative';
  const description = (document.getElementById('profileModalDesc')?.value || '').trim();
  const context = (document.getElementById('profileModalContext')?.value || '').trim();
  const constraints = (document.getElementById('profileModalConstraints')?.value || '').trim();

  if (!name) {
    showToast('Profile name is required.', 'error');
    return;
  }

  if (id) {
    // Update existing
    const index = appState.profiles.findIndex(p => p.id === id);
    if (index !== -1) {
      appState.profiles[index] = {
        ...appState.profiles[index],
        name,
        category,
        role,
        tone,
        description,
        context,
        constraints
      };
      showToast('Profile updated successfully!');
    }
  } else {
    // Create new
    const newProfile = {
      id: 'prof-' + Date.now(),
      name,
      category,
      role,
      tone,
      description,
      context,
      constraints,
      createdAt: new Date().toISOString()
    };
    appState.profiles.unshift(newProfile);
    showToast('New Context Profile created!');
  }

  saveState();
  renderProfiles();
  populateProfileDropdown();
  closeProfileModal();
}

export function deleteProfile(id) {
  if (confirm('Are you sure you want to delete this Context Profile?')) {
    appState.profiles = appState.profiles.filter(p => p.id !== id);
    saveState();
    renderProfiles();
    populateProfileDropdown();
    showToast('Profile deleted.', 'error');
  }
}

// Global window attachments
if (typeof window !== 'undefined') {
  window.injectProfileIntoBuilder = injectProfileIntoBuilder;
  window.openEditProfileModal = openEditProfileModal;
  window.deleteProfile = deleteProfile;
}

export function initProfiles() {
  const searchInput = document.getElementById('profileSearchInput');
  if (searchInput) searchInput.addEventListener('input', renderProfiles);

  const catFilter = document.getElementById('profileCategoryFilter');
  if (catFilter) catFilter.addEventListener('change', renderProfiles);

  const newBtn = document.getElementById('newProfileBtn');
  if (newBtn) newBtn.addEventListener('click', openNewProfileModal);

  const closeBtn = document.getElementById('closeProfileModal');
  if (closeBtn) closeBtn.addEventListener('click', closeProfileModal);

  const cancelBtn = document.getElementById('cancelProfileModalBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeProfileModal);

  const saveBtn = document.getElementById('saveProfileModalBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveProfileModal);

  registerViewHandler('profiles', () => {
    renderProfiles();
    populateProfileDropdown();
  });

  renderProfiles();
  populateProfileDropdown();
}
