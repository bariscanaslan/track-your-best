"use client";

import { useRef } from "react";
import { resolveMediaUrl } from "@/app/utils/media";

type AvatarUploadFieldProps = {
  apiBase?: string;
  theme: "adm" | "fm";
  value: string;
  stagedPreviewUrl?: string | null;
  stagedFileName?: string;
  hasStagedFile?: boolean;
  onFileSelect: (file: File) => void;
  onClearSelection: () => void;
  onRemovePhoto: () => void;
  previewAlt: string;
  disabled?: boolean;
};

export default function AvatarUploadField({
  apiBase,
  theme,
  value,
  stagedPreviewUrl,
  stagedFileName,
  hasStagedFile = false,
  onFileSelect,
  onClearSelection,
  onRemovePhoto,
  previewAlt,
  disabled = false,
}: AvatarUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previewSrc = stagedPreviewUrl || resolveMediaUrl(value, apiBase) || "/tyb-logo.png";
  const hasSavedPhoto = value.trim().length > 0;
  const isBusy = disabled;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onFileSelect(file);
    event.target.value = "";
  };

  return (
    <>
      <div className={`${theme}-edit-avatar`}>
        <img src={previewSrc} alt={previewAlt} className={`${theme}-avatar-lg`} />
      </div>
      <div className={`${theme}-upload-actions`}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          hidden
          disabled={isBusy}
        />
        <button
          className={`${theme}-button`}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy || hasStagedFile}
        >
          {hasStagedFile ? "Photo Selected" : "Choose Photo"}
        </button>
        <button
          className={`${theme}-button`}
          type="button"
          onClick={hasStagedFile ? onClearSelection : onRemovePhoto}
          disabled={isBusy || (!hasStagedFile && !hasSavedPhoto)}
        >
          {hasStagedFile ? "Discard Selection" : "Remove Photo"}
        </button>
      </div>
      <div className={`${theme}-upload-hint`}>
        {hasStagedFile && stagedFileName
          ? `Selected: ${stagedFileName}. It will upload after you save.`
          : "JPG, PNG, GIF, or WebP up to 5 MB."}
      </div>
    </>
  );
}
