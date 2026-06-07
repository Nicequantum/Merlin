import { api } from '@/lib/api';
import type { ImageAttachment } from '@/types';

export async function uploadFileAsAttachment(file: File, idPrefix: string): Promise<ImageAttachment> {
  const { url, name } = await api.uploadImage(file);
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    name: name || file.name,
  };
}

export async function uploadFilesAsAttachments(files: File[], idPrefix: string): Promise<ImageAttachment[]> {
  const results: ImageAttachment[] = [];
  for (const file of files) {
    results.push(await uploadFileAsAttachment(file, idPrefix));
  }
  return results;
}