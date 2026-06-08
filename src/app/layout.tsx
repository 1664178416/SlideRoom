import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { PreferencesProvider, type Language, type ThemeMode } from "@/lib/preferences";
import "./globals.css";

const languageCookieKey = "slideroom-language";
const themeCookieKey = "slideroom-theme";

function getLayoutLanguage(value?: string): Language {
  return value === "en" || value === "zh" ? value : "zh";
}

function getLayoutTheme(value?: string): ThemeMode {
  return value === "dark" || value === "light" ? value : "light";
}

const preferenceInitScript = `
(function () {
  try {
    function readCookie(key) {
      var pair = document.cookie.split("; ").find(function (item) {
        return item.indexOf(key + "=") === 0;
      });
      return pair ? decodeURIComponent(pair.slice(key.length + 1)) : null;
    }

    function readStorage(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    function writeCookie(key, value) {
      try {
        document.cookie = key + "=" + encodeURIComponent(value) + "; path=/; max-age=31536000; SameSite=Lax";
      } catch (error) {}
    }

    var language = readStorage("slideroom-language") || readCookie("slideroom-language");
    if (language !== "zh" && language !== "en") {
      language = navigator.language.toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
    }

    var theme = readStorage("slideroom-theme") || readCookie("slideroom-theme");
    if (theme !== "light" && theme !== "dark") {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    writeCookie("slideroom-language", language);
    writeCookie("slideroom-theme", theme);

    var root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.lang = language === "zh" ? "zh-CN" : "en";
    root.style.colorScheme = theme;
  } catch (error) {}
})();
`;

export const metadata: Metadata = {
  title: "SlideRoom",
  description: "An AI workspace for slide-by-slide PPT reading.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLanguage = getLayoutLanguage(cookieStore.get(languageCookieKey)?.value);
  const initialTheme = getLayoutTheme(cookieStore.get(themeCookieKey)?.value);

  return (
    <html
      className={initialTheme === "dark" ? "dark" : undefined}
      data-theme={initialTheme}
      lang={initialLanguage === "zh" ? "zh-CN" : "en"}
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
    >
      <body>
        <Script
          dangerouslySetInnerHTML={{ __html: preferenceInitScript }}
          id="slideroom-preferences"
          strategy="beforeInteractive"
        />
        <PreferencesProvider initialLanguage={initialLanguage} initialTheme={initialTheme}>
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
