// Payroll tax math for The Care Royal paystubs. Ported from the Python paystub
// generator (2025 federal + California brackets, FICA, CA SDI). ESTIMATES for
// pay-document generation only — The Care Royal does not file taxes or move money.
// Add a new year by adding another TaxTable and selecting it by year.

export interface TaxTable {
  federalBrackets: [number, number][]; // [upperBound, rate]
  federalStdDed: number;
  caBrackets: [number, number][];
  caStdDed: number;
  ssRate: number; ssWageBase: number;
  medicareRate: number; addlMedicareRate: number; addlMedicareThreshold: number;
  caSdiRate: number;
}

export const TAX_2025: TaxTable = {
  federalBrackets: [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [626350, 0.35], [Infinity, 0.37]],
  federalStdDed: 15000,
  caBrackets: [[10756, 0.01], [25499, 0.02], [40245, 0.04], [55866, 0.06], [70606, 0.08], [375221, 0.093], [450000, 0.103], [750000, 0.113], [Infinity, 0.123]],
  caStdDed: 5540,
  ssRate: 0.062, ssWageBase: 176100,
  medicareRate: 0.0145, addlMedicareRate: 0.009, addlMedicareThreshold: 200000,
  caSdiRate: 0.011,
};

function progressiveTax(taxable: number, brackets: [number, number][]): number {
  let tax = 0, prev = 0;
  for (const [upper, rate] of brackets) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, upper) - prev) * rate;
    prev = upper;
  }
  return Math.max(0, tax);
}

export const FREQUENCIES: { key: string; label: string; perYear: number }[] = [
  { key: "weekly", label: "Weekly", perYear: 52 },
  { key: "biweekly", label: "Bi-weekly", perYear: 26 },
  { key: "semimonthly", label: "Semi-monthly", perYear: 24 },
  { key: "monthly", label: "Monthly", perYear: 12 },
];
export function perYear(freq: string): number {
  return FREQUENCIES.find((f) => f.key === freq)?.perYear || 26;
}

export interface StubInput {
  annual: number;            // annualized gross
  freq: string;              // weekly | biweekly | semimonthly | monthly
  periodNumber: number;      // 1-based period in the year (drives YTD)
  exemptFederal?: boolean;
  exemptCA?: boolean;
}
export interface StubLine { label: string; current: number; ytd: number }
export interface StubResult { gross: StubLine; taxes: StubLine[]; net: number; netYtd: number; periods: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateStub(inp: StubInput): StubResult {
  const t = TAX_2025;
  const n = perYear(inp.freq);
  const annual = Math.max(0, inp.annual);
  const grossP = annual / n;

  const fedAnnual = inp.exemptFederal ? 0 : progressiveTax(Math.max(0, annual - t.federalStdDed), t.federalBrackets);
  const caAnnual = inp.exemptCA ? 0 : progressiveTax(Math.max(0, annual - t.caStdDed), t.caBrackets);
  const ssAnnual = Math.min(annual, t.ssWageBase) * t.ssRate;
  const medAnnual = annual * t.medicareRate + Math.max(0, annual - t.addlMedicareThreshold) * t.addlMedicareRate;
  const sdiAnnual = annual * t.caSdiRate;

  const per = (a: number) => a / n;
  const k = Math.max(1, inp.periodNumber);
  const line = (label: string, annualAmt: number): StubLine => ({ label, current: r2(per(annualAmt)), ytd: r2(per(annualAmt) * k) });

  const taxes = [
    line("Federal income tax", fedAnnual),
    line("Social Security", ssAnnual),
    line("Medicare", medAnnual),
    line("CA income tax", caAnnual),
    line("CA SDI", sdiAnnual),
  ];
  const totalDedP = taxes.reduce((a, l) => a + l.current, 0);
  return {
    gross: { label: "Gross pay", current: r2(grossP), ytd: r2(grossP * k) },
    taxes,
    net: r2(grossP - totalDedP),
    netYtd: r2((grossP - totalDedP) * k),
    periods: n,
  };
}
