import React, { useRef, useState } from 'react';
import {
  ArrowUpLeft,
  ImagePlus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { PORTRAIT_PRESETS, VOLUMETRIC_LIMITS } from '../lib/constants';
import { isValidImageSrc } from '../lib/format';
import { compressImageFileToDataUrl } from '../lib/photoGallery';
import { AvatarImage } from './AvatarImage';

interface PhotoGalleryEditorProps {
  photos: string[];
  onChange: (nextPhotos: string[]) => void;
  requireVerificationOnChange?: boolean;
  hasUnsavedChanges?: boolean;
}

export function PhotoGalleryEditor({
  photos,
  onChange,
  requireVerificationOnChange = false,
  hasUnsavedChanges = false,
}: PhotoGalleryEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIdxRef = useRef<number | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  const slots = Array.from({ length: VOLUMETRIC_LIMITS.MAX_PHOTOS }, (_, idx) => photos[idx] ?? null);
  const meetsMinimum = photos.length >= VOLUMETRIC_LIMITS.MIN_PHOTOS;

  const openFilePicker = (targetIndex: number | null) => {
    setGalleryError(null);
    replaceTargetIdxRef.current = targetIndex;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.multiple = targetIndex === null;
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    setGalleryError(null);
    const targetIdx = replaceTargetIdxRef.current;
    replaceTargetIdxRef.current = null;

    try {
      const files = Array.from(fileList);
      if (targetIdx !== null && targetIdx >= 0 && targetIdx < photos.length) {
        const compressed = await compressImageFileToDataUrl(files[0]);
        const next = [...photos];
        next[targetIdx] = compressed;
        onChange(next.slice(0, VOLUMETRIC_LIMITS.MAX_PHOTOS));
      } else {
        const remainingSlots = VOLUMETRIC_LIMITS.MAX_PHOTOS - photos.length;
        if (remainingSlots <= 0) {
          setGalleryError(`Maximum ${VOLUMETRIC_LIMITS.MAX_PHOTOS} pictures allowed.`);
          return;
        }
        const toProcess = files.slice(0, remainingSlots);
        const compressedBatch: string[] = [];
        for (const file of toProcess) {
          compressedBatch.push(await compressImageFileToDataUrl(file));
        }
        onChange([...photos, ...compressedBatch].slice(0, VOLUMETRIC_LIMITS.MAX_PHOTOS));
      }
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : 'Unable to upload selected picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = () => {
    setGalleryError(null);
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    if (!isValidImageSrc(trimmed)) {
      setGalleryError('Enter a valid HTTPS image URL.');
      return;
    }
    if (trimmed.length > VOLUMETRIC_LIMITS.MAX_PHOTO_URL_LEN) {
      setGalleryError('Image URL exceeds maximum allowed length.');
      return;
    }
    if (photos.length >= VOLUMETRIC_LIMITS.MAX_PHOTOS) {
      setGalleryError(`Maximum ${VOLUMETRIC_LIMITS.MAX_PHOTOS} pictures allowed. Remove or replace one first.`);
      return;
    }
    onChange([...photos, trimmed]);
    setUrlDraft('');
  };

  const handleAddPreset = (url: string) => {
    setGalleryError(null);
    if (photos.includes(url)) {
      setGalleryError('This studio portrait is already in your gallery.');
      return;
    }
    if (photos.length >= VOLUMETRIC_LIMITS.MAX_PHOTOS) {
      setGalleryError(`Gallery already has ${VOLUMETRIC_LIMITS.MAX_PHOTOS} pictures. Remove one first.`);
      return;
    }
    onChange([...photos, url]);
  };

  const handleFillRemainingPresets = () => {
    setGalleryError(null);
    const next = [...photos];
    for (const preset of PORTRAIT_PRESETS) {
      if (next.length >= VOLUMETRIC_LIMITS.MIN_PHOTOS) break;
      if (!next.includes(preset.url)) {
        next.push(preset.url);
      }
    }
    onChange(next.slice(0, VOLUMETRIC_LIMITS.MAX_PHOTOS));
  };

  const handleMakePrimary = (idx: number) => {
    if (idx <= 0 || idx >= photos.length) return;
    const chosen = photos[idx];
    const next = [chosen, ...photos.filter((_, i) => i !== idx)];
    onChange(next);
  };

  const handleRemove = (idx: number) => {
    setGalleryError(null);
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFileSelected(e)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[#7A5234] uppercase tracking-wider">
            Profile Pictures ({photos.length}/{VOLUMETRIC_LIMITS.MAX_PHOTOS})
          </p>
          <p className="text-xs text-[#7A5234] mt-0.5">
            Upload at least {VOLUMETRIC_LIMITS.MIN_PHOTOS} pictures (up to {VOLUMETRIC_LIMITS.MAX_PHOTOS} total) so matches get a genuine look at you.
          </p>
        </div>

        <span
          className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
            meetsMinimum
              ? 'bg-[#DCF0EA] border-[#A9D7C8] text-[#2E6B5C]'
              : 'bg-[#FDE4D8] border-[#F5C4A8] text-[#C44C29]'
          }`}
        >
          {meetsMinimum
            ? `${photos.length}/${VOLUMETRIC_LIMITS.MAX_PHOTOS} Ready`
            : `Need ${VOLUMETRIC_LIMITS.MIN_PHOTOS - photos.length} more`}
        </span>
      </div>

      {requireVerificationOnChange ? (
        <div
          className={`rounded-2xl border p-3.5 flex items-start gap-2.5 text-xs ${
            hasUnsavedChanges
              ? 'bg-[#FDE4D8]/80 border-[#E8603A] text-[#3D2817]'
              : 'bg-[#FFF8EC] border-[#F5C4A8] text-[#7A5234]'
          }`}
        >
          <ShieldAlert
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              hasUnsavedChanges ? 'text-[#C44C29]' : 'text-[#E8603A]'
            }`}
          />
          <p className="leading-relaxed">
            <span className="font-bold text-[#3D2817]">
              {hasUnsavedChanges
                ? 'Picture changes detected: '
                : 'Photo Change Security Policy: '}
            </span>
            Every time you change, replace, reorder, or remove your profile pictures, your profile must complete both{' '}
            <span className="font-bold text-[#3D2817]">Selfie Verification</span> and{' '}
            <span className="font-bold text-[#3D2817]">Age Verification</span> again for member safety.
          </p>
        </div>
      ) : null}

      {galleryError ? (
        <div className="px-3.5 py-2.5 rounded-xl bg-[#FEECEB] border border-[#F5C2C0] text-xs font-semibold text-[#C0392B]">
          {galleryError}
        </div>
      ) : null}

      {/* 6-Slot Responsive Picture Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {slots.map((src, idx) => {
          const isRequiredSlot = idx < VOLUMETRIC_LIMITS.MIN_PHOTOS;
          return (
            <div
              key={idx}
              className={`relative rounded-2xl border overflow-hidden aspect-[4/5] flex flex-col justify-between ${
                src
                  ? 'border-[#F5C4A8] bg-[#FFF8EC]'
                  : isRequiredSlot
                  ? 'border-dashed border-[#E8603A]/70 bg-[#FFF8EC]/70'
                  : 'border-dashed border-[#F5C4A8] bg-[#FFF8EC]/40'
              }`}
            >
              {src ? (
                <>
                  <AvatarImage src={src} name={`Profile photo ${idx + 1}`} className="w-full h-full" />
                  <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-1">
                    <span className="px-2 py-0.5 rounded-lg bg-[#2B1A10]/75 text-white text-[10px] font-mono font-bold">
                      {idx === 0 ? '1 · Main' : `#${idx + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      aria-label={`Remove picture ${idx + 1}`}
                      className="w-7 h-7 rounded-lg bg-[#2B1A10]/75 hover:bg-[#C44C29] text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => openFilePicker(idx)}
                      className="flex-1 min-h-[30px] px-2 py-1 rounded-lg bg-white/95 hover:bg-white text-[11px] font-bold text-[#3D2817] inline-flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Replace</span>
                    </button>
                    {idx > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleMakePrimary(idx)}
                        title="Set as main card picture"
                        className="min-h-[30px] px-2 py-1 rounded-lg bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-[11px] font-bold inline-flex items-center justify-center shadow-xs cursor-pointer"
                      >
                        <ArrowUpLeft className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => openFilePicker(null)}
                  className="w-full h-full p-3 flex flex-col items-center justify-center text-center gap-1.5 hover:bg-[#FDE4D8]/40 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#F5C4A8] text-[#E8603A] flex items-center justify-center">
                    <ImagePlus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#3D2817]">
                    Picture #{idx + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-[#7A5234]">
                    {isRequiredSlot ? 'Required · Upload' : 'Optional · Upload'}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload & Quick-Add Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={uploading || photos.length >= VOLUMETRIC_LIMITS.MAX_PHOTOS}
          onClick={() => openFilePicker(null)}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? 'Processing...' : 'Upload Pictures from Device'}</span>
        </button>

        {!meetsMinimum ? (
          <button
            type="button"
            onClick={handleFillRemainingPresets}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#A9D7C8] bg-[#DCF0EA]/70 hover:bg-[#DCF0EA] text-xs font-bold text-[#2E6B5C] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick-Fill 5 Studio Portraits</span>
          </button>
        ) : null}
      </div>

      {/* Curated Studio Portraits Quick Picker */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-[#7A5234]">
          Or tap studio portraits to add ({PORTRAIT_PRESETS.length} available):
        </p>
        <div className="grid grid-cols-5 gap-2.5">
          {PORTRAIT_PRESETS.map((preset) => {
            const selected = photos.includes(preset.url);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleAddPreset(preset.url)}
                title={selected ? `${preset.label} (already added)` : `Add ${preset.label}`}
                className={`relative rounded-xl overflow-hidden border-2 aspect-[4/5] transition-all cursor-pointer ${
                  selected
                    ? 'border-[#3D8C7A] ring-2 ring-[#DCF0EA]'
                    : 'border-transparent opacity-85 hover:opacity-100 hover:border-[#F5C4A8]'
                }`}
              >
                <AvatarImage src={preset.url} name={preset.label} className="w-full h-full" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional HTTPS Photo URL Input */}
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="Or paste an HTTPS picture URL..."
          className="flex-1 min-w-0 min-h-[40px] px-3.5 py-2 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-xs font-mono text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
        />
        <button
          type="button"
          disabled={!urlDraft.trim() || photos.length >= VOLUMETRIC_LIMITS.MAX_PHOTOS}
          onClick={handleAddUrl}
          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FFF8EC] disabled:opacity-50 text-xs font-bold text-[#3D2817] whitespace-nowrap cursor-pointer"
        >
          Add URL
        </button>
      </div>
    </div>
  );
}
