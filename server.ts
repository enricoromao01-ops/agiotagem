import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse incoming JSON bodies
  app.use(express.json());

  // API Route to generate debt reminder messages using Gemini AI
  app.post("/api/generate-reminder", async (req, res) => {
    try {
      const { name, amount, interest, totalDebt, dueDate, loanDate, address, tone, notes } = req.body;

      if (!name) {
        return res.status(400).json({ error: "O nome da pessoa é obrigatório para gerar o lembrete." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        // Fallback response for offline / missing key situations
        const offlineFallbacks: Record<string, string> = {
          amistoso: `Olá, ${name}! Tudo bem? Estou passando para lembrar do nosso acerto de R$ ${Number(totalDebt).toFixed(2)} que vence em ${dueDate ? new Date(dueDate).toLocaleDateString() : 'breve'}. Qualquer dúvida me avisa! Abraço.`,
          firme: `Olá, ${name}. Notei que o valor de R$ ${Number(totalDebt).toFixed(2)} (Empréstimo original: R$ ${Number(amount).toFixed(2)} + juros de ${interest}%) está em aberto. Precisamos fechar essa conta até o dia ${dueDate ? new Date(dueDate).toLocaleDateString() : 'combinado'}. Aguardo o retorno.`,
          severo: `Atenção, ${name}. O prazo do seu acerto de R$ ${Number(totalDebt).toFixed(2)} expirou ou está esgotando. Você sabe como funcionam as regras. Evite problemas e faça o Pix ou me encontre no endereço de cadastro (${address || "não informado"}). Responda imediatamente.`,
          chefao: `Caro ${name}, o 'Chefe' revisou o caderno e viu seu nome na lista vermelha por R$ ${Number(totalDebt).toFixed(2)}. Não faça o padrinho perder a paciência. Vamos resolver isso hoje ainda. Evite visitas surpresa.`,
        };

        const chosenTone = (tone || "amistoso").toLowerCase();
        const msg = offlineFallbacks[chosenTone] || offlineFallbacks.amistoso;

        return res.json({
          message: msg,
          isOfflineFallback: true,
          notice: "Chave do Gemini não configurada! Exibindo rascunho offline padrão."
        });
      }

      // Initialize GoogleGenAI SDK cleanly with named parameter
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Construct a tailored and immersive prompt for the loan shark tone generator in Portuguese
      const prompt = `Você é um assessor de cobrança de um agiota amigável, porém extremamente persuasivo e astuto.
Gere uma mensagem personalizada de cobrança em português (BR) para um devedor.
Aqui estão as informações do devedor:
- Nome do devedor: ${name}
- Valor emprestado inicialmente: R$ ${Number(amount || 0).toFixed(2)}
- Taxa de juros: ${interest}%
- Data da concessão: ${loanDate || "Não especificada"}
- Data de vencimento combinada: ${dueDate || "Não especificada"}
- Endereço cadastrado: ${address || "Não informado"}
- Total acumulado que ele deve pagar hoje (calculado com juros): R$ ${Number(totalDebt || 0).toFixed(2)}
- Notas adicionais registradas: ${notes || "Nenhuma"}

O tom da mensagem deve ser exatamente: "${tone || "firme"}".
Tipos de tom esperados:
1. "amistoso" -> Mensagem leve, educada, com tom de amizade, mas deixando claro que o dinheiro precisa ser pago.
2. "firme" -> Profissional, direta, sem meias palavras, ressaltando o compromisso financeiro e o prazo.
3. "severo" -> Intimidadora de leve, de agiota tradicional (humorístico/fictício, porém impondo respeito), lembrando que sabemos onde ele mora (${address || 'no endereço dele'}) e que o prazo estourou. Foco dramático em "regras da rua".
4. "chefao" -> Estilo "O Padrinho" (Don Corleone), muito elegante, com metáforas mafiosas, respeito mútuo e avisando que o 'Chefe' quer ver as contas fechadas.

Retorne APENAS o texto da mensagem formatada para WhatsApp conveniente para copiar e colar. Não adicione cabeçalhos, metadados ou explicações. Use quebras de linha e emojis inteligentes.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 1.0,
        }
      });

      const messageContent = response.text?.trim() || "Erro ao formatar mensagem. Tente novamente.";
      return res.json({ message: messageContent, isOfflineFallback: false });

    } catch (error: any) {
      console.error("Gemini API Error in /api/generate-reminder:", error);
      return res.status(500).json({ error: "Erro interno do servidor ao gerar lembrete de cobrança." });
    }
  });

  // Vite integration middleware for development, serving static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Sistema de Agiota Backend] Ativo na porta ${PORT}`);
  });
}

startServer();
