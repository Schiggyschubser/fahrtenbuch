import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { AppFooter, type ChangelogEntry } from "@/components/AppFooter";
import changelog from "@/lib/changelog.json";
import packageJson from "@/package.json";
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY } from "@/lib/themes";
import "./globals.css";

config.autoAddCss = false;

export const metadata: Metadata = {
  title: "Fahrtenbuch",
  description: "Persönliches Fahrtenbuch für Dienstfahrten",
};

const themeInitializationScript = `
(function () {
  try {
    var allowedThemes = ${JSON.stringify(THEMES.map((theme) => theme.id))};
    var storedTheme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = allowedThemes.indexOf(storedTheme) >= 0 ? storedTheme : ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.dataset.theme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
  }
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>
        <div className="flex min-h-screen flex-col">
          <div className="min-h-0 flex-1">{children}</div>
          <AppFooter version={packageJson.version} changelog={changelog as ChangelogEntry[]} />
        </div>
      </body>
    </html>
  );
}
