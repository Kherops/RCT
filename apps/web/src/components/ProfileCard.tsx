"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { api, type UserProfile } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

type ProfileCardProps = {
  userId: string;
  onClose: () => void;
};

export function ProfileCard({ userId, onClose }: ProfileCardProps) {
  const { user, updateProfile } = useAuthStore();
  const isSelf = user?.id === userId;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
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
          });
          setBio(user.bio ?? "");
          setAvatarUrl(user.avatarUrl ?? "");
        }
        return;
      }
      try {
        const data = await api.getUserProfile(userId);
        if (active) {
          setProfile(data);
          setBio(data.bio ?? "");
          setAvatarUrl(data.avatarUrl ?? "");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [userId, isSelf, user]);

  const handleSave = async () => {
    if (!isSelf) return;
    setIsSaving(true);
    setError("");
    try {
      const updated = await updateProfile({ bio, avatarUrl });
      setProfile({
        id: updated.id,
        username: updated.username,
        bio: updated.bio ?? "",
        avatarUrl: updated.avatarUrl ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
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
            <div>
              <p className="text-white font-semibold">{profile?.username || "Profile"}</p>
              <p className="text-xs text-gray-400">{isSelf ? "Your profile" : "Member profile"}</p>
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
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Bio</label>
            {isSelf ? (
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="w-full min-h-[96px] rounded bg-discord-dark text-white text-sm p-2 border border-discord-light focus:outline-none focus:border-discord-accent"
                maxLength={280}
                placeholder="Tell people about yourself..."
              />
            ) : (
              <p className="text-sm text-gray-200 whitespace-pre-wrap">
                {profile?.bio?.trim() ? profile.bio : "No bio yet."}
              </p>
            )}
          </div>
          {isSelf && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Avatar URL</label>
              <input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                className="w-full rounded bg-discord-dark text-white text-sm p-2 border border-discord-light focus:outline-none focus:border-discord-accent"
                placeholder="https://..."
              />
              <p className="text-[11px] text-gray-500 mt-1">Leave empty to remove.</p>
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
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
