import { BorrowerLoan, CalculatedLoanDetails } from "../types";

/**
 * Calculates the number of days between two date strings
 */
export function calculateDaysBetween(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  // Set times to midnight to avoid hours/minutes differences
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Computes all calculated values for a loan dynamically based on current date
 */
export function calculateLoanDetails(loan: BorrowerLoan, currentDateStr: string): CalculatedLoanDetails {
  const amount = loan.amountBorrowed || 0;
  const rate = loan.interestRate || 0;
  const manual = loan.manualAdjustment || 0;
  const paid = loan.amountPaid || 0;
  
  // Current time elapsed
  const daysElapsed = Math.max(0, calculateDaysBetween(loan.loanDate, currentDateStr));
  const monthsElapsed = daysElapsed / 30.416; // Average month length
  
  let calculatedInterest = 0;
  
  switch (loan.interestType) {
    case 'SIMPLES_MENSAL':
      // Progressively applies interest down to the partial month
      calculatedInterest = amount * (rate / 100) * monthsElapsed;
      break;
      
    case 'COMPOSTO_MENSAL':
      // Formula: P * ((1 + r)^t - 1)
      calculatedInterest = amount * (Math.pow(1 + (rate / 100), monthsElapsed) - 1);
      break;
      
    case 'SIMPLES_DIARIO':
      // Interest compounded linearly per day
      calculatedInterest = amount * (rate / 100) * daysElapsed;
      break;
      
    case 'FIXO_UNICO':
      // Flat rate applied regardless of elapsed time
      calculatedInterest = amount * (rate / 100);
      break;
      
    default:
      calculatedInterest = 0;
  }
  
  // Clean interest to avoid negatives
  calculatedInterest = Math.max(0, calculatedInterest);
  
  if (loan.paidInterestOnly) {
    calculatedInterest = 0;
  }
  
  const totalWithInterest = amount + calculatedInterest;
  let finalDebt = Math.max(0, totalWithInterest + manual - paid);
  
  if (loan.isSettled) {
    finalDebt = 0;
  }
  
  // Overdue math
  const daysOverdue = calculateDaysBetween(loan.dueDate, currentDateStr);
  let isOverdue = finalDebt > 0 && daysOverdue > 0;
  
  if (loan.paidInterestOnly) {
    isOverdue = false;
  }
  
  // Risk and Status categorization in Portuguese with a cool humor tone
  let statusLabel = "Ativo (Em Dia)";
  let statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  
  if (finalDebt <= 0 || loan.isSettled) {
    statusLabel = "Quitado 🎉";
    statusColor = "bg-green-600/20 text-green-300 border-green-500/30";
  } else if (loan.paidInterestOnly) {
    statusLabel = "Em Dia (Juros Pago 💸)";
    statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  } else if (isOverdue) {
    if (daysOverdue <= 7) {
      statusLabel = `Atrasado: ${daysOverdue} d (Visita Amistosa)`;
      statusColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    } else if (daysOverdue <= 15) {
      statusLabel = `Atrasado: ${daysOverdue} d (Ligar Freqüente)`;
      statusColor = "bg-amber-600/15 text-amber-400 border-amber-600/35";
    } else if (daysOverdue <= 30) {
      statusLabel = `Atrasado: ${daysOverdue} d (Cobrança Forte 💢)`;
      statusColor = "bg-orange-600/20 text-orange-400 border-orange-500/40";
    } else {
      statusLabel = `Inadimplente Crítico: ${daysOverdue} d (Acionar Cobradores 🔥)`;
      statusColor = "bg-red-600/25 text-red-400 border-red-500/50 animate-pulse";
    }
  } else {
    // Left days
    const leftDays = calculateDaysBetween(currentDateStr, loan.dueDate);
    if (leftDays === 0) {
      statusLabel = "Vence Hoje! ⚠️";
      statusColor = "bg-yellow-500/25 text-yellow-300 border-yellow-400/30";
    } else if (leftDays <= 3) {
      statusLabel = `Vence em ${leftDays} dias (Atenção)`;
      statusColor = "bg-sky-500/10 text-sky-400 border-sky-500/25";
    } else {
      const formattedDate = new Date(loan.dueDate).toLocaleDateString('pt-BR');
      statusLabel = `Em Dia (Vence ${formattedDate})`;
      statusColor = "bg-zinc-500/10 text-zinc-300 border-zinc-700/50";
    }
  }

  // If fully paid, override
  if (finalDebt === 0) {
    statusLabel = "Quitado 🎉";
    statusColor = "bg-green-600/20 text-green-300 border-green-500/30";
  } else if (loan.paidInterestOnly) {
    statusLabel = "Em Dia (Juros Pago 💸)";
    statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }

  // Calculate planned loan duration in whole calendar months to avoid fractional decimal division errors
  const start = new Date(loan.loanDate);
  const end = new Date(loan.dueDate);
  let plannedMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (plannedMonths <= 0) {
    const totalPlannedDays = calculateDaysBetween(loan.loanDate, loan.dueDate);
    plannedMonths = Math.max(1, Math.round(totalPlannedDays / 30));
  }

  // Interest of a single period (monthly or daily) depending on the rate type
  let monthlyInterestOnly = 0;
  let monthlyTotalWithInterest = 0;
  let paymentLabel = "por mês";
  let interestLabel = "/mês";

  if (loan.interestType === 'SIMPLES_DIARIO') {
    const plannedDays = Math.max(1, calculateDaysBetween(loan.loanDate, loan.dueDate));
    paymentLabel = "por dia";
    interestLabel = "/dia";
    monthlyInterestOnly = amount * (rate / 100);
    monthlyTotalWithInterest = (amount / plannedDays) + monthlyInterestOnly + (manual / plannedDays);
  } else if (loan.interestType === 'FIXO_UNICO') {
    paymentLabel = "total";
    interestLabel = "fixo";
    monthlyInterestOnly = amount * (rate / 100);
    monthlyTotalWithInterest = amount + monthlyInterestOnly + manual;
  } else { // SIMPLES_MENSAL or COMPOSTO_MENSAL
    paymentLabel = "por mês";
    interestLabel = "/mês";
    monthlyInterestOnly = amount * (rate / 100);
    monthlyTotalWithInterest = (amount / plannedMonths) + monthlyInterestOnly + (manual / plannedMonths);
  }

  // Outstanding interest today, incorporating payments
  let outstandingInterest = Math.max(0, calculatedInterest - paid);
  if (loan.isSettled || loan.paidInterestOnly) {
    outstandingInterest = 0;
  }
  
  return {
    elapsedDays: Math.round(daysElapsed),
    elapsedMonths: Number(monthsElapsed.toFixed(2)),
    calculatedInterest: Number(calculatedInterest.toFixed(2)),
    totalWithInterest: Number(totalWithInterest.toFixed(2)),
    finalDebt: Number(finalDebt.toFixed(2)),
    isOverdue,
    daysOverdue: Math.max(0, daysOverdue),
    statusLabel,
    statusColor,
    monthlyInterestOnly: Number(Math.max(0, monthlyInterestOnly).toFixed(2)),
    monthlyTotalWithInterest: Number(Math.max(0, monthlyTotalWithInterest).toFixed(2)),
    paymentLabel,
    interestLabel,
    outstandingInterest: Number(Math.max(0, outstandingInterest).toFixed(2))
  };
}

/**
 * Returns mock initial loan data for Portuguese sandbox preview
 */
export function getInitialMockLoans(): BorrowerLoan[] {
  return [
    {
      id: "1",
      name: "Marcão da Borracharia",
      address: "Av. Brasil, 1940, Galpão B, São Paulo - SP",
      amountBorrowed: 5000,
      interestRate: 20, // 20% juros ao mês (padrão agiota)
      interestType: "SIMPLES_MENSAL",
      loanDate: "2026-04-10",
      dueDate: "2026-05-15",
      manualAdjustment: 350, // Multa de atraso extra de R$350 adicionada manualmente
      amountPaid: 1500, // Amorteceu R$1500
      notes: "Marcão já pagou R$ 1500 mas sumiu na última semana. Disse que o genro ia fazer PIX.",
    },
    {
      id: "2",
      name: "Dona Creusa do Pastel",
      address: "Rua das Palmeiras, 102, Próximo à Feira Municipal",
      amountBorrowed: 1500,
      interestRate: 15,
      interestType: "SIMPLES_MENSAL",
      loanDate: "2026-05-02",
      dueDate: "2026-06-02",
      manualAdjustment: 0,
      amountPaid: 0,
      notes: "Dona Creusa é pontual, excelente cliente. Paga em dinheiro vivo ou Pix de pastelaria.",
    },
    {
      id: "3",
      name: "Cleiton 'Rebaixados' Lima",
      address: "Rua do Arrastão, 45, Beco 3, Diadema - SP",
      amountBorrowed: 3000,
      interestRate: 10,
      interestType: "SIMPLES_DIARIO", // Juros diário de 10% (Risco alto!)
      loanDate: "2026-05-15",
      dueDate: "2026-05-20",
      manualAdjustment: 150, // Taxa de guincho/visita
      amountPaid: 0,
      notes: "Cleiton do som automotivo. Já está atrasado há vários dias. Atitude suspeita.",
    },
    {
      id: "4",
      name: "Paula da Odonto",
      address: "Condomínio Golden Hills, Torre Sul, Apto 1403",
      amountBorrowed: 20000,
      interestRate: 25, // Taxa fixa
      interestType: "FIXO_UNICO",
      loanDate: "2026-03-01",
      dueDate: "2026-05-01",
      manualAdjustment: -1000, // Desconto por indicação de outro cliente!
      amountPaid: 19000, 
      notes: "Acertou quase tudo, falta pouco. Super rica, mas chora desconto.",
    }
  ];
}
