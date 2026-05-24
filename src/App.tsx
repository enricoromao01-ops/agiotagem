import React, { useState, useEffect } from "react";
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  User, 
  MapPin, 
  Calendar, 
  Percent, 
  Coins, 
  Clock, 
  Copy, 
  Check, 
  Search, 
  MessageSquare, 
  AlertTriangle, 
  ShieldAlert,
  Info,
  Sliders,
  X,
  DollarSign as CurrencyIcon
} from "lucide-react";
import { BorrowerLoan, CalculatedLoanDetails, InterestType } from "./types";
import { calculateLoanDetails, getInitialMockLoans, calculateDaysBetween } from "./utils/calculator";

export default function App() {
  // --- Persistent Local State ---
  const [loans, setLoans] = useState<BorrowerLoan[]>(() => {
    const saved = localStorage.getItem("CREDIT_LOG_LOANS_V2");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao ler registros locais, restaurando mock.", e);
      }
    }
    return getInitialMockLoans();
  });

  // Current selected loan id (Defaulting to the first one)
  const [selectedId, setSelectedId] = useState<string>(() => {
    const initialLoans = getInitialMockLoans();
    return loans.length > 0 ? loans[0].id : (initialLoans[0]?.id || "");
  });

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  // Status filter (all, active, overdue, paid)
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "EM_DIA" | "ATRASADO" | "QUITADO">("TODOS");

  // Current simulation date (so user can travel in time to test juros compostos counters!)
  const [currentDate, setCurrentDate] = useState<string>(() => {
    // Defaulting to today or mock state anchor date (2026-05-22 as defined by environment metadata)
    return "2026-05-22";
  });

  // AI tone for message generation
  const [aiTone, setAiTone] = useState<"amistoso" | "firme" | "severo" | "chefao">("firme");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Quick feedback alert triggers
  const [systemNotice, setSystemNotice] = useState<{ message: string; type: "success" | "info" | "warning" } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sync state back to persistent storage
  useEffect(() => {
    localStorage.setItem("CREDIT_LOG_LOANS_V2", JSON.stringify(loans));
  }, [loans]);

  // Show a quick transient system notification
  const triggerNotification = (msg: string, type: "success" | "info" | "warning" = "success") => {
    setSystemNotice({ message: msg, type });
    setTimeout(() => {
      setSystemNotice(null);
    }, 4500);
  };

  // Find the currently selected loan
  const currentLoan = loans.find(l => l.id === selectedId) || loans[0] || null;

  // Handle value change of the current loan (manual update space)
  const updateCurrentLoanField = <K extends keyof BorrowerLoan>(key: K, value: BorrowerLoan[K]) => {
    if (!currentLoan) return;
    setLoans(prev => 
      prev.map(l => l.id === currentLoan.id ? { ...l, [key]: value } : l)
    );
  };

  // --- Create Devedor Modal States ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientAmount, setNewClientAmount] = useState<number>(1000);
  const [newClientRate, setNewClientRate] = useState<number>(10);
  const [newClientType, setNewClientType] = useState<InterestType>("SIMPLES_MENSAL");
  const [newClientLoanDate, setNewClientLoanDate] = useState("");
  const [newClientDueDate, setNewClientDueDate] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [newClientIsSettled, setNewClientIsSettled] = useState(false);
  const [newClientPaidInterestOnly, setNewClientPaidInterestOnly] = useState(false);

  // Create a new loan record (opens modal prefilled with sensible defaults)
  const handleAddNewLoan = () => {
    setNewClientName("");
    setNewClientAddress("");
    setNewClientAmount(1000);
    setNewClientRate(10);
    setNewClientType("SIMPLES_MENSAL");
    setNewClientLoanDate(currentDate);
    // Padrão: +30 dias da data de concessão
    const defaultDue = new Date(new Date(currentDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setNewClientDueDate(defaultDue);
    setNewClientNotes("");
    setNewClientIsSettled(false);
    setNewClientPaidInterestOnly(false);
    setIsCreateModalOpen(true);
  };

  // Confirm creation of a new client with actual inputs
  const handleConfirmCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      triggerNotification("O nome do devedor é obrigatório!", "warning");
      return;
    }
    if (newClientAmount <= 0) {
      triggerNotification("O valor emprestado precisa ser maior que zero!", "warning");
      return;
    }

    const newId = Date.now().toString();
    const newRecord: BorrowerLoan = {
      id: newId,
      name: newClientName.trim(),
      address: newClientAddress.trim() || "Endereço não informado",
      amountBorrowed: Number(newClientAmount),
      interestRate: Number(newClientRate),
      interestType: newClientType,
      loanDate: newClientLoanDate || currentDate,
      dueDate: newClientDueDate || new Date(new Date(currentDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      manualAdjustment: 0,
      amountPaid: 0,
      notes: newClientNotes.trim() || "Nenhuma observação cadastrada.",
      isSettled: newClientIsSettled,
      paidInterestOnly: newClientPaidInterestOnly,
    };

    setLoans(prev => [newRecord, ...prev]);
    
    // Clear search query and filter to display the newly added client prominently
    setSearchQuery("");
    setStatusFilter("TODOS");
    
    setSelectedId(newId);
    setGeneratedMessage("");
    setIsCreateModalOpen(false);
    triggerNotification(`Cadastro de "${newRecord.name}" realizado com sucesso!`, "success");
  };

  // Delete/Acertar borrower record (triggers safe custom modal instead of window.confirm)
  const handleDeleteLoan = (idToDelete: string) => {
    setDeleteConfirmId(idToDelete);
  };

  const confirmDeleteLoan = () => {
    if (!deleteConfirmId) return;
    const backupName = loans.find(l => l.id === deleteConfirmId)?.name || "Registro";
    const remaining = loans.filter(l => l.id !== deleteConfirmId);
    setLoans(remaining);
    
    if (selectedId === deleteConfirmId) {
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
      } else {
        setSelectedId("");
      }
    }
    
    setGeneratedMessage("");
    setDeleteConfirmId(null);
    triggerNotification(`Registro de ${backupName} removido.`, "warning");
  };

  // Trigger Gemini AI generation via server endpoint
  const generateAICobranca = async () => {
    if (!currentLoan) return;
    setIsGenerating(true);
    setGeneratedMessage("");
    setAiNotice("");
    
    // Pre-calculate to send calculated context
    const calculations = calculateLoanDetails(currentLoan, currentDate);

    try {
      const res = await fetch("/api/generate-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: currentLoan.name,
          amount: currentLoan.amountBorrowed,
          interest: currentLoan.interestRate,
          totalDebt: calculations.finalDebt,
          dueDate: currentLoan.dueDate,
          loanDate: currentLoan.loanDate,
          address: currentLoan.address,
          tone: aiTone,
          notes: currentLoan.notes
        })
      });

      if (!res.ok) {
        throw new Error("Falha ao comunicar com o servidor de IA.");
      }

      const data = await res.json();
      setGeneratedMessage(data.message || "");
      if (data.isOfflineFallback) {
        setAiNotice("Nota: Exibindo modelo inteligente offline padrão.");
      } else {
        setAiNotice("Mensagem gerada com inteligência artificial pelo Gemini 3.5!");
      }
    } catch (err: any) {
      console.error(err);
      // Offline fallback
      const fallbackMsgs = {
        amistoso: `Fala ${currentLoan.name}, tudo tranquilo? Passando pra lembrar do nosso fechamento programado para ${new Date(currentLoan.dueDate).toLocaleDateString('pt-BR')} no valor de R$ ${calculations.finalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Se precisar de uma força, me avisa! Abração.`,
        firme: `Prezado(a) ${currentLoan.name}. Lembramos que o saldo devedor atualizado é de R$ ${calculations.finalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, referente ao empréstimo com vencimento acordado para ${new Date(currentLoan.dueDate).toLocaleDateString('pt-BR')}. Gentileza retornar para alinhamento da devolução de valores.`,
        severo: `URGENTE: ${currentLoan.name}, o saldo de R$ ${calculations.finalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} encontra-se inadimplente. Estamos cientes de que reside em: ${currentLoan.address}. Evite problemas com os cobradores de condomínio. Faça o PIX hoje.`,
        chefao: `Prezado Don ${currentLoan.name}. A família revisou o livro verde e acusou pendência financeira líquida de R$ ${calculations.finalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Respeito gera respeito. Aguardo uma resposta de honra até o pôr do sol.`
      };
      setGeneratedMessage(fallbackMsgs[aiTone]);
      setAiNotice("Gerado via algoritmo local (API offline temporariamente).");
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy to Clipboard convenient feature
  const copyToClipboard = () => {
    if (!generatedMessage) return;
    navigator.clipboard.writeText(generatedMessage);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
    triggerNotification("Mensagem de cobrança copiada para a área de transferência!", "success");
  };

  // Batch calculate statistics for indicator items
  const stats = React.useMemo(() => {
    let totalOriginal = 0;
    let totalCurrentDebt = 0;
    let totalAdditions = 0;
    let totalPayments = 0;
    let overdueCount = 0;
    let activeClientCount = 0;

    loans.forEach(loan => {
      const calc = calculateLoanDetails(loan, currentDate);
      if (calc.finalDebt > 0) {
        totalCurrentDebt += calc.finalDebt;
        totalOriginal += loan.amountBorrowed;
        totalAdditions += loan.manualAdjustment;
        totalPayments += loan.amountPaid;
        activeClientCount++;
        if (calc.isOverdue) {
          overdueCount++;
        }
      }
    });

    return {
      totalOriginal,
      totalCurrentDebt,
      totalAdditions,
      totalPayments,
      overdueCount,
      activeClientCount,
      totalRegistered: loans.length
    };
  }, [loans, currentDate]);

  // Filter list of loans based on search queries and status pills
  const filteredLoans = loans.filter(loan => {
    const calc = calculateLoanDetails(loan, currentDate);
    const matchesSearch = 
      loan.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      loan.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.notes.toLowerCase().includes(searchQuery.toLowerCase());

    const isOverdue = calc.isOverdue;
    const isPaid = calc.finalDebt <= 0;
    const isOk = !isOverdue && !isPaid;

    if (statusFilter === "EM_DIA") return matchesSearch && isOk;
    if (statusFilter === "ATRASADO") return matchesSearch && isOverdue;
    if (statusFilter === "QUITADO") return matchesSearch && isPaid;
    return matchesSearch;
  });

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none antialiased">
      
      {/* 1. TOP HEADER / PRIVATE LEDGER INDICATORS */}
      <nav className="h-auto md:h-16 border-b border-zinc-800 bg-zinc-900/60 flex flex-col md:flex-row items-center justify-between px-6 py-3 md:py-0 gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-9 h-9 bg-emerald-500 rounded flex items-center justify-center font-black text-zinc-950 text-lg shadow-lg shadow-emerald-500/10">
            $
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-emerald-400">AGIOTA-NET</h1>
              <span className="text-[9px] bg-red-950/80 text-red-400 border border-red-900/60 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider">
                Crypt-Ledger v2.6
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Gestão de Crédito de Alto Risco & Cálculo Inteligente</p>
          </div>
        </div>

        {/* Global Stats bar with High Density styling */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto text-xs font-mono">
          <div className="bg-zinc-950/40 border border-zinc-800/60 rounded px-3 py-1 text-right min-w-[120px]">
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Ativos / Total</p>
            <p className="text-zinc-200 font-bold">{stats.activeClientCount} / {stats.totalRegistered}</p>
          </div>
          <div className="bg-zinc-950/40 border border-zinc-800/60 rounded px-3 py-1 text-right min-w-[130px]">
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Em Atraso Máximo</p>
            <p className="text-amber-500 font-bold">{stats.overdueCount} Devedores</p>
          </div>
          <div className="bg-zinc-950/40 border border-zinc-980/80 rounded px-3 py-1 text-right min-w-[150px]">
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Principal Emitido</p>
            <p className="text-zinc-300">R$ {stats.totalOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-zinc-950/40 border border-emerald-950 text-right px-4 py-1.5 rounded bg-emerald-950/10 min-w-[170px]">
            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Saldo Total a Receber</p>
            <p className="text-emerald-400 font-bold text-sm">
              R$ {stats.totalCurrentDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </nav>

      {/* SYSTEM NOTICE BANNER */}
      {systemNotice && (
        <div id="toast-adv" className={`px-6 py-2 text-xs font-mono border-b flex items-center justify-between transition-all duration-300 ${
          systemNotice.type === "success" 
            ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/40" 
            : systemNotice.type === "warning"
            ? "bg-red-950/40 text-red-300 border-red-900/40"
            : "bg-zinc-900 text-zinc-300 border-zinc-700"
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span>[DIÁRIO DO MANAGER] {systemNotice.message}</span>
          </div>
          <button onClick={() => setSystemNotice(null)} className="text-[10px] underline cursor-pointer hover:text-white">
            Ignorar
          </button>
        </div>
      )}

      {/* 2. MAIN SPLIT LAYOUT */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: ACTIVE LEDGER DATA & FILTER SHELF */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto lg:overflow-hidden bg-zinc-950">
          
          {/* Controls menu bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/80">
            
            {/* Real Search Input with layout indicator */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Search size={14} />
              </span>
              <input
                id="search-input-box"
                type="text"
                placeholder="Buscar devedor por nome, endereço, notas..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500 placeholder-zinc-600 transition-colors"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 text-xs text-[10px]"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[10px] text-zinc-500 uppercase font-mono mr-1 hidden md:inline">Filtro:</span>
              {(["TODOS", "EM_DIA", "ATRASADO", "QUITADO"] as const).map(pill => {
                const isActive = statusFilter === pill;
                return (
                  <button
                    key={pill}
                    id={`filter-${pill.toLowerCase()}`}
                    onClick={() => setStatusFilter(pill)}
                    className={`px-2.5 py-1 text-[10px] font-mono rounded font-bold uppercase transition-all tracking-wider cursor-pointer border ${
                      isActive 
                        ? "bg-zinc-100 text-zinc-950 border-white" 
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-850"
                    }`}
                  >
                    {pill === "EM_DIA" ? "Em Dia" : pill === "ATRASADO" ? "Em Atraso" : pill === "QUITADO" ? "Quitados" : "Todos"}
                  </button>
                );
              })}
            </div>

            {/* Simulated Time traveler control so interest computation can be verified in real-time */}
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded">
              <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                <Clock size={11} className="text-amber-400" /> SIMULAÇÃO:
              </span>
              <input
                id="date-simulator-picker"
                type="date"
                className="bg-transparent text-xs text-zinc-200 outline-none focus:text-emerald-400 font-mono border-none cursor-pointer p-0"
                value={currentDate}
                onChange={e => {
                  setCurrentDate(e.target.value);
                  triggerNotification(`Calendário de cobrança alterado para ${new Date(e.target.value).toLocaleDateString('pt-BR')}. Juros recalculados!`, "info");
                }}
              />
            </div>

            {/* "+ Novo Lançamento" Button */}
            <button
              id="btn-add-loan"
              onClick={handleAddNewLoan}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 sm:py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-700/10 shrink-0"
            >
              <Plus size={14} /> NOVO LANÇAMENTO
            </button>
          </div>

          {/* MAIN LANÇAMENTOS TABLE / CARD CONTAINER */}
          <div className="flex-1 border border-zinc-800/80 rounded-lg bg-zinc-900/20 overflow-hidden flex flex-col min-h-[400px]">
            {/* Table Header for desktop View */}
            <div className="hidden md:grid grid-cols-12 bg-zinc-900/80 text-zinc-500 text-[10px] uppercase font-bold tracking-wider py-3 px-4 border-b border-zinc-800 flex-shrink-0">
              <div className="col-span-3">Cidadão / Endereço</div>
              <div className="col-span-1 text-center font-mono">Início</div>
              <div className="col-span-1 text-center font-mono">Prazo Final</div>
              <div className="col-span-1 text-center font-mono">Alerta</div>
              <div className="col-span-1 text-right font-mono">Principal</div>
              <div className="col-span-2 text-right text-emerald-400 font-mono">Receber/Período</div>
              <div className="col-span-2 text-right text-amber-500 font-bold font-mono">Só Juros/Período</div>
              <div className="col-span-1 text-center text-red-500 font-mono">Excluir</div>
            </div>

            {/* Table Rows or Grid for Mobile */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
              {filteredLoans.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
                  <AlertTriangle className="text-zinc-600 mb-2 animate-bounce" size={28} />
                  <p className="text-xs font-mono text-zinc-400">Nenhum devedor encontrado no boletim eletrônico.</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Experimente alterar os filtros de status ou criar um novo registro.</p>
                  {statusFilter !== "TODOS" && (
                    <button 
                      onClick={() => setStatusFilter("TODOS")} 
                      className="mt-3 text-[10px] text-emerald-400 underline hover:text-emerald-300 font-mono"
                    >
                      Remover filtros
                    </button>
                  )}
                </div>
              ) : (
                filteredLoans.map(loan => {
                  const details = calculateLoanDetails(loan, currentDate);
                  const isSelected = loan.id === selectedId;

                  return (
                    <div
                      key={loan.id}
                      id={`loan-row-${loan.id}`}
                      onClick={() => {
                        setSelectedId(loan.id);
                        setGeneratedMessage("");
                      }}
                      className={`grid grid-cols-1 md:grid-cols-12 items-center py-4 px-4 border-l-4 transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-zinc-800/40 border-l-emerald-500 bg-gradient-to-r from-emerald-500/5 to-transparent" 
                          : "border-l-transparent hover:bg-zinc-900/60"
                      }`}
                    >
                      {/* Name / Address */}
                      <div className="col-span-1 md:col-span-3 mb-2 md:mb-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-bold transition-all text-xs lg:text-sm ${isSelected ? 'text-emerald-400' : 'text-zinc-200'}`}>
                            {loan.name || "Agiotado Sem Nome"}
                          </p>
                          {details.finalDebt <= 0 && (
                            <span className="text-[8px] bg-green-500/20 text-green-400 px-1 py-0.2 rounded uppercase tracking-widest border border-green-500/20 font-mono">
                              PAGO
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={10} className="shrink-0" /> {loan.address || "Sem endereço cadastrado."}
                        </p>
                      </div>

                      {/* Loan Date */}
                      <div className="col-span-1 md:col-span-1 text-left md:text-center text-xs text-zinc-400 mb-1 md:mb-0">
                        <span className="md:hidden text-[9px] text-zinc-600 font-mono uppercase mr-1">Concessão:</span>
                        <span className="font-mono text-[11px]">{new Date(loan.loanDate).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {/* Due Date Indicator */}
                      <div className="col-span-1 md:col-span-1 text-left md:text-center mb-1 md:mb-0">
                        <span className="md:hidden text-[9px] text-zinc-600 font-mono uppercase mr-1">Vence em:</span>
                        <span className="text-xs bg-zinc-950/80 text-zinc-300 font-mono px-2 py-0.5 rounded border border-zinc-800 text-[11px]">
                          {new Date(loan.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {/* Dynamic Status Label with loan shark threat level */}
                      <div className="col-span-1 md:col-span-1 text-left md:text-center mb-2 md:mb-0">
                        <span className="md:hidden text-[9px] text-zinc-600 font-mono uppercase mr-1">Alerta:</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${details.statusColor} font-mono tracking-wide`}>
                          {details.statusLabel}
                        </span>
                      </div>

                      {/* Original Loan Amount */}
                      <div className="col-span-1 md:col-span-1 text-left md:text-right text-xs text-zinc-400 font-mono mb-1 md:mb-0">
                        <span className="md:hidden text-[9px] text-zinc-600 font-mono uppercase mr-1">Principal:</span>
                        R$ {loan.amountBorrowed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <p className="text-[9px] text-zinc-500">
                          Juros: {loan.interestRate}%
                        </p>
                      </div>

                      {/* VALOR MENSAL (já com juros) */}
                      <div className="col-span-1 md:col-span-2 text-left md:text-right font-mono mt-1 md:mt-0 flex md:flex-col items-baseline md:items-end justify-between md:justify-center">
                        <span className="md:hidden text-[9px] text-emerald-500 font-bold uppercase mr-1">A receber por Período:</span>
                        <div>
                          <p className="text-sm font-bold text-emerald-400">
                            R$ {details.monthlyTotalWithInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[9px] text-zinc-500">
                            Quota {details.paymentLabel}
                          </p>
                        </div>
                      </div>

                      {/* SÓ OS JUROS */}
                      <div className="col-span-1 md:col-span-2 text-left md:text-right font-mono mt-1 md:mt-0 flex md:flex-col items-baseline md:items-end justify-between md:justify-center">
                        <span className="md:hidden text-[9px] text-amber-500 font-bold uppercase mr-1">Só os Juros:</span>
                        <div>
                          <p className="text-sm font-bold text-amber-400">
                            R$ {details.monthlyInterestOnly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{details.interestLabel}
                          </p>
                          <p className="text-[9px] text-zinc-500">
                            Pendente: R$ {details.outstandingInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Action column (Eliminar Cliente) */}
                      <div className="col-span-1 md:col-span-1 flex items-center justify-end md:justify-center mt-2.5 md:mt-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLoan(loan.id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 md:p-1.5 rounded text-[10px] md:text-xs font-mono font-bold uppercase transition-all text-red-500 hover:text-white bg-red-950/30 hover:bg-red-900 border border-red-900/35 hover:border-red-650/50 w-full md:w-auto justify-center cursor-pointer"
                          title="Eliminar Cliente"
                        >
                          <Trash2 size={13} className="shrink-0" />
                          <span className="md:hidden">Eliminar Cliente</span>
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Table bottom summary status line */}
            <div className="bg-zinc-900 border-t border-zinc-800 text-[10px] font-mono text-zinc-500 py-2.5 px-4 flex items-center justify-between">
              <div>
                EXIBINDO {filteredLoans.length} DE {loans.length} DEVEDORES NO LIVRO VERMELHO
              </div>
              <div className="hidden sm:flex gap-4">
                <span>Clique sobre o cliente para abrir a ficha cadastral de cobrança.</span>
              </div>
            </div>
          </div>

          {/* AI INTELLIGENT DEBT COLLECTOR HELPER */}
          {currentLoan && (
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-lg p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 
                    Assistente de Cobrança Inteligente (Gemini 3.5 API)
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Gere mensagens persuasivas personalizadas para cobrar <span className="text-emerald-400 font-bold">{currentLoan.name}</span> no WhatsApp.
                  </p>
                </div>

                {/* Tone options selector */}
                <div className="flex items-center gap-1.5 self-start">
                  <span className="text-[10px] text-zinc-500 font-mono">Humor:</span>
                  {(["amistoso", "firme", "severo", "chefao"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setAiTone(t)}
                      className={`text-[10px] px-2 py-0.8 font-mono rounded font-medium border uppercase transition-all ${
                        aiTone === t 
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                          : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      {t === "chefao" ? "🤵 chefão" : t === "severo" ? "💥 severo" : t === "amistoso" ? "😊 amigável" : "💼 firme"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 items-stretch">
                
                {/* Tone features / Description help card */}
                <div className="bg-zinc-950/60 p-3 rounded border border-zinc-900 text-[11px] flex flex-col justify-between">
                  <div className="space-y-2 text-zinc-400">
                    <p className="font-semibold text-zinc-300 flex items-center gap-1">
                      <Sliders size={12} className="text-emerald-400 font-mono" /> Contexto Alimentado:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-500">
                      <li>Nome: {currentLoan.name}</li>
                      <li>Endereço: {currentLoan.address ? "Cadastrado" : "Vazio"}</li>
                      <li>Dívida Geral: R$ {calculateLoanDetails(currentLoan, currentDate).finalDebt.toLocaleString('pt-BR')}</li>
                      <li>Data de Vencimento: {new Date(currentLoan.dueDate).toLocaleDateString('pt-BR')}</li>
                    </ul>
                  </div>

                  <button
                    id="btn-generate-ai-text"
                    onClick={generateAICobranca}
                    disabled={isGenerating || calculateLoanDetails(currentLoan, currentDate).finalDebt <= 0}
                    className="w-full mt-4 py-2 px-3 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-wider rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <span className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                        REBOCANDO IA...
                      </>
                    ) : (
                      <>
                        <MessageSquare size={13} />
                        GERAR COBRANÇA
                      </>
                    )}
                  </button>
                </div>

                {/* AI Output preview card */}
                <div className="md:col-span-2 bg-zinc-950 rounded-lg border border-zinc-850 p-4 flex flex-col justify-between min-h-[140px] relative">
                  {/* Notice watermark or content */}
                  {generatedMessage ? (
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="text-zinc-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[140px] overflow-y-auto pr-2">
                        {generatedMessage}
                      </div>

                      <div className="border-t border-zinc-900 pt-3 mt-3 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Info size={11} className="text-emerald-500" /> {aiNotice}
                        </span>
                        
                        <button
                          onClick={copyToClipboard}
                          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20"
                        >
                          {copiedSuccess ? (
                            <>
                              <Check size={11} className="text-green-400" />
                              COPIADO!
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              COPIAR TEXTO
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-1.5">
                        <MessageSquare size={14} className="text-zinc-600" />
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono">Nenhuma mensagem gerada para este cliente.</p>
                      <p className="text-[9px] text-zinc-650 max-w-sm mt-0.5">Selecione o humor ao lado e dispare o gerador para criar uma mensagem persuasiva via WhatsApp.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* RIGHT COLUMN: MANUAL ADJUSTMENT PANEL & INTELLIGENT ESTIMATOR */}
        <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-6 overflow-y-auto flex-shrink-0">
          
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                Ficha Individual & Alteração Manual
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono">Ajuste e salve devedores sob medida</p>
            </div>
            {currentLoan && (
              <button
                onClick={() => handleDeleteLoan(currentLoan.id)}
                title="Liquidar / Apagar Registro"
                className="p-1.5 bg-red-950/50 hover:bg-red-900 text-red-500 hover:text-white border border-red-905/40 rounded transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {currentLoan ? (
            <div className="space-y-4 flex-1">
              
              {/* Field 1: Name of the borrower */}
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Nome do Cidadão</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <User size={13} />
                  </span>
                  <input
                    id="input-debtor-name"
                    type="text"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors"
                    value={currentLoan.name}
                    onChange={e => updateCurrentLoanField("name", e.target.value)}
                  />
                </div>
              </div>

              {/* Field 2: Home address */}
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Endereço de Cadastro</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 pt-2 items-start pointer-events-none text-zinc-500">
                    <MapPin size={13} />
                  </span>
                  <textarea
                    id="input-debtor-address"
                    rows={2}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors resize-none"
                    value={currentLoan.address}
                    onChange={e => updateCurrentLoanField("address", e.target.value)}
                  />
                </div>
              </div>

              {/* Grid 1: Basic values */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Original Borrowed Amount */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Valor Emprestado (R$)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 font-mono text-[10px]">
                      R$
                    </span>
                    <input
                      id="input-loan-amount"
                      type="number"
                      step="any"
                      min="0"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-2 py-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors"
                      value={currentLoan.amountBorrowed || ""}
                      onChange={e => updateCurrentLoanField("amountBorrowed", Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Interest Rate */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Juros (%)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500 font-mono text-xs">
                      %
                    </span>
                    <input
                      id="input-interest-rate"
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded pl-3 pr-8 py-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors"
                      value={currentLoan.interestRate}
                      onChange={e => updateCurrentLoanField("interestRate", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Field: Type of Interest calculation */}
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Modalidade de Juro Computado</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'SIMPLES_MENSAL', label: 'Simples Mensal' },
                    { id: 'COMPOSTO_MENSAL', label: 'Composto Mensal' },
                    { id: 'SIMPLES_DIARIO', label: 'Simples Diário' },
                    { id: 'FIXO_UNICO', label: 'Fixo único (Fera)' }
                  ] as const).map(option => {
                    const isSelected = currentLoan.interestType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateCurrentLoanField("interestType", option.id)}
                        className={`py-1.5 px-2 text-[10px] font-mono rounded text-left border transition-all ${
                          isSelected 
                            ? "bg-zinc-100 text-zinc-950 border-white font-bold" 
                            : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid 2: Timelines */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Concessão / Loan Date */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Data Concessão</label>
                  <div className="relative">
                    <input
                      id="input-loan-date"
                      type="date"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors"
                      value={currentLoan.loanDate}
                      onChange={e => updateCurrentLoanField("loanDate", e.target.value)}
                    />
                  </div>
                </div>

                {/* Vencimento / Due Date */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Data Vencimento</label>
                  <div className="relative">
                    <input
                      id="input-due-date"
                      type="date"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors"
                      value={currentLoan.dueDate}
                      onChange={e => updateCurrentLoanField("dueDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* STATUS DE QUITAÇÃO (SE A PESSOA PAGOU OU NÃO, OU SÓ OS JUROS) */}
              <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800/80">
                <div className="flex items-center justify-between mb-2.5 pb-1 border-b border-zinc-900">
                  <span className="text-[10px] text-emerald-400 uppercase font-mono tracking-widest font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Status de Quitação / Pagou?
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">Controle rápido de pagamentos</span>
                </div>
                
                <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      updateCurrentLoanField("isSettled", false);
                      updateCurrentLoanField("paidInterestOnly", false);
                      triggerNotification(`Registro de "${currentLoan.name}" definido como pendente em aberto.`, "info");
                    }}
                    className={`py-2 px-1 rounded text-[10px] font-bold uppercase tracking-tight cursor-pointer transition-all border flex flex-col items-center justify-center gap-1 leading-tight ${
                      !currentLoan.isSettled && !currentLoan.paidInterestOnly
                        ? "bg-red-950/45 text-red-500 border-red-900/40 shadow-sm font-black"
                        : "bg-zinc-900/80 text-zinc-500 border-zinc-850 hover:text-zinc-400 hover:border-zinc-805"
                    }`}
                  >
                    <span className="text-xs">❌</span>
                    <span>Em Aberto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      updateCurrentLoanField("isSettled", false);
                      updateCurrentLoanField("paidInterestOnly", true);
                      triggerNotification(`Registro de "${currentLoan.name}" marcado como: Pagou apenas os Juros 💸`, "success");
                    }}
                    className={`py-2 px-1 rounded text-[10px] font-bold uppercase tracking-tight cursor-pointer transition-all border flex flex-col items-center justify-center gap-1 leading-tight ${
                      !currentLoan.isSettled && currentLoan.paidInterestOnly
                        ? "bg-amber-950/50 text-amber-400 border-amber-900/50 shadow-sm font-black"
                        : "bg-zinc-900/80 text-zinc-500 border-zinc-850 hover:text-zinc-400 hover:border-zinc-805"
                    }`}
                  >
                    <span className="text-xs">💸</span>
                    <span>Só Juros</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      updateCurrentLoanField("isSettled", true);
                      updateCurrentLoanField("paidInterestOnly", false);
                      triggerNotification(`Parabéns! Registro de "${currentLoan.name}" marcado como Totalmente Pago 🎉`, "success");
                    }}
                    className={`py-2 px-1 rounded text-[10px] font-bold uppercase tracking-tight cursor-pointer transition-all border flex flex-col items-center justify-center gap-1 leading-tight ${
                      currentLoan.isSettled
                        ? "bg-emerald-950/55 text-emerald-400 border-emerald-900/50 shadow-sm font-black"
                        : "bg-zinc-900/80 text-zinc-500 border-zinc-850 hover:text-zinc-400 hover:border-zinc-805"
                    }`}
                  >
                    <span className="text-xs">✓</span>
                    <span>Quitado</span>
                  </button>
                </div>
                
                <p className="text-[9px] text-zinc-400 font-sans mt-2.5 italic text-left leading-snug">
                  {currentLoan.isSettled 
                    ? "✓ O sistema zerou o saldo devedor e os juros acumulados deste devedor no livro de caixa." 
                    : currentLoan.paidInterestOnly 
                    ? "💸 O devedor quitou apenas a taxa de juros acumulada. O valor principal do empréstimo continua ativo e pendente."
                    : "⚠️ O devedor acumula juros normativos pela modalidade escolhida acima."}
                </p>
              </div>

              {/* VERY IMPORTANT SPACE: ALTERAÇÃO MANUAL (Modificadores Adicionais) */}
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-zinc-900">
                  <span className="text-[10px] text-emerald-500 uppercase font-mono tracking-widest font-bold">
                    Ajustes Manuais
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">Espaço de alterações manuais</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Manual Modifier: Taxas adicionais ou desconto por amizade */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[9px] text-zinc-400 capitalize block">Multas / Acréscimo</label>
                      <span className="text-[8px] text-zinc-650 font-mono">Exp: R$350 visita</span>
                    </div>
                    <input
                      id="input-manual-adjustment"
                      type="number"
                      step="any"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500"
                      value={currentLoan.manualAdjustment || ""}
                      onChange={e => updateCurrentLoanField("manualAdjustment", Number(e.target.value))}
                    />
                  </div>

                  {/* Manual payment tracker: Quanto a pessoa já me pagou */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[9px] text-zinc-400 capitalize block">Valor Pago (PIX/Dinheiro)</label>
                      <span className="text-[8px] text-emerald-600 font-mono">Dedução</span>
                    </div>
                    <input
                      id="input-amount-paid"
                      type="number"
                      step="any"
                      min="0"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500"
                      value={currentLoan.amountPaid || ""}
                      onChange={e => updateCurrentLoanField("amountPaid", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Notes / Promises registry */}
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">
                  Anotações Secretas & Promessas / Desculpas
                </label>
                <textarea
                  id="input-debtor-notes"
                  rows={2}
                  placeholder="Ex: Disse que o tio vai transferir semana que vem... celular desligado..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors"
                  value={currentLoan.notes}
                  onChange={e => updateCurrentLoanField("notes", e.target.value)}
                />
              </div>

              {/* CALCULO DINAMICO AUTOMATICO / RECEBER REPORT */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-4 space-y-2 mt-2">
                <p className="text-[9px] text-zinc-400 uppercase font-mono pb-1 border-b border-zinc-900">
                  Resumo de Cálculo Inteligente
                </p>

                {/* Days elapsed */}
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-zinc-500">Dias Corridos</span>
                  <span className="text-zinc-300 font-mono">
                    {calculateDaysBetween(currentLoan.loanDate, currentDate)} dias 
                    <span className="text-zinc-500 text-[10px] ml-1">
                      ({(calculateDaysBetween(currentLoan.loanDate, currentDate) / 30.416).toFixed(1)} meses)
                    </span>
                  </span>
                </div>

                {/* Subtotal Juros */}
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-zinc-500">Juros Acumulados (Total)</span>
                  <span className="text-zinc-150 font-mono text-amber-500">
                    + R$ {calculateLoanDetails(currentLoan, currentDate).calculatedInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Subtotal Juros Pendentes */}
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-zinc-500 font-medium">Juros Pendentes (A Receber)</span>
                  <span className="text-amber-400 font-mono font-bold">
                    R$ {calculateLoanDetails(currentLoan, currentDate).outstandingInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Manual Adj info */}
                {currentLoan.manualAdjustment !== 0 && (
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-zinc-500">Multas / Acréscimos Extras</span>
                    <span className={`font-mono ${currentLoan.manualAdjustment > 0 ? "text-amber-600" : "text-green-500"}`}>
                      {currentLoan.manualAdjustment > 0 ? "+" : ""} R$ {currentLoan.manualAdjustment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* Deduction amount paid */}
                {currentLoan.amountPaid > 0 && (
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-zinc-500">Montante de Desconto / Pago</span>
                    <span className="text-green-400 font-mono">
                      - R$ {currentLoan.amountPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* Total absolute to pay */}
                <div className="flex justify-between items-baseline border-t border-zinc-900 pt-2 font-bold">
                  <span className="text-xs text-emerald-500 uppercase tracking-widest">
                    Total a Cobrar
                  </span>
                  <span className="text-base font-mono text-emerald-400 tracking-tight">
                    R$ {calculateLoanDetails(currentLoan, currentDate).finalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Bottom control buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    triggerNotification(`Registros de ${currentLoan.name} salvos com sucesso no livro de caixa criptografado.`, "success");
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold uppercase text-[10px] tracking-widest rounded transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  Confirmar Alterações
                </button>
                <button
                  onClick={() => handleDeleteLoan(currentLoan.id)}
                  className="w-full py-2 bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-white border border-red-900/30 hover:border-red-650/50 font-bold uppercase text-[10px] tracking-widest rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={12} className="shrink-0" />
                  Eliminar Cliente / Registro
                </button>
              </div>

            </div>
          ) : (
            <div className="text-center py-16 px-4 text-zinc-500 flex flex-col items-center justify-center h-full">
              <ShieldAlert size={24} className="mb-2 text-zinc-700" />
              <p className="text-xs font-mono">Nenhum devedor ativo selecionado.</p>
              <button 
                onClick={handleAddNewLoan}
                className="mt-4 text-xs font-bold text-center text-emerald-400 font-mono underline hover:text-emerald-300"
              >
                + Registrar novo devedor
              </button>
            </div>
          )}

        </aside>
      </div>

      {/* 3. HARDCODED ENCRYPTED STATUS BOTTOM FOOTER (ANTI-SLOP ARCHITECTURE) */}
      <footer className="h-8 bg-zinc-900 border-t border-zinc-800 flex items-center px-6 justify-between text-[10px] font-mono text-zinc-500 flex-shrink-0">
        <div className="flex gap-4">
          <span>PRIVATE_KEY: ACTIVE</span>
          <span className="hidden sm:inline">AES-256 LEDGER SHARK</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="hidden md:inline">ZINC-950 CANVAS</span>
          <span className="text-emerald-500 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
            SISTEMA ONLINE & SEGURO
          </span>
        </div>
      </footer>

      {/* Custom Confirmation Modal for borrower deletion (bypasses iframe native blocks) */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xs">
          <div className="w-full max-w-md bg-zinc-900 border border-red-900/40 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertTriangle className="shrink-0 animate-bounce" size={24} />
              <h3 className="text-base font-bold font-sans uppercase tracking-wider">Excluir Registro</h3>
            </div>
            
            <p className="text-zinc-300 text-sm mb-5 leading-relaxed">
              Você tem certeza que deseja apagar permanentemente o devedor{" "}
              <span className="text-white underline decoration-red-500 underline-offset-4 font-bold font-sans">
                {loans.find(l => l.id === deleteConfirmId)?.name || "este cliente"}
              </span>{" "}
              do seu caderno eletrônico? Todos os juros, parcelas e histórico serão removidos.
            </p>

            <div className="flex gap-3 justify-end font-mono">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase text-[10px] tracking-widest rounded transition-all cursor-pointer border border-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteLoan}
                className="px-5 py-2 bg-red-900 hover:bg-red-600 text-white font-bold uppercase text-[10px] tracking-widest rounded shadow-lg shadow-red-900/10 transition-all cursor-pointer border border-red-700 hover:border-red-500"
              >
                Sim, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal for borrower creation */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-zinc-950/40 p-5 border-b border-zinc-850">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <Plus size={18} className="shrink-0 animate-pulse" />
                <h3 className="text-sm font-bold font-sans uppercase tracking-widest text-zinc-205">
                  Lançar Novo Empréstimo / Cliente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 rounded transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleConfirmCreateClient} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Left Section: Personal Details */}
                <div className="space-y-4">
                  <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-800 pb-1">
                    Dados do Devedor
                  </h4>
                  
                  {/* Name field */}
                  <div>
                    <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1 block">Nome Completo / Vulgo</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                        <User size={13} />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Ex: João do Gás"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded pl-9 pr-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors"
                        value={newClientName}
                        onChange={e => setNewClientName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Address field */}
                  <div>
                    <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1 block">Endereço / Localização</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 pt-2.5 items-start pointer-events-none text-zinc-500 font-sans">
                        <MapPin size={13} />
                      </span>
                      <textarea
                        rows={2}
                        placeholder="Ex: Av. Central, 50 - Diadema"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded pl-9 pr-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors resize-none"
                        value={newClientAddress}
                        onChange={e => setNewClientAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Notes box */}
                  <div>
                    <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1 block">Instruções de Cobrança / Observações</label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Pegar em dinheiro toda sexta-feira à tarde. Deixou celular de garantia."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-xs text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-750 transition-colors resize-none font-sans"
                      value={newClientNotes}
                      onChange={e => setNewClientNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Right Section: Loan Rules */}
                <div className="space-y-4">
                  <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-800 pb-1">
                    Condições do Empréstimo
                  </h4>

                  {/* Amount / Rate Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1 block font-mono">Principal (R$)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 font-mono text-[10px]">
                          R$
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="1"
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-2 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-700 transition-colors"
                          value={newClientAmount}
                          onChange={e => setNewClientAmount(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1 block font-mono font-sans">Taxa de Juros (%)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 font-mono text-[10px]">
                          %
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded pl-3 pr-8 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-750 transition-colors"
                          value={newClientRate}
                          onChange={e => setNewClientRate(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Interest Type Choice */}
                  <div>
                    <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1.5 block">Regime de Capitalização</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "SIMPLES_MENSAL", label: "Simples Mensal" },
                        { id: "COMPOSTO_MENSAL", label: "Composto Mensal" },
                        { id: "SIMPLES_DIARIO", label: "Simples Diário" },
                        { id: "FIXO_UNICO", label: "Taxa Fixa Única" }
                      ].map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setNewClientType(option.id as InterestType)}
                          className={`text-left p-2.5 rounded border text-[10px] font-mono leading-tight tracking-tight transition-all cursor-pointer ${
                            newClientType === option.id 
                              ? "bg-zinc-850 text-emerald-400 border-emerald-500/80 shadow-inner" 
                              : "bg-zinc-950/60 text-zinc-450 border-zinc-850 hover:border-zinc-800 hover:text-zinc-300"
                          }`}
                        >
                          <p className="font-bold text-zinc-200">{option.label}</p>
                          <p className="text-[8px] text-zinc-500 mt-0.5">
                            {option.id === "SIMPLES_MENSAL" && "Juros simples por mês corrido"}
                            {option.id === "COMPOSTO_MENSAL" && "Juros sobre juros por mês"}
                            {option.id === "SIMPLES_DIARIO" && "Juros simples ao dia"}
                            {option.id === "FIXO_UNICO" && "Valor estático sem prazo"}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dates: Start & Due Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1 block font-mono">Concessão</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
                          <Calendar size={12} />
                        </span>
                        <input
                          type="date"
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-750 transition-colors"
                          value={newClientLoanDate}
                          onChange={e => setNewClientLoanDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1 block font-mono">Vencimento</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
                          <Calendar size={12} />
                        </span>
                        <input
                          type="date"
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-emerald-500 hover:border-zinc-750 transition-colors"
                          value={newClientDueDate}
                          onChange={e => setNewClientDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Initial Status of Loan */}
                  <div>
                    <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mb-1.5 block">Situação Inicial do Registro</label>
                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          setNewClientIsSettled(false);
                          setNewClientPaidInterestOnly(false);
                        }}
                        className={`py-1.5 px-1 rounded text-[9px] font-bold uppercase cursor-pointer transition-all border flex flex-col items-center justify-center gap-1 leading-tight ${
                          !newClientIsSettled && !newClientPaidInterestOnly
                            ? "bg-red-950/45 text-red-500 border-red-900/40 font-black font-sans"
                            : "bg-zinc-950 text-zinc-500 border-zinc-855 hover:text-zinc-400"
                        }`}
                      >
                        <span>❌ Aberto</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewClientIsSettled(false);
                          setNewClientPaidInterestOnly(true);
                        }}
                        className={`py-1.5 px-1 rounded text-[9px] font-bold uppercase cursor-pointer transition-all border flex flex-col items-center justify-center gap-1 leading-tight ${
                          !newClientIsSettled && newClientPaidInterestOnly
                            ? "bg-amber-950/50 text-amber-400 border-amber-900/50 font-black font-sans"
                            : "bg-zinc-950 text-zinc-500 border-zinc-855 hover:text-zinc-400"
                        }`}
                      >
                        <span>💸 Só Juros</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewClientIsSettled(true);
                          setNewClientPaidInterestOnly(false);
                        }}
                        className={`py-1.5 px-1 rounded text-[9px] font-bold uppercase cursor-pointer transition-all border flex flex-col items-center justify-center gap-1 leading-tight ${
                          newClientIsSettled
                            ? "bg-emerald-950/55 text-emerald-400 border-emerald-900/50 font-black font-sans"
                            : "bg-zinc-950 text-zinc-500 border-zinc-855 hover:text-zinc-400"
                        }`}
                      >
                        <span>✓ Quitado</span>
                      </button>
                    </div>
                  </div>

                </div>

              </div>

              {/* Modal Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-zinc-850 mt-6 font-mono">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase text-[10px] tracking-widest rounded transition-all cursor-pointer border border-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold uppercase text-[10px] tracking-widest rounded shadow-lg shadow-emerald-500/10 transition-all cursor-pointer border border-emerald-500 hover:border-emerald-400"
                >
                  Confirmar e Lançar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
