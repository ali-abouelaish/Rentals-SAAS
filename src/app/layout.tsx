import "./globals.css";
import { Inter, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import { ClientToaster } from "@/components/shared/ClientToaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"]
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["600"]
});

export const metadata = {
  title: "Rental Agency SaaS",
  description: "Multi-tenant rental agency platform",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <ClientToaster />
      </body>
    </html>
  );
}
