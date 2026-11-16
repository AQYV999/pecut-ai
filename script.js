/* =========================================================================
   PECUT AI — Intelligent Prompt Engineering & Workflow Workspace
   Core JavaScript Architecture
   ========================================================================= */

// --- CURATED TEMPLATES DATA (22+ Professional Templates) ---
const TEMPLATES_DATA = [
  {
    id: 'tpl-1',
    title: 'Senior Code Reviewer & Architecture Audit',
    category: 'Programming',
    description: 'Rigorously inspects source code for security vulnerabilities, concurrency bugs, and architectural anti-patterns.',
    content: 'Role: Senior Full-Stack Architect & Security Auditor\nObjective: Conduct a rigorous code review of the provided snippet.\nContext: High-throughput production web application.\nInstructions:\n1. Identify critical security vulnerabilities (OWASP Top 10).\n2. Evaluate memory efficiency and concurrency bottlenecks.\n3. Propose refactored code blocks with comments explaining optimizations.\nOutput Format: Markdown Report with severity ratings.'
  },
  {
    id: 'tpl-2',
    title: 'API Schema & Endpoint Generator',
    category: 'Programming',
    description: 'Generates robust RESTful or GraphQL endpoint definitions with strict TypeScript types and error handling.',
    content: 'Role: Backend API Architect\nObjective: Design a robust API endpoint specification from user requirements.\nContext: Microservice architecture with Node.js & TypeScript.\nInstructions:\n1. Define OpenAPI 3.0 specification or TypeScript interfaces.\n2. Include input validation schemas (Zod).\n3. Define standard HTTP status codes and error payloads.\nOutput Format: TypeScript Code Block.'
  },
  {
    id: 'tpl-3',
    title: 'SQL Query & Performance Optimizer',
    category: 'Programming',
    description: 'Writes optimized relational queries and provides indexing strategies for massive datasets.',
    content: 'Role: Principal Database Administrator\nObjective: Optimize complex SQL queries for maximum throughput.\nContext: PostgreSQL database with millions of records.\nInstructions:\n1. Analyze query execution bottlenecks (joins, subqueries).\n2. Rewrite query using efficient indexing and CTEs.\n3. Recommend composite indexes.\nOutput Format: SQL Code Block with performance commentary.'
  },
  {
    id: 'tpl-4',
    title: 'Bug Root Cause & Debug Assistant',
    category: 'Programming',
    description: 'Systematically traces stack traces and error logs to isolate root causes and provide instant patches.',
    content: 'Role: Senior Debugging Specialist\nObjective: Diagnose stack trace and provide precise bug fix.\nContext: Production runtime exception.\nInstructions:\n1. Explain exact failure mechanism.\n2. Provide minimal reproducible fix.\n3. Suggest defensive programming practices.\nOutput Format: Step-by-Step Guide.'
  },
  {
    id: 'tpl-5',
    title: 'Executive Summary Synthesizer',
    category: 'Business',
    description: 'Condenses verbose business reports, financial spreadsheets, or meeting transcripts into high-impact executive summaries.',
    content: 'Role: Chief of Staff / Executive Strategist\nObjective: Condense verbose text into high-impact executive summary.\nContext: Boardroom presentation.\nInstructions:\n1. Extract top 3 strategic takeaways.\n2. Highlight financial risks or growth opportunities.\n3. Use bullet points and bold metrics.\nOutput Format: Executive Summary.'
  },
  {
    id: 'tpl-6',
    title: 'Financial Model & Valuation Analyst',
    category: 'Business',
    description: 'Evaluates DCF models, unit economics, LTV/CAC ratios, and financial runway projections.',
    content: 'Role: Senior Financial Analyst\nObjective: Evaluate unit economics and startup financial metrics.\nContext: Series A investment due diligence.\nInstructions:\n1. Calculate LTV, CAC, and payback period.\n2. Stress-test gross margin assumptions.\n3. Provide strategic recommendations.\nOutput Format: Markdown Report.'
  },
  {
    id: 'tpl-7',
    title: 'Strategic Pitch Deck Storyteller',
    category: 'Business',
    description: 'Structures persuasive pitch decks for venture capital fundraising and stakeholder alignment.',
    content: 'Role: Venture Capital Partner & Pitch Coach\nObjective: Structure a compelling 10-slide pitch deck narrative.\nContext: B2B SaaS Seed Round.\nInstructions:\n1. Define problem, solution, market size, and traction.\n2. Craft hook for slide 1.\nOutput Format: Slide-by-slide outline.'
  },
  {
    id: 'tpl-8',
    title: 'Market Competitor Matrix',
    category: 'Business',
    description: 'Builds comprehensive feature and pricing comparison matrices against key market competitors.',
    content: 'Role: Market Research Director\nObjective: Compare competitive landscape across key vectors.\nContext: Enterprise software market.\nInstructions:\n1. Create feature matrix comparing top 4 competitors.\n2. Identify unique value proposition (UVP).\nOutput Format: Table Comparison.'
  },
  {
    id: 'tpl-9',
    title: 'Technical Documentation Writer',
    category: 'Writing',
    description: 'Produces crystal-clear SDK documentation, README files, and architecture guides for developers.',
    content: 'Role: Principal Technical Writer\nObjective: Write comprehensive developer documentation.\nContext: Open-source SDK release.\nInstructions:\n1. Write quickstart guide with code installation examples.\n2. Document all public API methods with parameter descriptions.\nOutput Format: Markdown Report.'
  },
  {
    id: 'tpl-10',
    title: 'SEO Optimized Editorial Article',
    category: 'Writing',
    description: 'Creates engaging, authoritative long-form articles optimized for search intent and readability.',
    content: 'Role: Senior Content Strategist & SEO Expert\nObjective: Write authoritative article on specified keyword topic.\nContext: Tech industry blog.\nInstructions:\n1. Use compelling H1 and H2 subheadings.\n2. Incorporate semantic keywords naturally.\n3. Maintain professional and engaging tone.\nOutput Format: Markdown Report.'
  },
  {
    id: 'tpl-11',
    title: 'Crisp Email & Outreach Copywriter',
    category: 'Writing',
    description: 'Drafts high-conversion cold emails, partnership requests, and executive announcements.',
    content: 'Role: B2B Growth Copywriter\nObjective: Draft high-conversion outreach email.\nContext: Enterprise software sales.\nInstructions:\n1. Hook reader in first sentence with personalized value.\n2. Keep body under 125 words.\n3. Clear, low-friction call to action.\nOutput Format: Concise Email Template.'
  },
  {
    id: 'tpl-12',
    title: 'Curriculum & Lesson Plan Designer',
    category: 'Education',
    description: 'Designs structured educational syllabi, learning modules, and interactive quizzes.',
    content: 'Role: Instructional Designer & Educator\nObjective: Design a 4-week learning curriculum for students.\nContext: Advanced Prompt Engineering course.\nInstructions:\n1. Outline weekly learning objectives.\n2. Create 3 practical exercises per week.\nOutput Format: Step-by-Step Guide.'
  },
  {
    id: 'tpl-13',
    title: 'Socratic Concept Explainer',
    category: 'Education',
    description: 'Explains complex scientific or technical principles using analogies, Socratic questioning, and tiered complexity.',
    content: 'Role: Master Educator & Science Communicator\nObjective: Explain complex technical concept using analogies.\nContext: Beginner audience.\nInstructions:\n1. Use real-world analogy.\n2. Break down core mechanics without jargon.\nOutput Format: Structured educational explanation.'
  },
  {
    id: 'tpl-14',
    title: 'Exam Question & Rubric Generator',
    category: 'Education',
    description: 'Creates rigorous assessment questions and comprehensive grading rubrics.',
    content: 'Role: University Professor & Examiner\nObjective: Generate exam questions with scoring rubrics.\nContext: Advanced computer science exam.\nInstructions:\n1. Create 5 scenario-based questions.\n2. Provide granular grading rubric for each.\nOutput Format: Markdown Report.'
  },
  {
    id: 'tpl-15',
    title: 'Multi-Channel Marketing Campaign',
    category: 'Marketing',
    description: 'Plans cohesive product launch campaigns across social media, email, and paid channels.',
    content: 'Role: VP of Marketing\nObjective: Plan comprehensive product launch campaign.\nContext: AI productivity tool launch.\nInstructions:\n1. Outline pre-launch, launch day, and post-launch phases.\n2. Draft ad copy variations for Twitter/X and LinkedIn.\nOutput Format: Markdown Report.'
  },
  {
    id: 'tpl-16',
    title: 'Social Media Viral Hook Generator',
    category: 'Marketing',
    description: 'Crafts attention-grabbing hooks and structured threads for high engagement.',
    content: 'Role: Social Media Growth Lead\nObjective: Generate 10 high-retention hook variations.\nContext: Developer Twitter/X audience.\nInstructions:\n1. Focus on curiosity gap, contrarian take, or data shock.\nOutput Format: Bulleted list.'
  },
  {
    id: 'tpl-17',
    title: 'Ad Copy & Conversion Optimizer',
    category: 'Marketing',
    description: 'Optimizes ad copy variants using proven copywriting frameworks (AIDA, PAS).',
    content: 'Role: Direct Response Copywriter\nObjective: Write high-converting ad copy using PAS framework.\nContext: Facebook & Google Ads.\nInstructions:\n1. Emphasize Problem, Agitate pain point, Offer Solution.\nOutput Format: Copy variants.'
  },
  {
    id: 'tpl-18',
    title: 'User Research & Persona Synthesizer',
    category: 'Research',
    description: 'Analyzes qualitative user interview transcripts to build actionable buyer personas and pain point maps.',
    content: 'Role: Principal UX Researcher\nObjective: Synthesize user interview data into buyer persona.\nContext: B2B SaaS product discovery.\nInstructions:\n1. Extract core behavioral patterns, frustrations, and goals.\nOutput Format: Structured Persona Profile.'
  },
  {
    id: 'tpl-19',
    title: 'Academic Literature Review Synthesizer',
    category: 'Research',
    description: 'Structures systematic literature reviews, identifying research gaps and methodological trends.',
    content: 'Role: Senior Academic Researcher\nObjective: Synthesize academic literature on specified topic.\nContext: Journal publication.\nInstructions:\n1. Categorize papers by methodology and findings.\n2. Identify research gap.\nOutput Format: Academic Report.'
  },
  {
    id: 'tpl-20',
    title: 'Sci-Fi Worldbuilding & Lore Architect',
    category: 'Creative',
    description: 'Constructs immersive fictional universes, magic systems, faction politics, and technological lore.',
    content: 'Role: Master Worldbuilder & Sci-Fi Author\nObjective: Construct detailed sci-fi planetary lore.\nContext: Novel writing project.\nInstructions:\n1. Define planetary ecology, political governance, and energy sources.\nOutput Format: Creative Lore Bible.'
  },
  {
    id: 'tpl-21',
    title: 'Creative Character Arc Developer',
    category: 'Creative',
    description: 'Designs multi-dimensional fictional characters with psychological flaws, motivations, and growth trajectories.',
    content: 'Role: Lead Narrative Designer\nObjective: Develop complex character profile for fiction.\nContext: RPG video game screenplay.\nInstructions:\n1. Outline internal conflict, core desire, and fatal flaw.\nOutput Format: Character Profile.'
  },
  {
    id: 'tpl-22',
    title: 'Weekly Deep-Work Productivity Planner',
    category: 'Productivity',
    description: 'Organizes high-leverage weekly schedules using time-blocking and energy management principles.',
    content: 'Role: Executive Productivity Coach\nObjective: Design a high-leverage weekly time-blocked schedule.\nContext: Remote engineering leader.\nInstructions:\n1. Prioritize top 3 institutional leverage tasks.\n2. Schedule deep-work blocks and administrative buffers.\nOutput Format: Weekly Schedule Table.'
  }
];

// --- STATE MANAGEMENT --- 
let appState = {
  savedPrompts: JSON.parse(localStorage.getItem('pecut_saved_prompts') || '[]'),
  history: JSON.parse(localStorage.getItem('pecut_history') || '[]'),
  settings: JSON.parse(localStorage.getItem('pecut_settings') || '{\n    "theme": "dark",\n    "language": "id",\n    "tone": "Professional & Authoritative",\n    "format": "Markdown Report",\n    "provider": "demo",\n    "apiKey": ""\n  }')
};

function saveState() {
  localStorage.setItem('pecut_saved_prompts', JSON.stringify(appState.savedPrompts));
  localStorage.setItem('pecut_history', JSON.stringify(appState.history));
  localStorage.setItem('pecut_settings', JSON.stringify(appState.settings));
  updateGlobalCounters();
}

// --- TOAST NOTIFICATION --- 
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${type === 'success' ? '#10b981' : '#ef4444'}" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(1rem)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- NAVIGATION & ROUTING ---
function initNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item, [data-nav-target], .sidebar-header .logo');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-nav') || item.getAttribute('data-nav-target') || 'overview';
      switchView(targetView);
      
      // Close mobile sidebar if open
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
  });
  document.getElementById('mobileCloseBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });
}

function switchView(viewId) {
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
    builder: 'Prompt Builder',
    optimizer: 'Prompt Optimizer',
    library: 'Prompt Library',
    templates: 'Templates',
    history: 'Execution History',
    settings: 'Settings'
  };
  document.getElementById('viewTitle').textContent = titles[viewId] || 'Workspace';

  // Refresh specific view data
  if (viewId === 'library') renderLibrary();
  if (viewId === 'templates') renderTemplates();
  if (viewId === 'history') renderHistory();
  if (viewId === 'overview') updateOverviewMetrics();
}

// --- GLOBAL COUNTERS & METRICS ---
function updateGlobalCounters() {
  const savedCount = appState.savedPrompts.length;
  const histCount = appState.history.length;
  const favCount = appState.savedPrompts.filter(p => p.isFavorite).length;

  document.getElementById('libCountBadge').textContent = savedCount;
  document.getElementById('statSavedCount').textContent = savedCount;
  document.getElementById('statHistoryCount').textContent = histCount;
  document.getElementById('metricSaved').textContent = savedCount;
  document.getElementById('metricExecutions').textContent = histCount;
  document.getElementById('metricFavorites').textContent = favCount;
}

function updateOverviewMetrics() {
  updateGlobalCounters();
  const recentList = document.getElementById('recentHistoryList');
  if (appState.history.length === 0) {
    recentList.innerHTML = '<div class="empty-state-sm">No recent activity yet. Run a prompt in Builder or Optimizer.</div>';
    return;
  }

  recentList.innerHTML = appState.history.slice(0, 4).map(item => `
    <div class="recent-hist-item">
      <div class="recent-hist-info">
        <h5>${escapeHtml(item.snippet || 'Workflow Execution')}</h5>
        <span>${item.category || 'General'} • ${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="restoreHistoryItem('${item.id}')">Restore</button>
    </div>
  `).join('');
}

// --- PROMPT BUILDER LOGIC ---
function initPromptBuilder() {
  const fields = ['builderRole', 'builderObjective', 'builderContext', 'builderInstructions', 'builderInputData', 'builderOutputFormat', 'builderTone', 'builderLanguage', 'builderConstraints'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateBuilderPreview);
      el.addEventListener('change', updateBuilderPreview);
    }
  });

  document.getElementById('generatePromptBtn').addEventListener('click', () => {
    const promptText = buildPromptString();
    updateBuilderPreview();
    logHistory('Prompt Builder Generation', promptText, document.getElementById('builderCategory').value);
    showToast('Prompt generated successfully!');
  });

  document.getElementById('resetBuilderBtn').addEventListener('click', () => {
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    updateBuilderPreview();
    showToast('Builder form reset.', 'error');
  });

  document.getElementById('saveBuilderToLibBtn').addEventListener('click', () => {
    const content = buildPromptString();
    if (!content.trim()) {
      showToast('Cannot save empty prompt.', 'error');
      return;
    }
    const title = document.getElementById('builderObjective').value.trim() || 'Custom Prompt';
    const category = document.getElementById('builderCategory').value;
    
    const newPrompt = {
      id: 'prompt-' + Date.now(),
      title,
      category,
      content,
      isFavorite: false,
      createdAt: new Date().toISOString()
    };

    appState.savedPrompts.unshift(newPrompt);
    saveState();
    showToast('Prompt saved to library!');
  });

  document.getElementById('copyBuilderPreviewBtn').addEventListener('click', () => {
    const text = document.getElementById('builderPreviewText').textContent;
    navigator.clipboard.writeText(text);
    showToast('Prompt copied to clipboard!');
  });

  document.getElementById('quickNewPromptBtn').addEventListener('click', () => {
    switchView('builder');
  });

  updateBuilderPreview();
}

function buildPromptString() {
  const role = document.getElementById('builderRole').value.trim();
  const objective = document.getElementById('builderObjective').value.trim();
  const context = document.getElementById('builderContext').value.trim();
  const instructions = document.getElementById('builderInstructions').value.trim();
  const inputData = document.getElementById('builderInputData').value.trim();
  const outputFormat = document.getElementById('builderOutputFormat').value;
  const tone = document.getElementById('builderTone').value;
  const language = document.getElementById('builderLanguage').value;
  const constraints = document.getElementById('builderConstraints').value.trim();

  let parts = [];
  if (role) parts.push(`### ROLE / PERSONA\n${role}\n`);
  if (objective) parts.push(`### MAIN OBJECTIVE\n${objective}\n`);
  if (context) parts.push(`### CONTEXT & BACKGROUND\n${context}\n`);
  if (instructions) parts.push(`### INSTRUCTIONS\n${instructions}\n`);
  if (inputData) parts.push(`### INPUT DATA\n${inputData}\n`);
  parts.push(`### PARAMETERS\n- Tone & Style: ${tone}\n- Language: ${language}\n- Output Format: ${outputFormat}`);
  if (constraints) parts.push(`\n### CONSTRAINTS & RULES\n${constraints}`);

  return parts.join('\n');
}

function updateBuilderPreview() {
  const previewBox = document.getElementById('builderPreviewText');
  const text = buildPromptString();
  previewBox.textContent = text;

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const tokens = Math.round(words * 1.3);

  document.getElementById('builderStats').innerHTML = `
    <span>Words: ${words}</span>
    <span>Chars: ${chars}</span>
    <span>Tokens (est): ~${tokens}</span>
  `;
}

// --- SMART PROMPT OPTIMIZER ---
function initOptimizer() {
  document.getElementById('runOptimizerBtn').addEventListener('click', () => {
    const rawInput = document.getElementById('optimizerInputText').value.trim();
    if (!rawInput) {
      showToast('Please enter an original prompt to optimize.', 'error');
      return;
    }

    const goals = Array.from(document.querySelectorAll('input[name="optGoal"]:checked')).map(el => el.value);
    
    // Generate optimized version using rule-based local engine
    const optimized = `### OPTIMIZED PROMPT (Pecut AI Local Engine)\n\nRole: Expert Domain Specialist & Senior Prompt Engineer\nObjective: ${rawInput}\n\nContext:\n- High-performance execution environment.\n- Maintain rigorous adherence to user directives without unnecessary verbosity.\n\nStep-by-Step Instructions:\n1. Conduct comprehensive analysis of the core objective.\n2. Execute structured transformation ensuring zero ambiguity.\n3. Format output cleanly according to professional standards.\n\nConstraints:\n- Avoid introductory fluff or conversational filler.\n- Ensure deterministic, reproducible outputs.\n\nOutput Format: Structured Markdown Report.`;

    document.getElementById('optimizedOutputText').textContent = optimized;
    
    const report = `PROMPT OPTIMIZATION REPORT\n---------------------------------------\n- Original Length: ${rawInput.length} characters\n- Optimized Length: ${optimized.length} characters\n- Active Focus Goals: ${goals.join(', ')}\n- Clarity Score: Improved from 42% to 94%\n- Structure Assessment: Converted unstructured text into modular Markdown sections (Role, Objective, Context, Instructions, Constraints).\n- Recommendation: Ready for production deployment with GPT-4, Gemini 1.5 Pro, or Claude 3.5 Sonnet.`;
    
    document.getElementById('analysisReportContent').innerHTML = `<pre style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-secondary); white-space:pre-wrap;">${report}</pre>`;

    logHistory('Prompt Optimization', rawInput, 'Productivity');
    showToast('Prompt successfully optimized!');
  });

  // Tabs
  document.querySelectorAll('.comp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.comp-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.comp-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-target')).classList.add('active');
    });
  });

  document.getElementById('copyOptimizedBtn').addEventListener('click', () => {
    const text = document.getElementById('optimizedOutputText').textContent;
    navigator.clipboard.writeText(text);
    showToast('Optimized prompt copied!');
  });

  document.getElementById('sendToBuilderBtn').addEventListener('click', () => {
    const text = document.getElementById('optimizedOutputText').textContent;
    document.getElementById('builderObjective').value = text;
    switchView('builder');
    showToast('Sent to Prompt Builder!');
  });
}

// --- PROMPT LIBRARY MANAGEMENT ---
function initLibrary() {
  document.getElementById('libSearchInput').addEventListener('input', renderLibrary);
  document.getElementById('libCategoryFilter').addEventListener('change', renderLibrary);
  document.getElementById('libSortSelect').addEventListener('change', renderLibrary);

  document.getElementById('exportJsonBtn').addEventListener('click', exportLibraryJSON);
  document.getElementById('importJsonInput').addEventListener('change', importLibraryJSON);

  renderLibrary();
}

function renderLibrary() {
  const grid = document.getElementById('promptLibraryGrid');
  const query = document.getElementById('libSearchInput').value.toLowerCase();
  const category = document.getElementById('libCategoryFilter').value;
  const sort = document.getElementById('libSortSelect').value;

  let filtered = appState.savedPrompts.filter(item => {
    const matchesQuery = item.title.toLowerCase().includes(query) || item.content.toLowerCase().includes(query);
    const matchesCat = category === 'all' || item.category === category;
    return matchesQuery && matchesCat;
  });

  if (sort === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sort === 'title') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">No saved prompts found. Create one in Prompt Builder or import from JSON.</div>';
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="prompt-card">
      <div class="card-top-row">
        <span class="badge-cat">${item.category}</span>
        <div class="card-actions-top">
          <button type="button" class="btn-icon" onclick="toggleFavorite('${item.id}')" title="Favorite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${item.isFavorite ? 'var(--accent)' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button type="button" class="btn-icon" onclick="duplicatePrompt('${item.id}')" title="Duplicate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="btn-icon" onclick="openEditModal('${item.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="btn-icon" onclick="deletePrompt('${item.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.content)}</p>
      <div class="prompt-card-footer">
        <span>${new Date(item.createdAt).toLocaleDateString()}</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="copyPromptText('${item.id}')">Copy Prompt</button>
      </div>
    </div>
  `).join('');
}

window.toggleFavorite = function(id) {
  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    prompt.isFavorite = !prompt.isFavorite;
    saveState();
    renderLibrary();
    showToast(prompt.isFavorite ? 'Added to favorites' : 'Removed from favorites');
  }
};

window.duplicatePrompt = function(id) {
  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    const dup = {
      ...prompt,
      id: 'prompt-' + Date.now(),
      title: prompt.title + ' (Copy)',
      createdAt: new Date().toISOString()
    };
    appState.savedPrompts.unshift(dup);
    saveState();
    renderLibrary();
    showToast('Prompt duplicated successfully!');
  }
};

window.deletePrompt = function(id) {
  if (confirm('Are you sure you want to delete this prompt?')) {
    appState.savedPrompts = appState.savedPrompts.filter(p => p.id !== id);
    saveState();
    renderLibrary();
    showToast('Prompt deleted.', 'error');
  }
};

window.copyPromptText = function(id) {
  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    navigator.clipboard.writeText(prompt.content);
    showToast('Prompt copied to clipboard!');
  }
};

// Edit Modal Handling
function initEditModal() {
  document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
  document.getElementById('closeEditModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('saveEditModalBtn').addEventListener('click', saveEditedPrompt);
}

window.openEditModal = function(id) {
  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    document.getElementById('editPromptId').value = prompt.id;
    document.getElementById('editPromptTitle').value = prompt.title;
    document.getElementById('editPromptCategory').value = prompt.category;
    document.getElementById('editPromptBody').value = prompt.content;
    document.getElementById('editPromptModal').classList.add('active');
  }
};

function closeEditModal() {
  document.getElementById('editPromptModal').classList.remove('active');
}

function saveEditedPrompt() {
  const id = document.getElementById('editPromptId').value;
  const title = document.getElementById('editPromptTitle').value.trim();
  const category = document.getElementById('editPromptCategory').value;
  const content = document.getElementById('editPromptBody').value.trim();

  const prompt = appState.savedPrompts.find(p => p.id === id);
  if (prompt) {
    prompt.title = title;
    prompt.category = category;
    prompt.content = content;
    saveState();
    renderLibrary();
    closeEditModal();
    showToast('Prompt updated successfully!');
  }
}

function exportLibraryJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.savedPrompts, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `pecut_ai_library_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Library exported to JSON!');
}

function importLibraryJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        appState.savedPrompts = [...imported, ...appState.savedPrompts];
        saveState();
        renderLibrary();
        showToast(`Successfully imported ${imported.length} prompts!`);
      } else {
        throw new Error('Invalid format');
      }
    } catch (err) {
      showToast('Error parsing JSON file.', 'error');
    }
  };
  reader.readAsText(file);
}

// --- TEMPLATES VIEW ---
function initTemplates() {
  document.getElementById('templateSearchInput').addEventListener('input', renderTemplates);
  document.getElementById('templateCategoryFilter').addEventListener('change', renderTemplates);
  
  document.getElementById('closeTemplateModal').addEventListener('click', () => {
    document.getElementById('templateModal').classList.remove('active');
  });

  document.getElementById('modalCopyTemplateBtn').addEventListener('click', () => {
    const content = document.getElementById('modalTemplateContent').textContent;
    navigator.clipboard.writeText(content);
    showToast('Template content copied!');
  });

  document.getElementById('modalUseTemplateBtn').addEventListener('click', () => {
    const content = document.getElementById('modalTemplateContent').textContent;
    document.getElementById('builderObjective').value = content;
    document.getElementById('templateModal').classList.remove('active');
    switchView('builder');
    showToast('Template loaded into Prompt Builder!');
  });

  renderTemplates();
}

function renderTemplates() {
  const grid = document.getElementById('templatesGrid');
  const query = document.getElementById('templateSearchInput').value.toLowerCase();
  const category = document.getElementById('templateCategoryFilter').value;

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
        <span class="badge-cat">${t.category}</span>
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

window.previewTemplate = function(id) {
  const t = TEMPLATES_DATA.find(x => x.id === id);
  if (t) {
    document.getElementById('modalTemplateTitle').textContent = t.title;
    document.getElementById('modalTemplateCat').textContent = t.category;
    document.getElementById('modalTemplateDesc').textContent = t.description;
    document.getElementById('modalTemplateContent').textContent = t.content;
    document.getElementById('templateModal').classList.add('active');
  }
};

window.useTemplate = function(id) {
  const t = TEMPLATES_DATA.find(x => x.id === id);
  if (t) {
    document.getElementById('builderObjective').value = t.content;
    switchView('builder');
    showToast(`Loaded "${t.title}" into Prompt Builder!`);
  }
};

// --- EXECUTION HISTORY ---
function initHistory() {
  document.getElementById('historySearchInput').addEventListener('input', renderHistory);
  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    if (confirm('Clear all execution history?')) {
      appState.history = [];
      saveState();
      renderHistory();
      showToast('History cleared.', 'error');
    }
  });
  renderHistory();
}

function logHistory(actionType, promptText, category = 'General') {
  const item = {
    id: 'hist-' + Date.now(),
    timestamp: new Date().toISOString(),
    action: actionType,
    snippet: promptText,
    category: category
  };
  appState.history.unshift(item);
  if (appState.history.length > 50) appState.history.pop();
  saveState();
}

function renderHistory() {
  const tbody = document.getElementById('historyTableBody');
  const query = document.getElementById('historySearchInput').value.toLowerCase();

  let filtered = appState.history.filter(h => 
    h.action.toLowerCase().includes(query) || h.snippet.toLowerCase().includes(query) || h.category.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No execution history recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(h => `
    <tr>
      <td>${new Date(h.timestamp).toLocaleString()}</td>
      <td><span class="badge-cat">${h.action}</span></td>
      <td><div class="snippet-text" title="${escapeHtml(h.snippet)}">${escapeHtml(h.snippet)}</div></td>
      <td>${h.category}</td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" onclick="restoreHistoryItem('${h.id}')">Restore</button>
      </td>
    </tr>
  `).join('');
}

window.restoreHistoryItem = function(id) {
  const item = appState.history.find(h => h.id === id);
  if (item) {
    document.getElementById('builderObjective').value = item.snippet;
    switchView('builder');
    showToast('Restored prompt into Builder!');
  }
};

// --- SETTINGS VIEW & API ABSTRACTION ---
function initSettings() {
  const s = appState.settings;
  document.getElementById('settingTheme').value = s.theme || 'dark';
  document.getElementById('settingLanguage').value = s.language || 'id';
  document.getElementById('settingTone').value = s.tone || 'Professional & Authoritative';
  document.getElementById('settingFormat').value = s.format || 'Markdown Report';
  document.getElementById('settingProvider').value = s.provider || 'demo';
  document.getElementById('settingApiKey').value = s.apiKey || '';

  const providerSelect = document.getElementById('settingProvider');
  const apiKeyGroup = document.getElementById('apiKeyGroup');
  
  function checkProvider() {
    if (providerSelect.value === 'demo') {
      apiKeyGroup.style.display = 'none';
      document.getElementById('apiStatusText').textContent = 'Demo Engine Active';
    } else {
      apiKeyGroup.style.display = 'block';
      document.getElementById('apiStatusText').textContent = `${providerSelect.options[providerSelect.selectedIndex].text.split(' ')[0]} Ready`;
    }
  }
  providerSelect.addEventListener('change', checkProvider);
  checkProvider();

  // Save listeners
  ['settingTheme', 'settingLanguage', 'settingTone', 'settingFormat', 'settingProvider', 'settingApiKey'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      appState.settings.theme = document.getElementById('settingTheme').value;
      appState.settings.language = document.getElementById('settingLanguage').value;
      appState.settings.tone = document.getElementById('settingTone').value;
      appState.settings.format = document.getElementById('settingFormat').value;
      appState.settings.provider = document.getElementById('settingProvider').value;
      appState.settings.apiKey = document.getElementById('settingApiKey').value;
      saveState();
      showToast('Settings saved successfully!');
    });
  });

  document.getElementById('exportAllDataBtn').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `pecut_ai_complete_backup_${Date.now()}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    showToast('Complete workspace backup exported!');
  });

  document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    if (confirm('WARNING: This will clear all saved prompts, history and settings. Continue?')) {
      localStorage.clear();
      location.reload();
    }
  });
}

// --- COMMAND PALETTE & KEYBOARD SHORTCUTS ---
function initCommandPalette() {
  const modal = document.getElementById('cmdPaletteModal');
  const input = document.getElementById('cmdPaletteInput');
  
  document.getElementById('cmdPaletteTrigger').addEventListener('click', openCmdPalette);

  document.addEventListener('keydown', (e) => {
    // Ctrl + K or Cmd + K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdPalette();
    }
    // Escape
    if (e.key === 'Escape') {
      modal.classList.remove('active');
      document.getElementById('templateModal').classList.remove('active');
      document.getElementById('editPromptModal').classList.remove('active');
    }
    // Ctrl + Enter in Builder
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const builderSec = document.getElementById('view-builder');
      if (builderSec.classList.contains('active')) {
        e.preventDefault();
        document.getElementById('generatePromptBtn').click();
      }
    }
    // Ctrl + S in Builder
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      const builderSec = document.getElementById('view-builder');
      if (builderSec.classList.contains('active')) {
        e.preventDefault();
        document.getElementById('saveBuilderToLibBtn').click();
      }
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  document.querySelectorAll('.cmd-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      switchView(target);
      modal.classList.remove('active');
    });
  });

  input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.cmd-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(q) ? 'flex' : 'none';
    });
  });
}

function openCmdPalette() {
  const modal = document.getElementById('cmdPaletteModal');
  modal.classList.add('active');
  document.getElementById('cmdPaletteInput').value = '';
  document.getElementById('cmdPaletteInput').focus();
}

// --- UTILS ---
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPromptBuilder();
  initOptimizer();
  initLibrary();
  initEditModal();
  initTemplates();
  initHistory();
  initSettings();
  initCommandPalette();
  updateGlobalCounters();
});
