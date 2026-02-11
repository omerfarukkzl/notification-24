interface RuntimeFirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
}

interface RuntimeWebConfig {
  apiBaseUrl?: string;
  firebase?: RuntimeFirebaseConfig;
}

declare global {
  interface Window {
    __APP_ENV__?: RuntimeWebConfig;
  }
}

const runtimeConfig: RuntimeWebConfig =
  typeof window !== 'undefined' && window.__APP_ENV__
    ? window.__APP_ENV__
    : {};

const runtimeFirebase = runtimeConfig.firebase ?? {};

export const environment = {
  production: false,
  apiBaseUrl: runtimeConfig.apiBaseUrl ?? 'http://localhost:5050',
  firebase: {
    apiKey: runtimeFirebase.apiKey ?? 'replace-with-firebase-api-key',
    authDomain: runtimeFirebase.authDomain ?? 'replace-with-firebase-auth-domain',
    projectId: runtimeFirebase.projectId ?? 'replace-with-firebase-project-id',
    appId: runtimeFirebase.appId ?? 'replace-with-firebase-app-id'
  }
};
