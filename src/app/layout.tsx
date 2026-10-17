import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Agent Olympics", template: "%s · Agent Olympics" },
  description: "Benchmark, stress-test and rank AI web agents on real browser tasks executed through TinyFish.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
