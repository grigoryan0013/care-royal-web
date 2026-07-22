import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Care Royal for Agencies — run your agency end to end",
  description: "Scheduling, caregivers, family bookings, care plans, e-sign, payments and payroll — one white-label platform for home-care agencies. Start a free trial.",
};

export default function AgenciesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
