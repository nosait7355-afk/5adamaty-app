/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** خادم الـAPI — انظر `config.ts`. */
  readonly VITE_API_ORIGIN?: string;
}

/** يوجد `android/app/google-services.json` وقت البناء — انظر `src/push.tsx`. */
declare const __PUSH_ENABLED__: boolean;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
