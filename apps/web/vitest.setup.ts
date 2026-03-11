import '@testing-library/jest-dom';
import { vi } from 'vitest';
import enMessages from './messages/en.json';

function getByPath(obj: Record<string, any>, path: string) {
  return path.split('.').reduce<any>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return acc[part];
    return undefined;
  }, obj);
}

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    return (key: string, values?: Record<string, unknown>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const raw = getByPath(enMessages as unknown as Record<string, any>, fullKey);
      const message = typeof raw === 'string' ? raw : key;
      if (!values) return message;
      return message.replace(/\{(\w+)\}/g, (_, varName: string) => {
        const value = values[varName];
        return value == null ? `{${varName}}` : String(value);
      });
    };
  },
}));
