/**
 * Pecut AI — Provider Mocking Fixtures
 * Deterministic mocked AI provider responses for E2E tests.
 * All mocks intercept requests to /api/ai/proxy and provider endpoints.
 */

import { test as base } from '@playwright/test';

/**
 * Mock response templates matching the actual transport layer format.
 * See src/services/ai/transport.js for response structure.
 */
export const mockResponses = {
  /**
   * Successful completion response matching OpenAI-compatible format
   */
  success: (content, options = {}) => ({
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content,
        reasoning: options.reasoning || '',
      },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: options.promptTokens || 150,
      completion_tokens: options.completionTokens || 200,
      total_tokens: (options.promptTokens || 150) + (options.completionTokens || 200),
    },
    model: options.model || 'meta-llama/llama-3.3-70b-instruct:free',
  }),

  /**
   * Streaming-style response (if streaming is implemented)
   */
  streamChunk: (content, isLast = false) => ({
    choices: [{
      index: 0,
      delta: { content },
      finish_reason: isLast ? 'stop' : null,
    }],
  }),

  /**
   * Rate limit response (HTTP 429)
   */
  rateLimit: (retryAfter = 2) => ({
    status: 429,
    headers: { 'retry-after': String(retryAfter) },
    body: { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } },
  }),

  /**
   * Invalid request (HTTP 400)
   */
  badRequest: (message = 'Invalid request') => ({
    status: 400,
    body: { error: { message, type: 'invalid_request_error' } },
  }),

  /**
   * Unauthorized (HTTP 401)
   */
  unauthorized: () => ({
    status: 401,
    body: { error: { message: 'Invalid API key', type: 'authentication_error' } },
  }),

  /**
   * Server error (HTTP 500)
   */
  serverError: (message = 'Internal server error') => ({
    status: 500,
    body: { error: { message, type: 'server_error' } },
  }),

  /**
   * High demand / overloaded (HTTP 503)
   */
  highDemand: () => ({
    status: 503,
    body: { error: { message: 'High demand, please try again later', type: 'server_error' } },
  }),

  /**
   * Empty response
   */
  empty: () => ({
    choices: [{
      index: 0,
      message: { role: 'assistant', content: '' },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
  }),

  /**
   * Malformed response (invalid JSON structure)
   */
  malformed: () => 'not valid json {{{',

  /**
   * Response with thinking/reasoning blocks
   */
  withReasoning: (content, reasoning) => ({
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: `Here is my analysis:\n\n${content}`,
        reasoning: reasoning,
      },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 200, completion_tokens: 300, total_tokens: 500 },
  }),
};

/**
 * Predefined workflow step responses for deterministic testing
 */
export const workflowStepResponses = {
  step1Research: mockResponses.success(
    `## Research Findings: {{input}}

### Overview
Comprehensive research on the topic reveals several key areas of interest.

### Key Insights
1. **Primary Finding**: The core concept involves {{prev}} integration patterns
2. **Secondary Finding**: Modern approaches favor modular architecture
3. **Tertiary Finding**: Performance optimization requires careful consideration

### References
- Industry standard practices
- Recent technical publications
- Community best practices

This research provides the foundation for subsequent analysis.`,
    { promptTokens: 180, completionTokens: 250 }
  ),

  step2Analysis: mockResponses.success(
    `## Technical Analysis: {{step1}}

### Architecture Assessment
Based on the research findings, the technical approach should emphasize:

### Component Design
- **Module A**: Handles input processing with {{input}} validation
- **Module B**: Implements core logic leveraging {{prev}} patterns
- **Module C**: Provides output formatting per {{step:research-step-id}} specifications

### Data Flow
1. Input → Validation → Processing
2. Processing → Analysis → Synthesis
3. Synthesis → Formatting → Output

### Risk Mitigation
- Error handling at each stage
- Fallback mechanisms for external dependencies
- Performance monitoring integration

This analysis translates research into actionable technical specifications.`,
    { promptTokens: 220, completionTokens: 300 }
  ),

  step3Review: mockResponses.withReasoning(
    `## Critical Review: {{step2}}

### Executive Summary
The proposed architecture demonstrates solid fundamentals with room for enhancement.

### Strengths
✅ Clear separation of concerns
✅ Scalable modular design
✅ Comprehensive error handling strategy

### Areas for Improvement
⚠️ **Performance**: Consider caching layer for repeated operations
⚠️ **Security**: Add input sanitization at boundary layers
⚠️ **Observability**: Enhance logging for production debugging

### Recommendations
1. Implement Redis caching for frequent queries
2. Add rate limiting at API gateway
3. Integrate distributed tracing
4. Conduct load testing before deployment

### Final Verdict
**APPROVED WITH CONDITIONS** - Proceed with recommended enhancements.`,
    `The review considered multiple architectural patterns. The modular approach aligns with microservices best practices. However, the synchronous communication between modules could become a bottleneck at scale. Async messaging would improve resilience.`,
    { promptTokens: 190, completionTokens: 280 }
  ),
};

/**
 * Sets up provider mocking for a test context
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 */
export async function setupProviderMocks(page, options = {}) {
  const {
    scenario = 'success',
    delay = 0,
    customResponses = {},
    failAtStep = null,
  } = options;

  const responses = { ...workflowStepResponses, ...customResponses };

  await page.route('**/api/ai/proxy**', async (route) => {
    const request = route.request();
    const body = request.postDataJSON?.() || {};

    // Determine which step this is by examining messages
    let stepIndex = 0;
    if (body.messages && body.messages.length > 1) {
      // Look for step markers in the prompt
      const lastMsg = body.messages[body.messages.length - 1]?.content || '';
      if (lastMsg.includes('Step 1') || lastMsg.includes('Research')) stepIndex = 0;
      else if (lastMsg.includes('Step 2') || lastMsg.includes('Analysis')) stepIndex = 1;
      else if (lastMsg.includes('Step 3') || lastMsg.includes('Review')) stepIndex = 2;
    }

    // Check if we should fail at this step
    if (failAtStep !== null && stepIndex === failAtStep) {
      if (scenario === 'rateLimit') {
        const rl = mockResponses.rateLimit();
        return route.fulfill({ status: rl.status, headers: rl.headers, json: rl.body });
      }
      if (scenario === 'unauthorized') {
        const ua = mockResponses.unauthorized();
        return route.fulfill({ status: ua.status, json: ua.body });
      }
      if (scenario === 'serverError') {
        const se = mockResponses.serverError();
        return route.fulfill({ status: se.status, json: se.body });
      }
      if (scenario === 'highDemand') {
        const hd = mockResponses.highDemand();
        return route.fulfill({ status: hd.status, json: hd.body });
      }
      if (scenario === 'badRequest') {
        const br = mockResponses.badRequest();
        return route.fulfill({ status: br.status, json: br.body });
      }
    }

    // Simulate network delay if requested
    if (delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }

    // Return appropriate response based on step
    let response;
    if (stepIndex === 0) response = responses.step1Research;
    else if (stepIndex === 1) response = responses.step2Analysis;
    else if (stepIndex === 2) response = responses.step3Review;
    else response = mockResponses.success('Default mock response');

    await route.fulfill({ json: response });
  });

  // Also mock direct provider endpoints (for local/custom providers)
  await page.route('**/chat/completions', async (route) => {
    const request = route.request();
    const body = request.postDataJSON?.() || {};

    let stepIndex = 0;
    if (body.messages && body.messages.length > 1) {
      const lastMsg = body.messages[body.messages.length - 1]?.content || '';
      if (lastMsg.includes('Step 1') || lastMsg.includes('Research')) stepIndex = 0;
      else if (lastMsg.includes('Step 2') || lastMsg.includes('Analysis')) stepIndex = 1;
      else if (lastMsg.includes('Step 3') || lastMsg.includes('Review')) stepIndex = 2;
    }

    if (failAtStep !== null && stepIndex === failAtStep) {
      if (scenario === 'rateLimit') {
        const rl = mockResponses.rateLimit();
        return route.fulfill({ status: rl.status, headers: rl.headers, json: rl.body });
      }
      if (scenario === 'unauthorized') {
        const ua = mockResponses.unauthorized();
        return route.fulfill({ status: ua.status, json: ua.body });
      }
      if (scenario === 'serverError') {
        const se = mockResponses.serverError();
        return route.fulfill({ status: se.status, json: se.body });
      }
    }

    if (delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }

    let response;
    if (stepIndex === 0) response = responses.step1Research;
    else if (stepIndex === 1) response = responses.step2Analysis;
    else if (stepIndex === 2) response = responses.step3Review;
    else response = mockResponses.success('Default mock response');

    await route.fulfill({ json: response });
  });

  console.log(`🎭 [Provider Mocks] Configured: scenario=${scenario}, delay=${delay}ms, failAtStep=${failAtStep}`);
}

/**
 * Verifies the number of AI requests made
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function getAIRequestCount(page) {
  return await page.evaluate(() => {
    return window.__pecutAIRequestCount || 0;
  });
}

/**
 * Resets request counter
 * @param {import('@playwright/test').Page} page
 */
export async function resetAIRequestCount(page) {
  await page.evaluate(() => {
    window.__pecutAIRequestCount = 0;
  });
}

/**
 * Installs request counting on the page
 * @param {import('@playwright/test').Page} page
 */
export async function installRequestCounter(page) {
  await page.addInitScript(() => {
    window.__pecutAIRequestCount = 0;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0];
      if (typeof url === 'string' && (url.includes('/api/ai/proxy') || url.includes('/chat/completions'))) {
        window.__pecutAIRequestCount++;
      }
      return originalFetch.apply(this, args);
    };
  });
}