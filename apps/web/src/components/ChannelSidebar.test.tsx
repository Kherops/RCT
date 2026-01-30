import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelSidebar } from "./ChannelSidebar";
import { ApiHttpError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

vi.mock("@/components/ServerDangerZone", () => ({
  ServerDangerZone: () => null,
}));

const showToast = vi.fn();
vi.mock("@/components/Toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/Toast")>();
  return {
    ...actual,
    useToast: () => ({ showToast }),
  };
});

let state: any;

vi.mock("@/store/chat", () => ({
  useChatStore: (selector: any) => selector(state),
}));

const baseChannels = [
  {
    id: "c1",
    name: "general",
    serverId: "s1",
    visibility: "PUBLIC",
    creatorId: "owner",
  },
  {
    id: "c2",
    name: "random",
    serverId: "s1",
    visibility: "PRIVATE",
    creatorId: "owner",
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
      state.channels = state.channels.filter((c: any) => c.id !== id);
      if (state.currentChannel?.id === id) {
        state.currentChannel = null;
      }
    }),
    leaveChannel: vi.fn(async (id: string) => {
      state.channels = state.channels.filter((c: any) => c.id !== id);
      if (state.currentChannel?.id === id) {
        state.currentChannel = null;
      }
    }),
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
      state.channels = state.channels.filter((c: any) => c.id !== id);
      state.currentChannel = null;
    });

    render(<ChannelSidebar />);

    const deleteBtn = screen.getByLabelText("Delete channel random");
    await userEvent.click(deleteBtn);
    await userEvent.click(screen.getByText("Delete"));

    expect(state.deleteChannel).toHaveBeenCalledWith("c2");
    expect(state.selectChannel).toHaveBeenCalledWith("c1");
  });

  it("shows create button for non-owner but only private option", async () => {
    resetState("member");
    render(<ChannelSidebar />);
    expect(screen.getByTitle("Create Channel")).toBeInTheDocument();
    await userEvent.click(screen.getByTitle("Create Channel"));
    expect(screen.queryByLabelText(/Public/i)).toBeNull();
    expect(screen.getByLabelText(/Private/i)).toBeInTheDocument();
  });

  it("shows public option for owner", async () => {
    render(<ChannelSidebar />);
    await userEvent.click(screen.getByTitle("Create Channel"));
    expect(screen.getByLabelText(/Public/i)).toBeInTheDocument();
  });

  it("does not show leave for public or creator private", async () => {
    // public channel
    render(<ChannelSidebar />);
    expect(screen.queryByLabelText("Leave channel general")).toBeNull();

    // private where current user is creator
    expect(screen.queryByLabelText("Leave channel random")).toBeNull();
  });

  it("shows leave for private channel when not creator", async () => {
    resetState("member");
    state.channels = [
      {
        id: "c3",
        name: "private-room",
        serverId: "s1",
        visibility: "PRIVATE",
        creatorId: "owner",
      },
    ];
    render(<ChannelSidebar />);
    expect(
      screen.getByLabelText("Leave channel private-room"),
    ).toBeInTheDocument();
  });

  it("hide leave server button for owner and show for member", () => {
    render(<ChannelSidebar />);
    expect(screen.queryByText(/Leave server/i)).toBeNull();

    resetState("member");
    render(<ChannelSidebar />);
    expect(screen.getByText(/Leave server/i)).toBeInTheDocument();
  });
});
