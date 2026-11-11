import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CellOn — Mobile shop management, made clear",
  description: "One calm, connected workspace for mobile inventory, sales, purchases and reporting.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
