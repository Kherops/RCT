import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerDangerZone } from './ServerDangerZone';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('ServerDangerZone', () => {
  beforeEach(() => {
    useAuthStore.setState((state) => ({
      ...state,
      user: { id: 'owner', username: 'owner', email: 'owner@example.com' },
      isAuthenticated: true,
      isLoading: false,
    }));

    useChatStore.setState((state) => ({
      ...state,
      currentServer: {
        id: 'srv1',
        name: 'My Server',
        inviteCode: 'code',
        owner: { id: 'owner', username: 'owner' },
      },
      members: [{ id: 'm1', role: 'OWNER', user: { id: 'owner', username: 'owner', email: 'owner@example.com' } }],
      deleteCurrentServer: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it('enables delete when confirmation matches', async () => {
    render(
      <ToastProvider>
        <ServerDangerZone />
      </ToastProvider>
    );

    const deleteButton = screen.getByText('Delete');
    await userEvent.click(deleteButton);

    const confirmInput = screen.getByPlaceholderText('My Server');
    const confirmDelete = screen.getByText('Delete forever') as HTMLButtonElement;

    expect(confirmDelete).toBeDisabled();

    await userEvent.type(confirmInput, 'My Server');
    expect(confirmDelete).toBeEnabled();

    await userEvent.click(confirmDelete);
    expect(useChatStore.getState().deleteCurrentServer).toHaveBeenCalledTimes(1);
  });

  it('hides danger zone for non-owner', () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: { id: 'other', username: 'other', email: 'other@example.com' },
    }));

    useChatStore.setState((state) => ({
      ...state,
      currentServer: {
        id: 'srv1',
        name: 'My Server',
        inviteCode: 'code',
        owner: { id: 'owner', username: 'owner' },
      },
    }));

    render(
      <ToastProvider>
        <ServerDangerZone />
      </ToastProvider>
    );

    expect(screen.queryByText(/Danger Zone/i)).toBeNull();
  });
});
