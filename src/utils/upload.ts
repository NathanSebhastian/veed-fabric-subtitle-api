import { fal } from '@fal-ai/client';

export async function uploadToFal(file: File): Promise<string> {
  return fal.storage.upload(file);
}
