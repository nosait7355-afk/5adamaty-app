/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** خادم الـAPI — انظر `config.ts`. */
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
