import { getEnv } from "../config";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILENAME_LENGTH = 180;

export interface UploadResult {
  key: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

function getExtension(originalName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(originalName);
  return match ? match[0].toLowerCase() : "";
}

function safeFilename(originalName: string): string {
  const base = originalName.split(/[\\/]/).pop() ?? "resume";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[^\w.() -]/g, "_").slice(0, MAX_FILENAME_LENGTH) || "resume";
}

function hasExpectedSignature(buffer: ArrayBuffer, mimetype: string): boolean {
  const bytes = new Uint8Array(buffer).subarray(0, 8);
  if (mimetype === "application/pdf") return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (mimetype === "application/msword") return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return false;
}

function randomSuffix(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
}

export const storageService = {
  validateFile(file: { mimetype: string; size: number; originalname?: string; buffer?: ArrayBuffer }): { valid: boolean; error?: string } {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return { valid: false, error: "Only PDF, DOC, and DOCX files are accepted." };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: "File size must not exceed 10 MB." };
    }
    const extension = file.originalname ? getExtension(file.originalname) : "";
    const expected = file.mimetype === "application/pdf" ? ".pdf" : file.mimetype === "application/msword" ? ".doc" : ".docx";
    if (!file.originalname || extension !== expected) return { valid: false, error: "The file extension must match its document type." };
    if (file.buffer && !hasExpectedSignature(file.buffer, file.mimetype)) return { valid: false, error: "The uploaded document could not be verified." };
    return { valid: true };
  },

  generateKey(originalName: string): string {
    const ext = getExtension(originalName);
    return `resumes/${Date.now()}-${randomSuffix()}${ext}`;
  },

  async upload(file: { buffer: ArrayBuffer; originalname: string; mimetype: string; size: number }): Promise<UploadResult> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const key = this.generateKey(file.originalname);
    const bucket = getEnv().R2_BUCKET;

    await bucket.put(key, file.buffer, {
      httpMetadata: { contentType: file.mimetype },
      customMetadata: { originalName: file.originalname },
    });

    return {
      key,
      url: key,
      filename: safeFilename(file.originalname),
      size: file.size,
      mimeType: file.mimetype,
    };
  },

  async delete(key: string): Promise<void> {
    const bucket = getEnv().R2_BUCKET;
    await bucket.delete(key);
  },

  async getObject(key: string): Promise<R2ObjectBody | null> {
    const bucket = getEnv().R2_BUCKET;
    return bucket.get(key);
  },
};
