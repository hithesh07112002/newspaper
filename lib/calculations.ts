import { LedgerData } from "./types";

export interface MonthlyMetrics {
  totalCollection: number;
  agentProfit: number;
  incentive: number;
  salaryDeduction: number;
  netProfit: number;
  lossAmount: number;
}

export function calculateMetrics(data: LedgerData, monthYear: string): MonthlyMetrics {
  const monthCollections = data.collections.filter(
    (entry) => entry.monthYear === monthYear && entry.status === "PAID",
  );

  const totalCollection = monthCollections.reduce((sum, entry) => sum + entry.amount, 0);
  const agentProfit = totalCollection * 0.2;

  const earlyPaidAmount = monthCollections
    .filter((entry) => {
      const paidDay = new Date(entry.paymentDate).getDate();
      return paidDay <= 10;
    })
    .reduce((sum, entry) => sum + entry.amount, 0);

  const incentive = earlyPaidAmount * 0.08;

  const salaryDeduction = data.salaries
    .filter((item) => item.monthYear === monthYear)
    .reduce((sum, item) => sum + item.amount, 0);

  const lossCopies = data.deliveries
    .filter((entry) => entry.status === "DELIVERED")
    .reduce((sum, entry) => sum + Math.max(0, entry.ordered - entry.delivered), 0);
  const lossAmount = lossCopies * data.unitCost;
  const netProfit = agentProfit + incentive - salaryDeduction - lossAmount;

  return {
    totalCollection,
    agentProfit,
    incentive,
    salaryDeduction,
    netProfit,
    lossAmount,
  };
}
