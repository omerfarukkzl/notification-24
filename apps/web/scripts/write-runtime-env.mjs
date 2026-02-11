import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentFile = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(currentFile);
const webRoot = path.resolve(scriptsDir, '..');
const repoRoot = path.resolve(webRoot, '..', '..');

loadIfExists(path.join(repoRoot, '.env'));
loadIfExists(path.join(webRoot, '.env'));

const runtimeEnv = {
  apiBaseUrl: process.env.WEB_API_BASE_URL ?? 'http://localhost:5050',
  firebase: {
    apiKey: process.env.WEB_FIREBASE_API_KEY ?? 'replace-with-firebase-api-key',
    authDomain: process.env.WEB_FIREBASE_AUTH_DOMAIN ?? 'replace-with-firebase-auth-domain',
    projectId: process.env.WEB_FIREBASE_PROJECT_ID ?? 'replace-with-firebase-project-id',
    appId: process.env.WEB_FIREBASE_APP_ID ?? 'replace-with-firebase-app-id'
  }
};

const targetFile = path.join(webRoot, 'src', 'assets', 'env.js');
fs.mkdirSync(path.dirname(targetFile), { recursive: true });
fs.writeFileSync(
  targetFile,
  `window.__APP_ENV__ = ${JSON.stringify(runtimeEnv, null, 2)};\n`,
  'utf8'
);

console.log(`[env] wrote ${path.relative(repoRoot, targetFile)}`);

function loadIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  dotenv.config({ path: filePath, override: true });
}
