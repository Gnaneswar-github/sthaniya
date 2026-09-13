import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
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
        <CurrencyProvider>{children}</CurrencyProvider>
      </body>
    </html>
  );
}
