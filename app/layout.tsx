import "./style.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  icons: { icon: "/icon.svg" },
  title: "SkillSwap AI — A little progress. A lot of possibility.",
  description:
    "Exchange skills, learn with a personal AI coach, build learning paths, and keep proof of your progress.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
