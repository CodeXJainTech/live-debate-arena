import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Debate Platform",
  description: "Live debate with real-time audience voting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}