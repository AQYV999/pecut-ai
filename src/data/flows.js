/**
 * Pecut AI — Curated Multi-Step Workflow Pipelines (Pecut Flow)
 * Apache-2.0 License
 */

export const DEFAULT_FLOWS = [
  {
    id: 'flow-content',
    title: 'Content Creation Pipeline',
    category: 'Marketing',
    description: 'Transforms a single seed topic into high-retention hooks, a structured outline, and social media copy.',
    steps: [
      {
        title: 'Hook & Angle Ideation',
        instruction: 'Generate 3 high-impact angles or hooks for the topic: {{input}}. Contrast common misconceptions with fresh perspectives.'
      },
      {
        title: 'Structured Article Outline',
        instruction: 'Using the best angle from Step 1:\n{{prev}}\n\nDesign a detailed 4-section outline with key talking points and bullet explanations.'
      },
      {
        title: 'Social Distribution Copy',
        instruction: 'Transform the outline from Step 2:\n{{prev}}\n\nCreate a crisp, engaging social media post with a compelling opening line and clear CTA.'
      }
    ]
  },
  {
    id: 'flow-code',
    title: 'Spec-to-Code Architecture Flow',
    category: 'Engineering',
    description: 'Turns a functional requirement into a technical specification, production code, and testing checklist.',
    steps: [
      {
        title: 'Architecture & Interface Spec',
        instruction: 'Define the architecture, data schemas, interface contracts, and key edge cases for the given requirement: {{input}}'
      },
      {
        title: 'Modular Implementation',
        instruction: 'Write the complete, clean, modular implementation based on the specification from Step 1:\n{{prev}}\n\nInclude clear comments.'
      },
      {
        title: 'Test Plan & Edge Case Checklist',
        instruction: 'Draft exhaustive unit and integration test scenarios covering normal operation, failure modes, and error recovery for:\n{{prev}}'
      }
    ]
  },
  {
    id: 'flow-study',
    title: 'Deep Concept Mastery Pipeline',
    category: 'Education',
    description: 'Decomposes complex technical or academic subjects into first principles, real-world analogies, and a self-test quiz.',
    steps: [
      {
        title: 'First-Principles Breakdown',
        instruction: 'Break down the core topic into its 3 fundamental principles without using confusing jargon: {{input}}'
      },
      {
        title: 'Real-World Analogy & Story',
        instruction: 'Construct an intuitive real-world analogy that illustrates how these principles function in practice based on:\n{{prev}}'
      },
      {
        title: 'Comprehension Quiz & Key',
        instruction: 'Create 3 scenario-based assessment questions with detailed answer explanations to verify complete mastery of:\n{{prev}}'
      }
    ]
  }
];
