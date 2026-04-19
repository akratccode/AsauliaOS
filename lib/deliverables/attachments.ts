export const ATTACHMENT_BUCKET = 'deliverable-attachments';
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB
export const SIGNED_URL_EXPIRY_SECONDS = 5 * 60;

export const ALLOWED_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/zip',
  'application/x-figma',
  'image/vnd.adobe.photoshop',
  'application/postscript',
]);

export function isAllowedMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return ALLOWED_MIME_TYPES.has(mime);
}

export function validateAttachmentInput(input: {
  mimeType: string | null | undefined;
  sizeBytes: number;
}): void {
  if (!isAllowedMime(input.mimeType)) {
    throw new Error(`MIME type ${input.mimeType ?? 'unknown'} is not allowed`);
  }
  if (input.sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `Attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes (got ${input.sizeBytes})`,
    );
  }
}

export function buildAttachmentPath(input: {
  brandId: string;
  deliverableId: string;
  fileName: string;
  uuid: string;
}): string {
  const safeName = input.fileName.replace(/[^\w.\-]/g, '_').slice(0, 100);
  return `brand_${input.brandId}/deliverable_${input.deliverableId}/${input.uuid}-${safeName}`;
}
