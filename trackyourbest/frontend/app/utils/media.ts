import { getApiBaseUrl } from "./api";

export type UploadedImageResponse = {
  fileName: string;
  contentType: string;
  size: number;
  relativeUrl: string;
  url: string;
};

export function resolveMediaUrl(value?: string | null, apiBase = getApiBaseUrl()) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("http://")
    || trimmed.startsWith("https://")
    || trimmed.startsWith("data:")
    || trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    const normalizedBase = (apiBase ?? "").replace(/\/$/, "");
    return normalizedBase ? `${normalizedBase}${trimmed}` : trimmed;
  }

  return trimmed;
}

export async function uploadProfileImage(file: File, apiBase = getApiBaseUrl()) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${apiBase}/api/uploads/profile-image`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "Upload failed.");
  }

  return res.json() as Promise<UploadedImageResponse>;
}
