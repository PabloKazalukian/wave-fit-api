// modules/ai/ai-error-causes.ts
export const AI_CAUSE = {
  PROVIDER: 'AI_PROVIDER_ERROR',
  MALFORMED_JSON: 'AI_MALFORMED_JSON',
  EMPTY_RESPONSE: 'AI_EMPTY_RESPONSE',
  UNKNOWN_EXERCISE_NAME: 'AI_UNKNOWN_EXERCISE_NAME',
  RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
} as const;

export type AiErrorCause = (typeof AI_CAUSE)[keyof typeof AI_CAUSE];
