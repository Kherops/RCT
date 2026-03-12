type DesktopConfig = {
  apiUrl?: string;
};

declare global {
  interface Window {
    rtcDesktop?: DesktopConfig;
  }
}

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const runtimeApiUrl = window.rtcDesktop?.apiUrl?.trim();
    if (runtimeApiUrl) {
      return runtimeApiUrl;
    }
  }

  const envApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envApiUrl) {
    return envApiUrl;
  }

  return "http://localhost:3001";
}
