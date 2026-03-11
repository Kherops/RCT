"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { api, type UserProfile } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { useTranslations } from "next-intl";

type ProfileCardProps = {
  userId: string;
  onClose: () => void;
};

export function ProfileCard({ userId, onClose }: ProfileCardProps) {
  const t = useTranslations("Profile");
  const { user, updateProfile } = useAuthStore();
  const { updateMyStatus } = useChatStore();
  const isSelf = user?.id === userId;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState<"online" | "busy" | "dnd">("online");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setError("");
      if (isSelf && user) {
        if (active) {
          setProfile({
            id: user.id,
            username: user.username,
            bio: user.bio ?? "",
            avatarUrl: user.avatarUrl ?? "",
            status: user.status ?? "online",
          });
          setBio(user.bio ?? "");
          setAvatarUrl(user.avatarUrl ?? "");
          setStatus(user.status ?? "online");
        }
        return;
      }
      try {
        const data = await api.getUserProfile(userId);
        if (active) {
          setProfile(data);
          setBio(data.bio ?? "");
          setAvatarUrl(data.avatarUrl ?? "");
          setStatus((data.status as "online" | "busy" | "dnd") ?? "online");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : t("failedLoad"));
        }
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [userId, isSelf, user, t]);

  const handleSave = async () => {
    if (!isSelf) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await updateProfile({ bio, avatarUrl, status });
      setProfile({
        id: updated.id,
        username: updated.username,
        bio: updated.bio ?? "",
        avatarUrl: updated.avatarUrl ?? "",
        status: updated.status ?? "online",
      });
      await updateMyStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedUpdate"));
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-discord-dark bg-discord-lighter shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-discord-dark px-4 py-3">
          <div className="flex items-center gap-3">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.username}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-discord-accent flex items-center justify-center text-white font-semibold">
                {profile?.username?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <span
              className={`-ml-3 mt-7 inline-block h-3 w-3 rounded-full border-2 border-discord-light ${
                (profile?.status ?? "online") === "online"
                  ? "bg-discord-green"
                  : (profile?.status ?? "online") === "busy"
                    ? "bg-orange-400"
                    : "bg-red-500"
              }`}
              title={t(`status.${profile?.status ?? "online"}`)}
            />
            <div>
              <p className="text-white font-semibold">{profile?.username || t("profileTitle")}</p>
              <p className="text-xs text-gray-400">{isSelf ? t("yourProfile") : t("memberProfile")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {error && (
            <div className="rounded bg-discord-red/20 border border-discord-red text-discord-red px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">{t("bio")}</label>
            {isSelf ? (
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="w-full min-h-[96px] rounded bg-discord-dark text-white text-sm p-2 border border-discord-light focus:outline-none focus:border-discord-accent"
                maxLength={280}
                placeholder={t("bioPlaceholder")}
              />
            ) : (
              <p className="text-sm text-gray-200 whitespace-pre-wrap">
                {profile?.bio?.trim() ? profile.bio : t("noBio")}
              </p>
            )}
          </div>
          {isSelf && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">{t("avatarUrl")}</label>
              <input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                className="w-full rounded bg-discord-dark text-white text-sm p-2 border border-discord-light focus:outline-none focus:border-discord-accent"
                placeholder="https://..."
              />
              <p className="text-[11px] text-gray-500 mt-1">{t("avatarHint")}</p>
            </div>
          )}
          {isSelf && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">{t("status.label")}</label>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "online" | "busy" | "dnd")
                }
                className="w-full rounded bg-discord-dark text-white text-sm p-2 border border-discord-light focus:outline-none focus:border-discord-accent"
              >
                <option value="online">{t("status.online")}</option>
                <option value="busy">{t("status.busy")}</option>
                <option value="dnd">{t("status.dnd")}</option>
              </select>
            </div>
          )}
        </div>

        {isSelf && (
          <div className="flex items-center justify-between border-t border-discord-dark px-4 py-3">
            <span className="text-xs text-gray-500">{bio.length}/280</span>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1.5 rounded bg-discord-accent text-white text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : t("save")}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
