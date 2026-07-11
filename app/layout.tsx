import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Care Royal",
  description: "Care agency management — scheduling, care plans, family bookings, payroll.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
