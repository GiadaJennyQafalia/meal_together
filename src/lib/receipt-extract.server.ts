import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type ExtractedProduct = {
  nome: string;
  quantita: number | null;
  unita: string | null;
  categoria: "fresco" | "surgelato" | "secco" | "latticino" | "altro" | null;
};

const PROMPT = `Sei un estrattore di prodotti da scontrini della spesa italiani.
Analizza l'immagine dello scontrino e restituisci SOLO un array JSON valido, senza testo prima o dopo, senza markdown.

Per ogni riga-prodotto vera (non totali, sconti, resto, IVA, intestazione supermercato) restituisci un oggetto:
{
  "nome": string,          // nome pulito e leggibile del prodotto (senza codici, senza sigle EAN)
  "quantita": number|null, // quantità stimata (es. 1, 2, 0.5). null se non desumibile.
  "unita": string|null,    // es. "pz", "kg", "g", "l", "ml", "confezione". null se non desumibile.
  "categoria": "fresco"|"surgelato"|"secco"|"latticino"|"altro"
}

Regole:
- Ignora righe che non sono prodotti (totale, subtotale, sconto, contanti, resto, IVA, data, cassa).
- Se lo scontrino è illeggibile o non contiene prodotti, restituisci [].
- Rispondi con SOLO il JSON array, niente altro.`;

function parseJsonArray(raw: string): unknown[] {
  const trimmed = raw.trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { prodotti?: unknown[] }).prodotti)) {
      return (parsed as { prodotti: unknown[] }).prodotti;
    }
    return [];
  } catch {
    // Prova a estrarre il primo array JSON grezzo.
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const arr = JSON.parse(match[0]);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
}

function normalizeProduct(raw: unknown): ExtractedProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const nome = typeof r.nome === "string" ? r.nome.trim() : "";
  if (!nome) return null;
  const quantita =
    typeof r.quantita === "number" && Number.isFinite(r.quantita) ? r.quantita : null;
  const unita = typeof r.unita === "string" && r.unita.trim() ? r.unita.trim() : null;
  const catRaw = typeof r.categoria === "string" ? r.categoria.toLowerCase().trim() : "";
  const categoria =
    catRaw === "fresco" ||
    catRaw === "surgelato" ||
    catRaw === "secco" ||
    catRaw === "latticino" ||
    catRaw === "altro"
      ? (catRaw as ExtractedProduct["categoria"])
      : "altro";
  return { nome, quantita, unita, categoria };
}

/**
 * Estrattore prodotti da scontrino, riusabile.
 * Passa un URL raggiungibile dal modello (es. signed URL Supabase) o un data URL base64.
 */
export async function extractProductsFromReceipt(input: {
  imageUrl: string;
  model?: string;
}): Promise<ExtractedProduct[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway(input.model ?? "google/gemini-3.6-flash");

  const result = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image", image: new URL(input.imageUrl) },
        ],
      },
    ],
  });

  const arr = parseJsonArray(result.text ?? "");
  const out: ExtractedProduct[] = [];
  for (const item of arr) {
    const norm = normalizeProduct(item);
    if (norm) out.push(norm);
  }
  return out;
}