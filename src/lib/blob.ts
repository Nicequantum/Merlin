import { put } from '@vercel/blob';

export async function uploadImageToBlob(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = await put(`benz-tech/${Date.now()}-${safeName}`, buffer, {
    access: 'public',
    contentType,
    token,
  });

  return blob.url;
}