/**
 * Pecut AI — Curated Professional Prompt Templates (22 Templates)
 * Apache-2.0 License
 */

export const TEMPLATES_DATA = [
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
