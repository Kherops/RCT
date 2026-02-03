"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban } from "lucide-react";
import type { BanStatus } from "@/lib/api";

type BannedServerViewProps = {
  serverName?: string | null;
  status: BanStatus;
  onRetry?: () => void;
  onExpired?: () => void;
};

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

export function BannedServerView({
  serverName,
  status,
  onRetry,
  onExpired,
}: BannedServerViewProps) {
  const initialRemainingMs = useMemo(() => {
    if (status.type !== "TEMPORARY") return null;
    if (typeof status.remainingMs === "number") return status.remainingMs;
    if (status.expiresAt && status.serverTime) {
      const expiresAt = new Date(status.expiresAt).getTime();
      const serverTime = new Date(status.serverTime).getTime();
      return Math.max(0, expiresAt - serverTime);
    }
    if (status.expiresAt) {
      return Math.max(0, new Date(status.expiresAt).getTime() - Date.now());
    }
    return null;
  }, [status]);

  const [remainingMs, setRemainingMs] = useState<number | null>(
    initialRemainingMs,
  );
  const hasExpired = useRef(false);

  useEffect(() => {
    setRemainingMs(initialRemainingMs);
    hasExpired.current = false;
  }, [initialRemainingMs, status.type]);

  useEffect(() => {
    if (status.type !== "TEMPORARY" || initialRemainingMs === null) {
      return;
    }

    const endAt = Date.now() + initialRemainingMs;
    const interval = setInterval(() => {
      const next = Math.max(0, endAt - Date.now());
      setRemainingMs(next);
      if (next <= 0 && !hasExpired.current) {
        hasExpired.current = true;
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status.type, initialRemainingMs, onExpired]);

  const expiresLabel = status.expiresAt
    ? new Date(status.expiresAt).toLocaleString()
    : null;

  return (
    <div className="flex-1 relative">
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center px-4">
        <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-lg border border-discord-dark">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-discord-red/20 flex items-center justify-center text-discord-red">
              <Ban size={18} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Access blocked</h3>
              <p className="text-xs text-gray-400">
                {serverName ? `Server: ${serverName}` : "Server access"}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-300">
            You have been{" "}
            <span className="font-semibold text-white">
              {status.type === "PERMANENT" ? "permanently" : "temporarily"}
            </span>{" "}
            banned from this server.
          </p>

          {status.reason && (
            <div className="mt-3 text-sm text-gray-300">
              <span className="text-gray-400 uppercase text-[11px] tracking-wide">
                Reason
              </span>
              <p className="mt-1 text-white">{status.reason}</p>
            </div>
          )}

          {status.type === "TEMPORARY" && (
            <div className="mt-4 rounded border border-discord-dark bg-discord-dark/60 p-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                Ban lifts in
              </div>
              <div className="text-2xl font-semibold text-white mt-1">
                {remainingMs !== null ? formatDuration(remainingMs) : "—"}
              </div>
              {expiresLabel && (
                <div className="text-xs text-gray-500 mt-1">
                  Ends at {expiresLabel}
                </div>
              )}
            </div>
          )}

          {status.type === "PERMANENT" && (
            <div className="mt-4 text-xs text-gray-500">
              This ban has no scheduled end.
            </div>
          )}

          {onRetry && (
            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={onRetry}
                className="px-4 py-2 rounded bg-discord-accent hover:bg-discord-accent/80 text-white text-sm font-semibold"
              >
                Check access
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
