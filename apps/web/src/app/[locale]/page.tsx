'use client';

import { useRouter, Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function HomePage() {
  const t = useTranslations('HomePage');
  const router = useRouter();

  return (
    <main className="min-h-screen bg-discord-dark flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full space-y-8 animate-slide-in">
        <div className="text-center">
          <div className="bg-discord-gray p-4 rounded-full inline-block mb-4">
            <svg
              className="w-12 h-12 text-discord-blue"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2">{t('title')}</h1>
          <p className="text-discord-text-muted text-lg">
            {t('description')}
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/login"
            className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-discord-blue hover:bg-opacity-90 transition-all"
          >
            {t('login')}
          </Link>
          <Link
            href="/signup"
            className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-discord-gray hover:bg-opacity-90 transition-all"
          >
            {t('signup')}
          </Link>
        </div>
      </div>
    </main>
  );
}
