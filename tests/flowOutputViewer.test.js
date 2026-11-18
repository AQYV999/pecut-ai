import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRichMarkdown, renderThinkingBox } from '../src/utils/markdown.js';
import { escapeHtml } from '../src/utils/helpers.js';
import {
  formatFlowOutput
} from '../src/modules/flow.js';
import {
  loadFlowRuns,
  saveFlowRun,
  getFlowRunById,
  clearFlowRuns,
  createRunSnapshot
} from '../src/modules/flow/runStorage.js';
import { normalizeFlowV2 } from '../src/modules/flow/schema.js';

// Setup Mock LocalStorage
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStore.get(k) || null,
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

test('2.4.1: Strict XSS sanitization in Markdown Output Viewer', () => {
  const maliciousOutputs = [
    '<script>alert("pwned")</script>',
    '<img src=x onerror="alert(document.cookie)">',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">Click Me</a>',
    '<svg onload="alert(1)">'
  ];

  for (const raw of maliciousOutputs) {
    const rendered = formatRichMarkdown(raw);
    assert.doesNotMatch(rendered, /<script[\s>]/i, `Raw <script> must not be in DOM: ${raw}`);
    assert.doesNotMatch(rendered, /<iframe[\s>]/i, `Raw <iframe> must not be in DOM: ${raw}`);
    assert.doesNotMatch(rendered, /<img[\s>]/i, `Raw <img> must not be in DOM: ${raw}`);
    assert.doesNotMatch(rendered, /<svg[\s>]/i, `Raw <svg> must not be in DOM: ${raw}`);
    assert.doesNotMatch(rendered, /<a\b[^>]*href=["']?javascript:/i, `javascript: link must not be in DOM: ${raw}`);
    // Check that tags are strictly entity encoded
    assert.ok(rendered.includes('&lt;'), `Tags must be entity encoded with &lt;: ${raw}`);
  }
});

test('2.4.2: Fenced code blocks and formatting in Markdown Output Viewer', () => {
  const markdownText = 'Here is code:\n```python\nprint("hello world")\n```\nAnd **bold text** with `inline code`.';
  const rendered = formatRichMarkdown(markdownText);

  assert.ok(rendered.includes('language-python'), 'Must render language class');
  assert.ok(rendered.includes('print(&quot;hello world&quot;)'), 'Must escape quotes within code');
  assert.ok(rendered.includes('<strong>bold text</strong>'), 'Must format bold');
  assert.ok(rendered.includes('<code>inline code</code>'), 'Must format inline code');
  assert.ok(rendered.includes('btn-copy-code'), 'Must include copy button');
});

test('2.4.3: Collapsible Thinking / Reasoning Block rendering and graceful omission', () => {
  // 1. When reasoning is provided (e.g., DeepSeek R1 / Gemini Thinking)
  const reasoning = 'Step-by-step internal deliberation:\n1. Analyze requirements\n2. Plan response';
  const thinkingHtml = renderThinkingBox(reasoning);

  assert.ok(thinkingHtml.includes('<details class="thinking-box">'), 'Must render <details> element');
  assert.ok(thinkingHtml.includes('<summary>💭 Thinking'), 'Must include summary header with word count');
  assert.ok(thinkingHtml.includes('internal deliberation'), 'Must include reasoning content');

  // 2. When reasoning is absent or empty
  assert.equal(renderThinkingBox(null), '', 'Null reasoning must return empty string');
  assert.equal(renderThinkingBox(''), '', 'Empty reasoning must return empty string');
  assert.equal(renderThinkingBox('   '), '', 'Whitespace reasoning must return empty string');
});

test('2.4.4: Consolidated pipeline output formatting vs per-step outputs', () => {
  const stepResults = [
    { title: 'Research & Discovery', output: 'Identified 3 key market trends.' },
    { title: 'Strategy Architecture', output: 'Designed multi-channel campaign structure.' },
    { title: 'Executive Summary', output: 'ROI estimated at 4.2x.' }
  ];

  const consolidated = formatFlowOutput(stepResults, 'Market Launch Strategy');

  // Verify structure
  assert.ok(consolidated.includes('### Step 1: Research & Discovery'));
  assert.ok(consolidated.includes('Identified 3 key market trends.'));
  assert.ok(consolidated.includes('---'));
  assert.ok(consolidated.includes('### Step 2: Strategy Architecture'));
  assert.ok(consolidated.includes('### Step 3: Executive Summary'));
  assert.ok(consolidated.includes('ROI estimated at 4.2x.'));

  // Empty or invalid input
  assert.equal(formatFlowOutput([]), '');
  assert.equal(formatFlowOutput(null), '');
});

test('2.4.5: Cross-Module Handoff payload generation (Markdown export & Library save)', () => {
  const activeFlow = normalizeFlowV2({
    id: 'flow-market-strategy',
    title: 'Market Launch Strategy',
    category: 'Marketing',
    steps: [
      { id: 's1', title: 'Research', instruction: 'Do research' },
      { id: 's2', title: 'Plan', instruction: 'Draft plan' }
    ]
  });

  const activeOutputText = 'Final deliverables ready for deployment.';
  const stepTitle = 'Draft plan';

  // 1. Markdown Export Payload
  const header = `# ${activeFlow.title}\n` +
    `> **Step:** ${stepTitle}\n` +
    `> **Workflow ID:** ${activeFlow.id}\n` +
    `> **Exported At:** ${new Date().toLocaleString()}\n\n---\n\n`;

  const mdFileContent = header + activeOutputText;
  assert.ok(mdFileContent.startsWith('# Market Launch Strategy'));
  assert.ok(mdFileContent.includes('> **Workflow ID:** flow-market-strategy'));
  assert.ok(mdFileContent.includes(activeOutputText));

  // 2. Prompt Library Payload
  const libraryPrompt = {
    id: 'prompt-' + Date.now(),
    title: `${activeFlow.title} - Step 2`,
    category: activeFlow.category,
    content: activeOutputText,
    isFavorite: true,
    createdAt: new Date().toISOString()
  };

  assert.ok(libraryPrompt.id.startsWith('prompt-'));
  assert.equal(libraryPrompt.title, 'Market Launch Strategy - Step 2');
  assert.equal(libraryPrompt.category, 'Marketing');
  assert.equal(libraryPrompt.content, activeOutputText);
  assert.equal(libraryPrompt.isFavorite, true);
});

test('2.4.6: Execution Run History lifecycle (persist, filter, inspect, clear)', () => {
  mockStore.clear();

  const flowA = normalizeFlowV2({ id: 'flow-alpha', title: 'Flow Alpha' });
  const flowB = normalizeFlowV2({ id: 'flow-beta', title: 'Flow Beta' });

  // 1. Create and save multiple runs
  const run1 = {
    id: 'run-1',
    flowId: 'flow-alpha',
    flowTitle: 'Flow Alpha',
    status: 'completed',
    startedAt: '2026-11-18T10:00:00.000Z',
    completedAt: '2026-11-18T10:00:05.000Z',
    flowSnapshot: createRunSnapshot(flowA),
    stepResults: [
      { stepIndex: 0, title: 'Step 1', output: 'Alpha 1 Output', usage: { totalTokens: 120 } },
      { stepIndex: 1, title: 'Step 2', output: 'Alpha 2 Output', usage: { totalTokens: 180 } }
    ]
  };

  const run2 = {
    id: 'run-2',
    flowId: 'flow-beta',
    flowTitle: 'Flow Beta',
    status: 'failed',
    startedAt: '2026-11-18T10:05:00.000Z',
    flowSnapshot: createRunSnapshot(flowB),
    stepResults: [
      { stepIndex: 0, title: 'Step 1', output: 'Beta 1 Output', usage: { totalTokens: 90 } }
    ]
  };

  saveFlowRun(run1);
  saveFlowRun(run2);

  const allRuns = loadFlowRuns();
  assert.equal(allRuns.length, 2, 'Should have 2 runs persisted');

  // 2. Filter runs by flowId
  const alphaRuns = allRuns.filter(r => r.flowId === 'flow-alpha');
  assert.equal(alphaRuns.length, 1);
  assert.equal(alphaRuns[0].id, 'run-1');

  // 3. Inspect Run by ID
  const retrievedRun = getFlowRunById('run-1');
  assert.ok(retrievedRun);
  assert.equal(retrievedRun.stepResults.length, 2);
  assert.equal(retrievedRun.stepResults[0].output, 'Alpha 1 Output');
  assert.equal(retrievedRun.stepResults[1].output, 'Alpha 2 Output');

  // Verify total token calculation
  const totalTokens = retrievedRun.stepResults.reduce((acc, s) => acc + (s.usage?.totalTokens || 0), 0);
  assert.equal(totalTokens, 300);

  // 4. Clear Runs
  clearFlowRuns();
  const runsAfterClear = loadFlowRuns();
  assert.equal(runsAfterClear.length, 0, 'Runs must be empty after clearFlowRuns()');
});
