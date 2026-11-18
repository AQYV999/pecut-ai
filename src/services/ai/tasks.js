/**
 * Pecut AI — Domain AI Tasks (Prompt Optimizer & Flow Step Runner)
 * Apache-2.0 License
 *
 * Implements the 3-tier resolution cascade:
 * Tier 1: Client BYOK in localStorage
 * Tier 2: Server-side .env configuration (via /api/ai/* endpoints)
 * Tier 3: Deterministic offline structural analyzer & mock generator
 */

import { loadBYOKConfig } from '../../modules/storage.js';
import { analyzePromptLocally } from '../../modules/optimizer.js';
import { completeChat } from './transport.js';

/**
 * Optimizes a user prompt using the 3-tier cascade.
 * @param {string} prompt
 * @param {string[]} goals
 * @returns {Promise<Object>}
 */
export async function optimizePromptWithAI(prompt, goals = []) {
  const byok = loadBYOKConfig();

  // Tier 1: Client BYOK configured
  if (byok.apiKey || byok.provider === 'custom') {
    try {
      const goalsText = goals.length ? goals.join(', ') : 'clarity, structure, precision, actionable constraints';
      const systemPrompt = `You are Pecut AI's Senior Prompt Optimization Engine.
Analyze the user's raw prompt and transform it into a high-performance, structured, production-grade prompt.
Focus Goals: ${goalsText}.

You MUST respond strictly with a valid JSON object matching this schema, without markdown code fences:
{
  "optimizedPrompt": "Enhanced prompt with Role, Objective, Context, Instructions, Constraints, Output Format",
  "analysis": "A concise expert review detailing original clarity, missing sections, and ambiguities",
  "improvements": ["Specific improvement 1", "Specific improvement 2", "Specific improvement 3"]
}`;

      const res = await completeChat({
        systemPrompt,
        messages: [{ role: 'user', content: `PROMPT TO OPTIMIZE:\n${prompt}` }],
        temperature: 0.2
      });

      // Parse JSON from text with robust regex extraction
      let cleaned = res.text.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      } else {
        if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);
      return {
        mode: 'ai',
        provider: res.provider,
        model: res.model,
        hasKey: true,
        ...parsed
      };
    } catch (err) {
      // Fallback to local structural
      return {
        mode: 'fallback',
        error: err.message
      };
    }
  }

  // Tier 2: Check server .env
  try {
    const serverRes = await fetch('/api/ai/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, goals })
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.mode === 'ai') return data;
    }
  } catch (_) {
    // Continue to Tier 3
  }

  // Tier 3: Local Deterministic Analysis
  const localAnalysis = analyzePromptLocally(prompt);
  return {
    mode: 'demo',
    analysis: `Local Structural Analysis: Found ${localAnalysis.words} words across ${localAnalysis.sections.length} core sections (${localAnalysis.sections.join(', ') || 'No headers detected'}).`,
    improvements: [
      localAnalysis.hasRole ? 'Role is established.' : 'Add a clear # Role (e.g. Senior Software Architect).',
      localAnalysis.hasOutput ? 'Output format defined.' : 'Specify # Output Format (e.g. Markdown table or bullet points).',
      localAnalysis.hasConstraints ? 'Constraints present.' : 'Add # Constraints to prevent hallucinations and establish boundaries.'
    ]
  };
}

/**
 * Executes a single step of a Pecut Flow pipeline via the 3-tier cascade.
 * @param {Object} stepData
 * @returns {Promise<Object>}
 */
export async function executeFlowStep(stepData) {
  const byok = loadBYOKConfig();

  // Tier 1: Client BYOK configured
  if (byok.apiKey || byok.provider === 'custom') {
    try {
      const promptText = `WORKFLOW INPUT:\n${stepData.inputData}\n\nPREVIOUS STEP OUTPUT:\n${stepData.previousOutput || '(Initial step - no previous output)'}\n\nTASK INSTRUCTIONS:\n${stepData.stepInstruction}`;
      const systemPrompt = `You are Pecut AI Workflow Engine executing Step ${Number(stepData.stepIndex) + 1}: "${stepData.stepTitle}". Provide a direct, authoritative, structured output. Avoid filler text.`;

      const res = await completeChat({
        systemPrompt,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.3
      });

      return {
        mode: 'ai',
        flowId: stepData.flowId,
        stepIndex: stepData.stepIndex,
        stepTitle: stepData.stepTitle,
        output: res.text,
        provider: res.provider,
        model: res.model,
        hasKey: true
      };
    } catch (err) {
      // Fallback to local generation
      return {
        mode: 'demo',
        stepIndex: stepData.stepIndex,
        stepTitle: stepData.stepTitle,
        output: `### [STEP ${stepData.stepIndex + 1}: ${stepData.stepTitle}]\n\nProcessed: ${stepData.inputData}\n\nOutcome:\n- Step execution generated locally.\n- Note: ${err.message}`,
        hasKey: false
      };
    }
  }

  // Tier 2: Check server .env
  try {
    const serverRes = await fetch('/api/ai/flow/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stepData)
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.mode === 'ai') return data;
    }
  } catch (_) {
    // Continue to Tier 3
  }

  // Tier 3: Local Offline Generation
  return {
    mode: 'demo',
    stepIndex: stepData.stepIndex,
    stepTitle: stepData.stepTitle,
    output: `### [STEP ${stepData.stepIndex + 1}: ${stepData.stepTitle} — Local Mode]\n\nProcessing "${stepData.inputData}":\n1. Structured output generated by Pecut AI local engine.\n2. Connect an AI provider in Settings to run live inference with OpenRouter, Gemini, or Groq.`,
    hasKey: false
  };
}
