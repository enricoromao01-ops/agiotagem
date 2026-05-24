export type InterestType = 'SIMPLES_MENSAL' | 'COMPOSTO_MENSAL' | 'SIMPLES_DIARIO' | 'FIXO_UNICO';

export interface BorrowerLoan {
  id: string;
  name: string;
  address: string;
  amountBorrowed: number; // Valor emprestado (R$)
  interestRate: number;   // Taxa de juros (%)
  interestType: InterestType;
  loanDate: string;       // Data emprestada
  dueDate: string;        // Data de vencimento
  manualAdjustment: number; // Modificador manual (descontos ou multas extras)
  amountPaid: number;       // Valor já abatido/pago
  notes: string;          // Observações (desculpas/promessas)
  riskOverride?: string;  // Nível de risco customizado
  isSettled?: boolean;    // Marcar se pagou ou não (Quitado/Pendente)
  paidInterestOnly?: boolean; // Marcar como pago apenas os juros do devedor
}

export interface CalculatedLoanDetails {
  elapsedDays: number;
  elapsedMonths: number;
  calculatedInterest: number;
  totalWithInterest: number;
  finalDebt: number; // Dynamic: totalWithInterest + manualAdjustment - amountPaid
  isOverdue: boolean;
  daysOverdue: number;
  statusLabel: string;
  statusColor: string; // Tailwind color class names
  monthlyInterestOnly: number; // Só o juros do mês de forma isolada
  monthlyTotalWithInterest: number; // Valor mensal cheio (Amortização planejada + Juros)
  paymentLabel: string; // Ex: "por mês", "por dia"
  interestLabel: string; // Ex: "/mês", "/dia"
  outstandingInterest: number; // Juros acumulados pendentes (descontando pagamentos recebidos)
}
