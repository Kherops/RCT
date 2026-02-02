import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatArea } from "./ChatArea";
import { useAuthStore } from "@/store/auth";

const showToast = vi.fn();

vi.mock("@/components/Toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/Toast")>();
  return {
    ...actual,
    useToast: () => ({ showToast }),
  };
});

vi.mock("@/lib/socket", () => ({
  startTyping: vi.fn(),
  stopTyping: vi.fn(),
}));

type Message = {
  id: string;
  content: string | null;
  gifUrl?: string | null;
  replyToMessageId?: string | null;
  replyTo?: any;
  createdAt: string;
  updatedAt: string;
  author: { id: string; username: string };
  masked?: boolean;
};

type ChatStateMock = {
  mode: "channel" | "dm";
  currentChannel: { id: string; name: string; serverId: string } | null;
  currentDmConversation: null;
  messages: Message[];
  dmMessages: any[];
  typingUsers: { userId: string; username: string }[];
  members: Array<{ id: string; role: "OWNER" | "ADMIN" | "MEMBER"; user: { id: string; username: string } }>;
  sendMessage: () => Promise<void>;
  updateMessage: () => Promise<void>;
  deleteMessage: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
  dmHasMoreMessages: boolean;
  isLoading: boolean;
  blockedUserIds: Set<string>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  reportUser: (userId: string) => Promise<void>;
};

let state: ChatStateMock;

vi.mock("@/store/chat", () => ({
  useChatStore: () => state,
}));

const baseMessages: Message[] = [
  {
    id: "m1",
    content: "Hello",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: { id: "u1", username: "alice" },
  },
  {
    id: "m2",
    content: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: { id: "u2", username: "bob" },
    masked: true,
  },
];

const resetState = () => {
  state = {
    mode: "channel",
    currentChannel: { id: "c1", name: "general", serverId: "s1" },
    currentDmConversation: null,
    messages: [...baseMessages],
    dmMessages: [],
    typingUsers: [],
    members: [
      { id: "m1", role: "OWNER", user: { id: "u1", username: "alice" } },
      { id: "m2", role: "MEMBER", user: { id: "u2", username: "bob" } },
    ],
    sendMessage: vi.fn(async () => {}),
    updateMessage: vi.fn(async () => {}),
    deleteMessage: vi.fn(async () => {}),
    loadMoreMessages: vi.fn(async () => {}),
    hasMoreMessages: false,
    dmHasMoreMessages: false,
    isLoading: false,
    blockedUserIds: new Set(["u2"]),
    blockUser: vi.fn(async () => {}),
    unblockUser: vi.fn(async () => {}),
    reportUser: vi.fn(async () => {}),
  };

  useAuthStore.setState({
    user: { id: "u1", username: "alice", email: "alice@example.com" },
    isAuthenticated: true,
    isLoading: false,
  });

  showToast.mockClear();
};

describe("ChatArea block/report UI", () => {
  beforeEach(() => {
    resetState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows masked placeholder and triggers unblock", async () => {
    render(<ChatArea />);
    expect(
      screen.getByText(/Utilisateur bloqué/i),
    ).toBeInTheDocument();

    const unblockButton = screen.getByRole("button", { name: "Débloquer" });
    await userEvent.click(unblockButton);
    expect(state.unblockUser).toHaveBeenCalledWith("u2");
  });

  it("shows block/report actions for non-self messages", async () => {
    state.blockedUserIds = new Set();
    state.messages = state.messages.map((message) =>
      message.id === "m2"
        ? { ...message, content: "Hello from bob", masked: false }
        : message,
    );
    render(<ChatArea />);
    const actionButtons = screen.getAllByTitle("Actions");
    await userEvent.click(actionButtons[1]);
    expect(screen.getByText("Block user")).toBeInTheDocument();
    expect(screen.getByText("Report user")).toBeInTheDocument();
  });

  it("does not show block/report for own messages", async () => {
    render(<ChatArea />);
    const actionButtons = screen.getAllByTitle("Actions");
    await userEvent.click(actionButtons[0]);
    expect(screen.queryByText("Block user")).toBeNull();
    expect(screen.queryByText("Report user")).toBeNull();
  });

  it("reports user from modal confirmation", async () => {
    render(<ChatArea />);
    const actionButtons = screen.getAllByTitle("Actions");
    await userEvent.click(actionButtons[1]);
    await userEvent.click(screen.getByText("Report user"));

    expect(screen.getByText("Report user")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Report" }));

    expect(state.reportUser).toHaveBeenCalledWith("u2");
  });
});
