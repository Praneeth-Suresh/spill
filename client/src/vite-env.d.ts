/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly OAUTH_SERVER_URL: string;
  readonly VITE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
