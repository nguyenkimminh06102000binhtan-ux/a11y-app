import type { Metadata } from "next";
import "./globals.css";
import { Atkinson_Hyperlegible } from "next/font/google";

// Designed for readers with low vision. Downloaded at build time and served from our own domain:
// visitors' browsers never contact Google.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "a11y-app dashboard",
  description: "Find accessibility issues on your sites and see exactly where to fix them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
