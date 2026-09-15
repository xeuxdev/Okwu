/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
  const url: string;
  export default url;
}

declare module 'mammoth' {
  export interface RawTextResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<RawTextResult>;
}

declare const __DEFAULT_OPENAI_KEY__: string;
declare const __DEFAULT_OPENAI_MODEL__: string;
