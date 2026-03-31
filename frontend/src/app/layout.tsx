import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZKTrader — Private DeFi Trading",
  description: "Privacy-preserving decentralized trading platform built on Zama fhEVM with Fully Homomorphic Encryption",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
