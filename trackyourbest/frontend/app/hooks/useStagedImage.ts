"use client";

import { useEffect, useState } from "react";

export function useStagedImage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const clearStagedFile = () => {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }

      return null;
    });
  };

  const stageFile = (nextFile: File) => {
    setFile(nextFile);
    setPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }

      return URL.createObjectURL(nextFile);
    });
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return {
    file,
    previewUrl,
    fileName: file?.name ?? "",
    hasStagedFile: file !== null,
    stageFile,
    clearStagedFile,
  };
}
