import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sandbox",
  robots: { index: false, follow: false },
};

/** Controlled websites used as benchmark targets. Intentionally free of platform navigation. */
export default function SandboxLayout({ children }: LayoutProps<"/sandbox">) {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-8">{children}</div>
    </div>
  );
}
