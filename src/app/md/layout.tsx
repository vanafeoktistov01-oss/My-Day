import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мой День — Check-in",
  robots: "noindex, nofollow",
};

export default function MdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="md-container" suppressHydrationWarning>
      {children}
    </div>
  );
}
