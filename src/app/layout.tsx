import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { PwaSupport } from "@/components/PwaSupport";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Sthānīya — travel like a local",
  description:
    "Tell us where you're going, how long you have and what you're into. Get a short, honest plan instead of a top-10 list.",
};

export const viewport: Viewport = {
  themeColor: "#f7f2ea",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </AuthProvider>
        <PwaSupport />
      </body>
    </html>
  );
}
