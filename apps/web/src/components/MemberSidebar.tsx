"use client";

import { useMemo, useState } from "react";
import {
  MessageCircle,
  Search,
  UserMinus,
  Loader2,
  Ban,
  X,
  ShieldOff,
} from "lucide-react";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { ProfileCard } from "@/components/ProfileCard";
import { useTranslations } from "next-intl";

export function MemberSidebar() {
  const t = useTranslations("MemberSidebar");
  const {
    members,
    onlineUsers,
    userStatuses,
    dmConversations,
    currentDmConversation,
    mode,
    startDmByUsername,
    selectDmConversation,
    kickMember,
    banMember,
    unbanMember,
  } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [dmUsername, setDmUsername] = useState("");
  const [isStartingDm, setIsStartingDm] = useState(false);
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [banType, setBanType] = useState<"PERMANENT" | "TEMPORARY">(
    "PERMANENT",
  );
  const [banMode, setBanMode] = useState<"duration" | "until">("duration");
  const [banDurationHours, setBanDurationHours] = useState("24");
  const [banUntil, setBanUntil] = useState("");
  const [banReason, setBanReason] = useState("");
  const [isBanning, setIsBanning] = useState(false);
  const [banError, setBanError] = useState("");
  const [unbanTarget, setUnbanTarget] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [isUnbanning, setIsUnbanning] = useState(false);

  const owners = members.filter((m) => m.role === "OWNER");
  const admins = members.filter((m) => m.role === "ADMIN");
  const regularMembers = members.filter((m) => m.role === "MEMBER");

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user.id, m.user.username));
    return map;
  }, [members]);

  const dmItems = useMemo(() => {
    if (!user) return [];

    return dmConversations.map((conversation) => {
      const otherId =
        conversation.participantIds.find((id) => id !== user.id) || null;
      const otherNameFromMembers = otherId ? memberNameById.get(otherId) : null;
      const otherNameFromParticipants = otherId
        ? conversation.participants?.find((p) => p.id === otherId)?.username
        : null;
      const otherName =
        otherNameFromMembers || otherNameFromParticipants || t("directMessages");
      const lastMessageText = conversation.lastMessage?.content?.trim()
        ? conversation.lastMessage.content
        : conversation.lastMessage?.gifUrl
          ? "GIF"
          : null;

      return {
        id: conversation.id,
        otherName,
        lastMessage: lastMessageText,
      };
    });
  }, [dmConversations, memberNameById, user, t]);

  const handleStartDm = async () => {
    if (!dmUsername.trim() || isStartingDm) return;
    setIsStartingDm(true);
    try {
      await startDmByUsername(dmUsername);
      setDmUsername("");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("failedStartDm"),
        "error",
      );
    } finally {
      setIsStartingDm(false);
    }
  };

  const MemberItem = ({ member }: { member: (typeof members)[0] }) => {
    const isOnline = onlineUsers.has(member.user.id);
    const status = isOnline
      ? (userStatuses.get(member.user.id) ?? "online")
      : "offline";
    const myRole = members.find((m) => m.user.id === user?.id)?.role;
    const isSelf = member.user.id === user?.id;
    const ban = member.ban ?? null;
    const isBanned = Boolean(ban);
    const remainingLabel =
      ban?.type === "temporary" && ban.bannedUntil
        ? (() => {
            const remainingMs =
              new Date(ban.bannedUntil).getTime() - Date.now();
            if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
            const totalSeconds = Math.floor(remainingMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            if (hours > 0) return `${hours}h ${minutes}m`;
            return `${minutes}m`;
          })()
        : null;
    const canKick =
      !isSelf &&
      (myRole === "OWNER"
        ? member.role !== "OWNER"
        : myRole === "ADMIN"
          ? member.role === "MEMBER"
          : false);
    const canBan =
      !isSelf && myRole === "OWNER" && member.role !== "OWNER" && !isBanned;
    const canUnban =
      !isSelf && myRole === "OWNER" && member.role !== "OWNER" && isBanned;

    const handleKick = async () => {
      if (!canKick || kickingMemberId) return;
      setKickingMemberId(member.user.id);
      try {
        await kickMember(member.user.id);
        showToast(t("kickedSuccess", { username: member.user.username }), "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : t("failedKick"),
          "error",
        );
      } finally {
        setKickingMemberId(null);
      }
    };

    const handleOpenBan = () => {
      if (!canBan) return;
      setBanTarget({ id: member.user.id, username: member.user.username });
      setBanType("PERMANENT");
      setBanMode("duration");
      setBanDurationHours("24");
      setBanUntil("");
      setBanReason("");
      setBanError("");
    };

    const handleOpenUnban = () => {
      if (!canUnban) return;
      setUnbanTarget({ id: member.user.id, username: member.user.username });
    };

    return (
      <div
        className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-discord-lighter/50 cursor-pointer"
        onClick={() => setProfileUserId(member.user.id)}
      >
        <div className="relative">
          {member.user.avatarUrl ? (
            <img
              src={member.user.avatarUrl}
              alt={member.user.username}
              className="w-8 h-8 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-semibold">
              {member.user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div
            className={cn(
              "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-discord-light",
              status === "online"
                ? "bg-discord-green"
                : status === "busy"
                  ? "bg-orange-400"
                  : status === "dnd"
                    ? "bg-red-500"
                    : "bg-gray-500",
            )}
          />
        </div>
        <span
          className={cn(
            "text-sm flex-1",
            isOnline ? "text-gray-200" : "text-gray-500",
          )}
        >
          {member.user.username}
        </span>
        {isBanned && (
          <span
            className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-discord-red/20 text-discord-red"
            title={
              remainingLabel
                ? t("bannedRemaining", { time: remainingLabel })
                : t("banned")
            }
          >
            {t("banned")}
          </span>
        )}
        {canKick && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleKick();
            }}
            disabled={kickingMemberId === member.user.id}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-discord-red hover:bg-discord-dark disabled:opacity-50"
            title={t("kickTitle")}
          >
            {kickingMemberId === member.user.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserMinus size={14} />
            )}
          </button>
        )}
        {canBan && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleOpenBan();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-discord-red hover:bg-discord-dark"
            title={t("banTitle")}
          >
            <Ban size={14} />
          </button>
        )}
        {canUnban && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleOpenUnban();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-discord-green hover:bg-discord-dark"
            title={t("unbanTitle")}
          >
            <ShieldOff size={14} />
          </button>
        )}
      </div>
    );
  };

  const isBanValid =
    banType === "PERMANENT"
      ? true
      : banMode === "duration"
        ? Number(banDurationHours) > 0
        : Boolean(banUntil);

  const handleConfirmBan = async () => {
    if (!banTarget || isBanning) return;
    setBanError("");

    const payload: {
      type: "PERMANENT" | "TEMPORARY";
      durationSeconds?: number;
      expiresAt?: string;
      reason?: string;
    } = { type: banType };

    if (banType === "TEMPORARY") {
      if (banMode === "duration") {
        const hours = Number(banDurationHours);
        if (!Number.isFinite(hours) || hours <= 0) {
          setBanError(t("validDuration"));
          return;
        }
        payload.durationSeconds = Math.round(hours * 60 * 60);
      } else {
        if (!banUntil) {
          setBanError(t("selectExpiration"));
          return;
        }
        const expires = new Date(banUntil);
        if (Number.isNaN(expires.getTime())) {
          setBanError(t("invalidDate"));
          return;
        }
        payload.expiresAt = expires.toISOString();
      }
    }

    if (banReason.trim()) {
      payload.reason = banReason.trim();
    }

    setIsBanning(true);
    try {
      await banMember(banTarget.id, payload);
      showToast(t("banSuccess", { username: banTarget.username }), "success");
      setBanTarget(null);
    } catch (err) {
      setBanError(err instanceof Error ? err.message : t("failedBan"));
    } finally {
      setIsBanning(false);
    }
  };

  const handleConfirmUnban = async () => {
    if (!unbanTarget || isUnbanning) return;
    setIsUnbanning(true);
    try {
      await unbanMember(unbanTarget.id);
      showToast(t("unbanSuccess", { username: unbanTarget.username }), "success");
      setUnbanTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("failedUnban"),
        "error",
      );
    } finally {
      setIsUnbanning(false);
    }
  };

  return (
    <div className="w-60 bg-discord-light overflow-y-auto border-l border-discord-dark/50">
      <div className="p-3 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase px-1 mb-2 flex items-center gap-2">
            <MessageCircle size={14} />
            {t("directMessages")}
          </h4>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded bg-discord-lighter border border-discord-dark">
              <Search size={14} className="text-gray-400" />
              <input
                value={dmUsername}
                onChange={(e) => setDmUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleStartDm();
                  }
                }}
                placeholder={t("typeUsername")}
                className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleStartDm}
              disabled={!dmUsername.trim() || isStartingDm}
              className="px-2.5 py-1.5 rounded bg-discord-accent text-white text-xs font-medium disabled:opacity-50 hover:brightness-110 transition"
            >
              DM
            </button>
          </div>

          <div className="space-y-1">
            {dmItems.length === 0 && (
              <p className="text-xs text-gray-500 px-1">{t("noDms")}</p>
            )}
            {dmItems.map((item) => {
              const isActive =
                mode === "dm" && currentDmConversation?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => selectDmConversation(item.id)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded transition-colors",
                    isActive
                      ? "bg-discord-accent/20 text-white"
                      : "hover:bg-discord-lighter/50 text-gray-200",
                  )}
                  title={item.lastMessage || undefined}
                >
                  <div className="text-sm font-medium truncate">
                    @{item.otherName}
                  </div>
                  {item.lastMessage && (
                    <div className="text-xs text-gray-400 truncate">
                      {item.lastMessage}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {owners.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">
              {t("owner")} — {owners.length}
            </h4>
            {owners.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {admins.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">
              {t("admins")} — {admins.length}
            </h4>
            {admins.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {regularMembers.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">
              {t("members")} — {regularMembers.length}
            </h4>
            {regularMembers.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>

      {banTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md border border-discord-dark">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-white">{t("banModalTitle")}</h3>
              <button
                onClick={() => setBanTarget(null)}
                className="text-gray-400 hover:text-white"
                disabled={isBanning}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-300 mb-4">
              {t("banDescBefore")}{" "}
              <span className="font-semibold text-white">
                {banTarget.username}
              </span>
              {t("banDescAfter")}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-2">
                  {t("banType")}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBanType("PERMANENT")}
                    className={cn(
                      "flex-1 px-3 py-2 rounded text-sm font-medium border",
                      banType === "PERMANENT"
                        ? "bg-discord-accent/20 text-white border-discord-accent"
                        : "bg-discord-dark text-gray-300 border-discord-dark hover:border-discord-accent/50",
                    )}
                  >
                    {t("permanent")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBanType("TEMPORARY")}
                    className={cn(
                      "flex-1 px-3 py-2 rounded text-sm font-medium border",
                      banType === "TEMPORARY"
                        ? "bg-discord-accent/20 text-white border-discord-accent"
                        : "bg-discord-dark text-gray-300 border-discord-dark hover:border-discord-accent/50",
                    )}
                  >
                    {t("temporary")}
                  </button>
                </div>
              </div>

              {banType === "TEMPORARY" && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase">
                    {t("duration")}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBanMode("duration")}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-semibold border",
                        banMode === "duration"
                          ? "bg-discord-accent/20 text-white border-discord-accent"
                          : "bg-discord-dark text-gray-300 border-discord-dark hover:border-discord-accent/50",
                      )}
                    >
                      {t("durationLabel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBanMode("until")}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-semibold border",
                        banMode === "until"
                          ? "bg-discord-accent/20 text-white border-discord-accent"
                          : "bg-discord-dark text-gray-300 border-discord-dark hover:border-discord-accent/50",
                      )}
                    >
                      {t("untilDate")}
                    </button>
                  </div>

                  {banMode === "duration" ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={banDurationHours}
                        onChange={(event) =>
                          setBanDurationHours(event.target.value)
                        }
                        className="w-24 rounded bg-discord-dark text-white text-sm px-3 py-2 border border-discord-light focus:outline-none focus:border-discord-accent"
                      />
                      <span className="text-xs text-gray-400">{t("hours")}</span>
                    </div>
                  ) : (
                    <input
                      type="datetime-local"
                      value={banUntil}
                      onChange={(event) => setBanUntil(event.target.value)}
                      className="w-full rounded bg-discord-dark text-white text-sm px-3 py-2 border border-discord-light focus:outline-none focus:border-discord-accent"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-2">
                  {t("reason")}
                </label>
                <input
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value)}
                  placeholder={t("reasonPlaceholder")}
                  className="w-full rounded bg-discord-dark text-white text-sm px-3 py-2 border border-discord-light focus:outline-none focus:border-discord-accent"
                />
              </div>
            </div>

            {banError && (
              <div className="mt-4 text-sm text-discord-red bg-discord-red/10 border border-discord-red/30 rounded px-3 py-2">
                {banError}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setBanTarget(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
                disabled={isBanning}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmBan}
                disabled={isBanning || !isBanValid}
                className="px-4 py-2 rounded bg-discord-red hover:bg-discord-red/90 text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {isBanning && <Loader2 size={16} className="animate-spin" />}
                {isBanning ? t("banning") : t("banButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {unbanTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md border border-discord-dark">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-white">{t("unbanModalTitle")}</h3>
              <button
                onClick={() => setUnbanTarget(null)}
                className="text-gray-400 hover:text-white"
                disabled={isUnbanning}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-300 mb-4">
              {t("unbanDescBefore")}{" "}
              <span className="font-semibold text-white">
                {unbanTarget.username}
              </span>
              {t("unbanDescAfter")}
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setUnbanTarget(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
                disabled={isUnbanning}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmUnban}
                disabled={isUnbanning}
                className="px-4 py-2 rounded bg-discord-green hover:bg-discord-green/90 text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {isUnbanning && <Loader2 size={16} className="animate-spin" />}
                {isUnbanning ? t("unbanning") : t("unbanButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileUserId && (
        <ProfileCard
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}
