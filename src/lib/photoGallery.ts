import { VOLUMETRIC_LIMITS } from './limits.ts';
import { isValidImageSrc } from './format.ts';

export function normalizePhotoList(photos: string[]): string[] {
  return photos
    .map((photo) => photo.trim())
    .filter((photo) => photo.length > 0 && isValidImageSrc(photo))
    .slice(0, VOLUMETRIC_LIMITS.MAX_PHOTOS);
}

export function validatePhotoGallery(photos: string[]): string | null {
  const cleaned = photos.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length < VOLUMETRIC_LIMITS.MIN_PHOTOS) {
    return `Please upload at least ${VOLUMETRIC_LIMITS.MIN_PHOTOS} profile pictures (up to ${VOLUMETRIC_LIMITS.MAX_PHOTOS}).`;
  }
  if (cleaned.length > VOLUMETRIC_LIMITS.MAX_PHOTOS) {
    return `You can add up to ${VOLUMETRIC_LIMITS.MAX_PHOTOS} profile pictures.`;
  }
  for (let i = 0; i < cleaned.length; i += 1) {
    const src = cleaned[i];
    if (!isValidImageSrc(src)) {
      return `Picture #${i + 1} must be a valid image upload or HTTPS photo URL.`;
    }
    if (src.length > VOLUMETRIC_LIMITS.MAX_PHOTO_URL_LEN) {
      return `Picture #${i + 1} exceeds the maximum size limit. Please choose a smaller image.`;
    }
  }
  return null;
}

export function havePhotosChanged(previousPhotos: string[], nextPhotos: string[]): boolean {
  const prev = previousPhotos.map((p) => p.trim()).filter(Boolean);
  const next = nextPhotos.map((p) => p.trim()).filter(Boolean);
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== next[i]) return true;
  }
  return false;
}

export async function compressImageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPG, PNG, or WebP).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Selected file could not be decoded as an image.'));
    image.src = rawDataUrl;
  });

  const maxSide = 420;
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  const targetWidth = Math.max(120, Math.round((img.width || maxSide) * scale));
  const targetHeight = Math.max(120, Math.round((img.height || maxSide) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image processing is unavailable in this browser.');
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const qualities = [0.76, 0.64, 0.52, 0.42];
  for (const quality of qualities) {
    const encoded = canvas.toDataURL('image/jpeg', quality);
    if (encoded.length <= VOLUMETRIC_LIMITS.MAX_PHOTO_URL_LEN) {
      return encoded;
    }
  }

  throw new Error('Image is still too large after compression. Please pick a smaller picture.');
}
