/**
 * Pecut AI — Google Gemini Provider Adapter
 * Apache-2.0 License
 */

/**
 * Optimizes a user prompt using Google Gemini API.
 * @param {Object} options
 * @param {string} options.apiKey - Gemini API Key from server environment
 * @param {string} [options.model] - Model name (e.g., 'gemini-1.5-flash')
 * @param {string} options.prompt - Raw prompt string from user
 * @param {string[]} [options.goals] - Optimization goals (e.g., ['clarity', 'structure'])
 * @param {number} [options.timeoutMs] - Request timeout in milliseconds
 * @returns {Promise<{ optimizedPrompt: string, analysis: string, improvements: string[] }>}
 */
export async function callGeminiOptimizer({ apiKey, model, prompt, goals, timeoutMs = 30000 }) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const activeModel = model || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent`;

  const systemInstructions = `You are Pecut AI's Senior Prompt Optimization Engine.
Analyze the user's raw prompt and transform it into a high-performance, structured, production-grade prompt.

Focus Goals: ${goals && goals.length ? goals.join(', ') : 'clarity, structure, precision, actionable constraints'}.

You MUST return a valid JSON object matching this structure:
{
  "optimizedPrompt": "The complete, enhanced prompt with Role, Objective, Context, Instructions, Constraints, and Output Format",
  "analysis": "A concise expert review detailing the original prompt's clarity, missing sections, and potential ambiguities",
  "improvements": ["Specific improvement 1", "Specific improvement 2", "Specific improvement 3"]
}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemInstructions}\n\nRAW USER PROMPT TO OPTIMIZE:\n${prompt}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `Gemini API error (HTTP ${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) errMsg += `: ${parsed.error.message}`;
      } catch (_) {
        errMsg += `: ${errText.slice(0, 200)}`;
      }
      throw new Error(errMsg);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini returned an empty response');
    }

    try {
      const parsed = JSON.parse(candidateText);
      return {
        optimizedPrompt: parsed.optimizedPrompt || candidateText,
        analysis: parsed.analysis || 'Analysis completed successfully.',
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : []
      };
    } catch (_) {
      return {
        optimizedPrompt: candidateText,
        analysis: 'Model returned plain text response.',
        improvements: []
      };
    }
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Executes a single step in a Pecut Flow workflow using Google Gemini API.
 * @param {Object} options
 * @param {string} options.apiKey
 * @param {string} [options.model]
 * @param {string} options.prompt
 * @param {string} [options.systemInstruction]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ text: string }>}
 */
export async function callGeminiGenerate({ apiKey, model, prompt, systemInstruction, timeoutMs = 30000 }) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const activeModel = model || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `Gemini API error (HTTP ${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) errMsg += `: ${parsed.error.message}`;
      } catch (_) {
        errMsg += `: ${errText.slice(0, 200)}`;
      }
      throw new Error(errMsg);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini returned an empty response');
    }

    return { text: candidateText };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
