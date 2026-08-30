/**
 * Helper for test-admin-jwt-secret.mjs. Importing server/src/config/env.ts
 * triggers its eager Zod validation (and process.exit(1) on failure) as a
 * side effect of module load, so this has to run in its own child process
 * per scenario rather than being asserted on in-process.
 */
await import('../src/config/env.js');
console.log('ENV_OK');
