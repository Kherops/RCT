import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelSidebar } from "./ChannelSidebar";
import { ApiHttpError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/components/ServerDangerZone", () => ({
  ServerDangerZone: () => null,
}));

const showToast = vi.fn();

type Channel = {
  id: string;
  name: string;
  serverId: string;
};

type Member = {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: { id: string; username: string; email?: string };
};

type ChatStateMock = {
  currentServer: {
    id: string;
    name: string;
    inviteCode: string;
    owner: { id: string; username: string };
  };
  channels: Channel[];
  currentChannel: Channel | null;
  selectChannel: (id: string) => Promise<void>;
  createChannel: () => void;
  deleteChannel: (id: string) => Promise<void>;
  leaveCurrentServer: () => Promise<void>;
  fetchServers: () => Promise<void>;
  isLoading: boolean;
  members: Member[];
};
vi.mock("@/components/Toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/Toast")>();
  return {
    ...actual,
    useToast: () => ({ showToast }),
  };
});

let state: ChatStateMock = {} as ChatStateMock;

vi.mock("@/store/chat", () => ({
  useChatStore: <T,>(selector: (value: ChatStateMock) => T) => selector(state),
}));

const baseChannels: Channel[] = [
  {
    id: "c1",
    name: "general",
    serverId: "s1",
  },
  {
    id: "c2",
    name: "random",
    serverId: "s1",
  },
];

const resetState = (userId = "owner") => {
  state = {
    currentServer: {
      id: "s1",
      name: "Server",
      inviteCode: "code",
      owner: { id: "owner", username: "owner" },
    },
    channels: [...baseChannels],
    currentChannel: baseChannels[1],
    selectChannel: vi.fn(async () => {}),
    createChannel: vi.fn(),
    deleteChannel: vi.fn(async (id: string) => {
      state.channels = state.channels.filter((c: Channel) => c.id !== id);
      if (state.currentChannel?.id === id) {
        state.currentChannel = null;
      }
    }),
    leaveCurrentServer: vi.fn(async () => {}),
    fetchServers: vi.fn(async () => {}),
    isLoading: false,
    members: [
      {
        id: "m1",
        role: "OWNER",
        user: { id: "owner", username: "owner", email: "owner@example.com" },
      },
    ],
  };
  showToast.mockClear();
  push.mockClear();

  useAuthStore.setState({
    user: { id: userId, username: userId, email: `${userId}@example.com` },
    isAuthenticated: true,
    isLoading: false,
  });

  state.members = [
    {
      id: "m-owner",
      role: "OWNER",
      user: { id: "owner", username: "owner", email: "owner@example.com" },
    },
    {
      id: "m-user",
      role: "MEMBER",
      user: { id: userId, username: userId, email: `${userId}@example.com` },
    },
  ];
};

describe("ChannelSidebar - delete channel", () => {
  beforeEach(() => {
    resetState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows owner/admin to delete a channel and fallbacks to another channel", async () => {
    render(<ChannelSidebar />);

    const deleteBtn = screen.getByLabelText("Delete channel random");
    await userEvent.click(deleteBtn);

    const confirm = screen.getByText("Delete");
    await userEvent.click(confirm);

    expect(state.deleteChannel).toHaveBeenCalledWith("c2");
  });

  it("hides delete icon for non-owner", async () => {
    resetState("other");
    render(<ChannelSidebar />);
    expect(screen.queryByLabelText("Delete channel random")).toBeNull();
  });

  it('hides delete icon for protected "general" channel even for owner', async () => {
    render(<ChannelSidebar />);
    expect(screen.queryByLabelText("Delete channel general")).toBeNull();
  });

  it("shows toast on 403 error", async () => {
    state.deleteChannel = vi.fn(async () => {
      throw new ApiHttpError("forbidden", 403);
    });

    render(<ChannelSidebar />);

    const deleteBtn = screen.getByLabelText("Delete channel random");
    await userEvent.click(deleteBtn);
    await userEvent.click(screen.getByText("Delete"));

    expect(showToast).toHaveBeenCalledWith(
      "Only the owner (or admin) can delete this channel",
      "error",
    );
  });

  it("renders unique channels (no duplicate keys)", async () => {
    state.channels = [...baseChannels, { ...baseChannels[1] }];
    render(<ChannelSidebar />);
    expect(screen.getAllByText("random")).toHaveLength(1);
  });

  it("shows create button only for server owner", async () => {
    render(<ChannelSidebar />);
    expect(screen.getByTitle("Create Channel")).toBeInTheDocument();

    resetState("other");
    render(<ChannelSidebar />);
    expect(screen.queryByTitle("Create Channel")).toBeNull();
  });

  it("selects fallback channel when current is deleted", async () => {
    state.selectChannel = vi.fn(async () => {});
    state.deleteChannel = vi.fn(async (id: string) => {
      state.channels = state.channels.filter((c: Channel) => c.id !== id);
      state.currentChannel = null;
    });

    render(<ChannelSidebar />);

    const deleteBtn = screen.getByLabelText("Delete channel random");
    await userEvent.click(deleteBtn);
    await userEvent.click(screen.getByText("Delete"));

    expect(state.deleteChannel).toHaveBeenCalledWith("c2");
    expect(state.selectChannel).toHaveBeenCalledWith("c1");
  });


  it("hide leave server button for owner and show for member", () => {
    render(<ChannelSidebar />);
    expect(screen.queryByText(/Leave server/i)).toBeNull();

    resetState("member");
    render(<ChannelSidebar />);
    expect(
      screen.getByRole("button", { name: "Leave server" }),
    ).toBeInTheDocument();
  });

  it("opens and cancels leave server modal", async () => {
    resetState("member");
    render(<ChannelSidebar />);
    await userEvent.click(
      screen.getByRole("button", { name: "Leave server" }),
    );
    expect(
      screen.getByText(/You will need an invite to rejoin/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Cancel/i));
    expect(screen.queryByText(/You will need an invite to rejoin/i)).toBeNull();
  });

  it("confirms leave server", async () => {
    resetState("member");
    state.leaveCurrentServer = vi.fn(async () => {});
    render(<ChannelSidebar />);
    await userEvent.click(
      screen.getByRole("button", { name: "Leave server" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(state.leaveCurrentServer).toHaveBeenCalledTimes(1);
  });
});
