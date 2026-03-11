"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/components/Toast";
import { ApiHttpError } from "@/lib/api";
import { useTranslations } from "next-intl";

export function ServerDangerZone() {
  const t = useTranslations("DangerZone");
  const { currentServer, members, deleteCurrentServer } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    if (!user || !currentServer) return false;
    if (currentServer.owner?.id) {
      return currentServer.owner.id === user.id;
    }
    return members.some((m) => m.user.id === user.id && m.role === "OWNER");
  }, [members, user, currentServer]);

  if (!currentServer || !isOwner) return null;

  const confirmMatch = confirmation.trim() === currentServer.name.trim();

  const handleDelete = async () => {
    if (!confirmMatch || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteCurrentServer();
      showToast(t("successToast"), "success");
      setIsOpen(false);
      setConfirmation("");
      router.push("/chat");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("errorNetwork");
      setError(message);

      if (err instanceof ApiHttpError) {
        if (err.status === 403) {
          showToast(t("errorOwnerOnly"), "error");
        } else if (err.status === 404) {
          showToast(t("errorNotFound"), "error");
        } else {
          showToast(message, "error");
        }
      } else {
        showToast(t("errorNetwork"), "error");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mt-4 border-t border-discord-dark pt-4">
      <div className="flex items-center justify-between bg-discord-dark rounded-lg p-3 border border-discord-red/30">
        <div>
          <div className="flex items-center gap-2 text-red-200 font-semibold">
            <AlertTriangle size={16} className="text-discord-red" />
            {t("title")}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {t("description")}
          </p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          disabled={!isOwner}
          className="px-3 py-1.5 rounded bg-discord-red/80 text-white text-sm font-semibold hover:bg-discord-red disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title={isOwner ? t("deleteButton") : t("lockTitle")}
        >
          {!isOwner && <Lock size={14} />}
          {t("deleteButton")}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md border border-discord-dark">
            <h3 className="text-xl font-bold text-white mb-2">{t("modalTitle")}</h3>
            <p className="text-sm text-gray-300 mb-4">
              {t("modalDescriptionBefore")}{" "}
              <span className="font-semibold text-white">
                {currentServer.name}
              </span>
              {t("modalDescriptionAfter")}
            </p>

            <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">
              {t("serverNameLabel")}
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={currentServer.name}
              className="w-full px-3 py-2 bg-discord-dark text-white rounded border border-gray-700 focus:border-discord-accent focus:outline-none"
            />

            {error && (
              <div className="mt-3 text-sm text-discord-red bg-discord-red/10 border border-discord-red/30 rounded px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setConfirmation("");
                  setError(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
                disabled={isDeleting}
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmMatch || isDeleting}
                className="px-4 py-2 rounded bg-discord-red hover:bg-discord-red/90 text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                {isDeleting ? t("deleting") : t("deleteForever")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
