'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-dark p-4">
      <div className="w-full max-w-md bg-discord-lighter rounded-lg shadow-xl p-8">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome back!</h1>
        <p className="text-gray-400 text-center mb-6">We&apos;re so excited to see you again!</p>

        {error && (
          <div className="bg-discord-red/20 border border-discord-red text-discord-red px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-discord-dark text-white rounded border border-gray-700 focus:border-discord-accent focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-discord-dark text-white rounded border border-gray-700 focus:border-discord-accent focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-discord-accent hover:bg-discord-accent/80 text-white font-medium rounded transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-400">
          Need an account?{' '}
          <Link href="/signup" className="text-discord-accent hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
