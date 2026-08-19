/**
 * generate-service-token.ts
 *
 * Generates a JWT service token for the Stats worker/Lambda.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/generate-service-token.ts
 *   npx ts-node -r tsconfig-paths/register scripts/generate-service-token.ts --expires-in 30d
 *
 * The token is printed to stdout. Store it in AWS Secrets Manager.
 */

import * as jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import * as crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Error: JWT_SECRET environment variable is required');
  process.exit(1);
}

const args = process.argv.slice(2);
const expiresInIndex = args.indexOf('--expires-in');
const expiresIn = expiresInIndex !== -1 ? args[expiresInIndex + 1] : '90d';

const payload = {
  sub: 'stats-worker',
  role: 'SERVICE',
  scope: ['stats:read', 'stats:write'],
};

const token = jwt.sign(payload, JWT_SECRET, {
  expiresIn: expiresIn as SignOptions['expiresIn'],
  jwtid: crypto.randomUUID(),
});

console.log('');
console.log('=== Stats Service Token ===');
console.log('');
console.log(`Expires in: ${expiresIn}`);
console.log('');
console.log('Token:');
console.log(token);
console.log('');
console.log('Store this in AWS Secrets Manager as STATS_SERVICE_JWT');
console.log('');
