import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Care Royal — Care you can trust",
  description: "Find and manage trusted care — babysitters, nannies, senior care, pet care and housekeeping near you. Or run your care agency end to end.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
