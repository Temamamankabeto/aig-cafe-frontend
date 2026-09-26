import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/providers/AppProviders";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

export const metadata: Metadata = {
  title: "AIG Cafeteria Management",
  description: "Role-based cafeteria management starter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <LanguageProvider><Providers>{children}</Providers></LanguageProvider>
      </body>
    </html>
  );
}
