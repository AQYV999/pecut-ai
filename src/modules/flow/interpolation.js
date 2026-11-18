/**
 * Pecut AI — Deterministic Variable Interpolator (Pecut Flow 2.0)
 * Apache-2.0 License
 *
 * Implements deterministic variable substitution:
 * - `{{input}}`: original user seed input
 * - `{{prev}}`: direct previous step output
 * - `{{step1}}`, `{{step2}}`, ... `{{stepN}}`: 1-based sequential step outputs
 * - `{{step:step_id}}`: stable ID references resistant to step reordering
 *
 * Zero Hidden Mutation: Auto-append only occurs if the instruction contains ZERO template tags.
 */

const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_:-]+)\s*\}\}/g;

/**
 * Checks if a string contains any recognized template variable tags.
 * @param {string} text
 * @returns {boolean}
 */
export function hasTemplateVariables(text) {
  if (typeof text !== 'string') return false;
  VARIABLE_REGEX.lastIndex = 0;
  return VARIABLE_REGEX.test(text);
}

/**
 * Extracts a list of distinct placeholder names used inside a template.
 * @param {string} text
 * @returns {string[]}
 */
export function extractPlaceholders(text) {
  if (typeof text !== 'string') return [];
  const matches = new Set();
  let m;
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  while ((m = re.exec(text)) !== null) {
    if (m[1]) matches.add(m[1].trim());
  }
  return Array.from(matches);
}

/**
 * Deterministically interpolates variables into a step instruction prompt.
 * @param {string} instruction
 * @param {Object} context
 * @param {string} [context.input=''] - Root user input
 * @param {string} [context.prev=''] - Direct previous step output
 * @param {string[]} [context.stepOutputs=[]] - 1-based sequential outputs list
 * @param {Record<string, string>} [context.stepMap={}] - Map of stable stepId -> outputText
 * @param {number} [context.stepIndex=0] - 0-based current step index
 * @returns {{ prompt: string, usedPlaceholders: string[], autoAppended: boolean }}
 */
export function interpolateStepPrompt(instruction = '', context = {}) {
  const rawInstruction = typeof instruction === 'string' ? instruction.trim() : '';
  const input = typeof context.input === 'string' ? context.input : '';
  const prev = typeof context.prev === 'string' ? context.prev : '';
  const stepOutputs = Array.isArray(context.stepOutputs) ? context.stepOutputs : [];
  const stepMap = context.stepMap && typeof context.stepMap === 'object' ? context.stepMap : {};
  const stepIndex = Math.max(0, parseInt(context.stepIndex, 10) || 0);

  const placeholders = extractPlaceholders(rawInstruction);

  // If user explicitly supplied template tags, resolve them directly (No hidden auto-append)
  if (placeholders.length > 0) {
    const interpolated = rawInstruction.replace(VARIABLE_REGEX, (match, rawKey) => {
      const key = rawKey.trim();
      const lower = key.toLowerCase();

      // 1. Root user input
      if (lower === 'input') {
        return input;
      }

      // 2. Immediate previous output
      if (lower === 'prev' || lower === 'previous') {
        return prev;
      }

      // 3. 1-based sequential step reference: {{step1}}, {{step2}}, etc.
      const stepIndexMatch = lower.match(/^step(\d+)$/);
      if (stepIndexMatch) {
        const targetNum = parseInt(stepIndexMatch[1], 10);
        const targetZeroIndex = targetNum - 1;
        if (targetZeroIndex >= 0 && targetZeroIndex < stepOutputs.length) {
          return stepOutputs[targetZeroIndex] || '';
        }
        return '';
      }

      // 4. Stable step ID reference: {{step:step_id}} or {{step_id}}
      let lookupId = key;
      if (key.startsWith('step:')) {
        lookupId = key.slice(5).trim();
      }
      if (Object.prototype.hasOwnProperty.call(stepMap, lookupId)) {
        return stepMap[lookupId] || '';
      }

      // Unresolved variable resolves cleanly to empty string
      return '';
    });

    return {
      prompt: interpolated.trim(),
      usedPlaceholders: placeholders,
      autoAppended: false
    };
  }

  // Backward-compatible fallback: When NO variables exist, append inputs explicitly
  let prompt = rawInstruction;
  if (input) {
    prompt += `\n\n[WORKFLOW INPUT]\n${input}`;
  }
  if (stepIndex > 0 && prev) {
    prompt += `\n\n[PREVIOUS STEP OUTPUT]\n${prev}`;
  }

  return {
    prompt: prompt.trim(),
    usedPlaceholders: [],
    autoAppended: true
  };
}
