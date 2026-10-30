/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_ORIGIN?: string;
    /** 'cis' for the cis women's edition (`vite build --mode cis`); unset otherwise. See src/edition.ts. */
    readonly VITE_EDITION?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
