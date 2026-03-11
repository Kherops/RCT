"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function LanguageSwitcher() {
  const t = useTranslations("Language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const isFrench = locale === "fr";
  const currentLocaleLabel = isFrench ? "Fr" : "En";

  const otherLocale = locale === "en" ? "fr" : "en";
  const otherLocaleLabel = otherLocale === "fr" ? t("fr") : t("en");

  function toggle() {
    startTransition(() => {
      const segments = (pathname || "/").split("/").filter(Boolean);
      if (segments[0] === "fr" || segments[0] === "en") {
        segments[0] = otherLocale;
      } else {
        segments.unshift(otherLocale);
      }

      const nextPathname = `/${segments.join("/")}`;
      const query = searchParams.toString();
      const nextUrl = query ? `${nextPathname}?${query}` : nextPathname;
      router.replace(nextUrl);
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={t("switchTo", { locale: otherLocaleLabel })}
      aria-label={t("switchTo", { locale: otherLocaleLabel })}
      className={`
        relative w-8 h-12 rounded-full border-1 overflow-hidden
        flex flex-col items-center justify-between px-1 py-1
        transition-all duration-200 shadow-sm
        ${isFrench ? "bg-discord-accent border-discord-accent" : "bg-discord-light border-discord-lighter"}
        ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-110"}
      `}
    >
      <span
        className={`
          absolute left-1 right-1 h-6 rounded-full bg-white transition-transform duration-200
          ${isFrench ? "translate-y-0 top-1" : "translate-y-4 top-1"}
        `}
      />
      <span className="relative z-10 text-[10px] leading-none font-bold text-white/85">
        {currentLocaleLabel}
      </span>
      <span className="relative z-10 text-[10px] leading-none font-bold text-white/85">
        {currentLocaleLabel}
      </span>
    </button>
  );
}
