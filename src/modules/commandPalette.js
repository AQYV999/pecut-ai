/**
 * Pecut AI — Command Palette & Keyboard Shortcuts
 * Apache-2.0 License
 */

import { switchView } from './navigation.js';

export function openCmdPalette() {
  const modal = document.getElementById('cmdPaletteModal');
  const input = document.getElementById('cmdPaletteInput');
  if (modal) modal.classList.add('active');
  if (input) {
    input.value = '';
    input.focus();
  }
}

export function closeCmdPalette() {
  const modal = document.getElementById('cmdPaletteModal');
  if (modal) modal.classList.remove('active');
}

export function initCommandPalette() {
  const trigger = document.getElementById('cmdPaletteTrigger');
  if (trigger) trigger.addEventListener('click', openCmdPalette);

  const modal = document.getElementById('cmdPaletteModal');
  const input = document.getElementById('cmdPaletteInput');

  document.addEventListener('keydown', (e) => {
    // Ctrl + K or Cmd + K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdPalette();
    }
    // Escape
    if (e.key === 'Escape') {
      closeCmdPalette();
      document.getElementById('templateModal')?.classList.remove('active');
      document.getElementById('editPromptModal')?.classList.remove('active');
    }
    // Ctrl + Enter in Builder
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const builderSec = document.getElementById('view-builder');
      if (builderSec?.classList.contains('active')) {
        e.preventDefault();
        document.getElementById('generatePromptBtn')?.click();
      }
    }
    // Ctrl + S in Builder
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      const builderSec = document.getElementById('view-builder');
      if (builderSec?.classList.contains('active')) {
        e.preventDefault();
        document.getElementById('saveBuilderToLibBtn')?.click();
      }
    }
  });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCmdPalette();
    });
  }

  document.querySelectorAll('.cmd-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (target) switchView(target);
      closeCmdPalette();
    });
  });

  if (input) {
    input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.cmd-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? 'flex' : 'none';
      });
    });
  }
}
