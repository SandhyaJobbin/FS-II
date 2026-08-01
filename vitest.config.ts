import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.ts'],
    exclude: ['tests/**/*.js', 'assessment-app/**/*', 'tests/**/grading-engine.ts', 'tests/**/admin-auth.ts', 'tests/**/queue-logic.ts', 'tests/**/email-content.ts', 'tests/**/rubric-grader.ts'],
  },
});
