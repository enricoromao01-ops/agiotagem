-- =====================================================================
-- SISTEMA DE AGIOTA - BLUEPRINT BANCO DE DADOS (SQL)
-- Compatível com PostgreSQL, MySQL e SQLite
-- =====================================================================

-- 1. Criação da tabela de empréstimos (Ledger principal)
CREATE TABLE IF NOT EXISTS loans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    amount_borrowed DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    interest_type VARCHAR(50) NOT NULL DEFAULT 'SIMPLES_MENSAL', 
    -- Tipos: 'SIMPLES_MENSAL', 'COMPOSTO_MENSAL', 'SIMPLES_DIARIO', 'FIXO_UNICO'
    loan_date DATE NOT NULL,
    due_date DATE NOT NULL,
    manual_adjustment DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- Multas, taxas ou descontos manuais
    amount_paid DECIMAL(15, 2) NOT NULL DEFAULT 0.00,       -- Abatimentos recebidos por PIX/Dinheiro
    notes TEXT,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,              -- Marcar se foi totalmente quitado
    paid_interest_only BOOLEAN NOT NULL DEFAULT FALSE,      -- Marcar se pagou apenas os juros
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Inserção de dados simulados (Seed Data) idênticos aos do caderno eletrônico
INSERT INTO loans (id, name, address, amount_borrowed, interest_rate, interest_type, loan_date, due_date, manual_adjustment, amount_paid, notes, is_settled, paid_interest_only)
VALUES 
('1', 'Marcão da Borracharia', 'Av. Brasil, 1940, Galpão B, São Paulo - SP', 5000.00, 20.00, 'SIMPLES_MENSAL', '2026-04-10', '2026-05-15', 350.00, 1500.00, 'Marcão já pagou R$ 1500 mas sumiu na última semana. Disse que o genro ia fazer PIX.', FALSE, FALSE),
('2', 'Dona Creusa do Pastel', 'Rua das Palmeiras, 102, Próximo à Feira Municipal', 1500.00, 15.00, 'SIMPLES_MENSAL', '2026-05-02', '2026-06-02', 0.00, 0.00, 'Dona Creusa é pontual, excelente cliente. Paga em dinheiro vivo ou Pix de pastelaria.', FALSE, FALSE),
('3', 'Cleiton ''Rebaixados'' Lima', 'Rua do Arrastão, 45, Beco 3, Diadema - SP', 3000.00, 10.00, 'SIMPLES_DIARIO', '2026-05-15', '2026-05-20', 150.00, 0.00, 'Cleiton do som automotivo. Já está atrasado há vários dias. Atitude suspeita.', FALSE, FALSE),
('4', 'Paula da Odonto', 'Condomínio Golden Hills, Torre Sul, Apto 1403', 20000.00, 25.00, 'FIXO_UNICO', '2026-03-01', '2026-05-01', -1000.00, 19000.00, 'Acertou quase tudo, falta pouco. Super rica, mas chora desconto.', FALSE, FALSE);


-- 3. Query Inteligente para calcular juros acumulados, quota por período e total devido hoje
-- Esta query calcula a data atual de forma dinâmica (usando CURRENT_DATE)
-- Para testar no SQLite, use 'julianday(CURRENT_DATE) - julianday(loan_date)' para calcular dias corridos.
-- Exemplo abaixo escrito em dialeto PostgreSQL padrão:

SELECT 
    id,
    name,
    amount_borrowed AS principal,
    interest_rate,
    interest_type,
    loan_date,
    due_date,
    is_settled,
    paid_interest_only,
    
    -- 1. Dias corridos desde a concessão
    (CURRENT_DATE - loan_date) AS elapsed_days,
    
    -- 2. Meses corridos correspondentes
    ROUND((CURRENT_DATE - loan_date) / 30.416, 2) AS elapsed_months,
    
    -- 3. Cálculo dinâmico do juro bruto dependendo da modalidade e status de juros pagos
    ROUND(
        CASE 
            WHEN is_settled = TRUE OR paid_interest_only = TRUE THEN 0.00
            WHEN interest_type = 'SIMPLES_MENSAL' THEN 
                amount_borrowed * (interest_rate / 100.0) * ((CURRENT_DATE - loan_date) / 30.416)
            WHEN interest_type = 'COMPOSTO_MENSAL' THEN 
                amount_borrowed * (POWER(1.0 + (interest_rate / 100.0), (CURRENT_DATE - loan_date) / 30.416) - 1.0)
            WHEN interest_type = 'SIMPLES_DIARIO' THEN 
                amount_borrowed * (interest_rate / 100.0) * (CURRENT_DATE - loan_date)
            WHEN interest_type = 'FIXO_UNICO' THEN 
                amount_borrowed * (interest_rate / 100.0)
            ELSE 0.00
        END, 2
    ) AS calculated_interest,

    -- 4. Valor bruto da quota periódica individual (Só os juros por período contratado)
    ROUND(
        CASE 
            WHEN is_settled = TRUE OR paid_interest_only = TRUE THEN 0.00
            WHEN interest_type = 'SIMPLES_DIARIO' THEN amount_borrowed * (interest_rate / 100.0)
            ELSE amount_borrowed * (interest_rate / 100.0)
        END, 2
    ) AS period_interest_only,

    -- 5. Lançamentos adicionais e abatimentos já pagos
    manual_adjustment,
    amount_paid,

    -- 6. Total absoluto que o cliente deve pagar hoje para quitar a dívida (Zera se quitado)
    ROUND(
        CASE 
            WHEN is_settled = TRUE THEN 0.00
            ELSE GREATEST(0, 
                amount_borrowed + 
                CASE 
                    WHEN paid_interest_only = TRUE THEN 0.00
                    WHEN interest_type = 'SIMPLES_MENSAL' THEN 
                        amount_borrowed * (interest_rate / 100.0) * ((CURRENT_DATE - loan_date) / 30.416)
                    WHEN interest_type = 'COMPOSTO_MENSAL' THEN 
                        amount_borrowed * (POWER(1.0 + (interest_rate / 100.0), (CURRENT_DATE - loan_date) / 30.416) - 1.0)
                    WHEN interest_type = 'SIMPLES_DIARIO' THEN 
                        amount_borrowed * (interest_rate / 100.0) * (CURRENT_DATE - loan_date)
                    WHEN interest_type = 'FIXO_UNICO' THEN 
                        amount_borrowed * (interest_rate / 100.0)
                    ELSE 0.00
                END + manual_adjustment - amount_paid
            )
        END, 2
    ) AS final_debt_today

FROM loans;
