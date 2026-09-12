import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface TextExtractionResult {
  text: string;
  pageCount?: number;
  wordCount: number;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'unknown';
}

export async function extractTextFromFile(file: File): Promise<TextExtractionResult> {
  const fileName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (fileName.endsWith('.pdf')) {
    return extractTextFromPdf(arrayBuffer, file.name);
  }

  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return extractTextFromDocx(arrayBuffer, file.name);
  }

  throw new Error('Unsupported file format. Please upload a PDF or DOCX file.');
}

export async function extractTextFromPdf(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<TextExtractionResult> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true
    });

    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageStrings: string[] = [];
      for (const item of content.items) {
        if ('str' in item && typeof item.str === 'string') {
          pageStrings.push(item.str);
        }
      }

      fullText += pageStrings.join(' ') + '\n';
    }

    const cleanedText = cleanExtractedText(fullText);
    const wordCount = countWords(cleanedText);

    return {
      text: cleanedText,
      pageCount: pdf.numPages,
      wordCount,
      fileName,
      fileType: 'pdf'
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown PDF parsing error';
    throw new Error(`Failed to extract text from PDF (${fileName}): ${message}`);
  }
}

export async function extractTextFromDocx(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<TextExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    const cleanedText = cleanExtractedText(result.value);
    const wordCount = countWords(cleanedText);

    return {
      text: cleanedText,
      wordCount,
      fileName,
      fileType: 'docx'
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown DOCX parsing error';
    throw new Error(`Failed to extract text from DOCX (${fileName}): ${message}`);
  }
}

function cleanExtractedText(raw: string): string {
  return raw
    // Replace em dashes and en dashes with standard hyphens
    .replace(/[\u2014\u2013]/g, '-')
    // Replace multiple spaces with a single space
    .replace(/[ \t]+/g, ' ')
    // Replace excessive newlines
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}
