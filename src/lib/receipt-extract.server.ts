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

// --- Estrazione PREZZI da scontrino (riusabile per prezzi_prodotti / spese) ---

export type ExtractedPriceRow = {
  nome: string;
  quantita: number;
  prezzo: number;
  unita: string | null;
};

export type ExtractedReceiptPrices = {
  supermercato: string;
  data: string | null;
  totale: number | null;
  prodotti: ExtractedPriceRow[];
};

const PRICE_PROMPT = `Sei un estrattore di prezzi da scontrini della spesa italiani.
Analizza l'immagine dello scontrino e restituisci SOLO un oggetto JSON valido, senza testo prima o dopo, senza markdown:

{
  "supermercato": string|null, // dedotto dall'intestazione: "Lidl", "Aldi", "Eurospar", "dm" oppure "altro"
  "data": string|null,         // formato YYYY-MM-DD se leggibile, altrimenti null
  "totale": number|null,       // totale dello scontrino se leggibile
  "prodotti": [
    { "nome": string, "quantita": number, "prezzo_totale_riga": number, "unita": string|null }
  ]
}

Regole:
- Ignora righe che non sono prodotti (totale, subtotale, sconto, contanti, resto, IVA, data, cassa).
- "quantita" e' il numero di unita'/pezzi/kg acquistati su quella riga (es. se lo scontrino mostra "3x" o "3 PZ" metti 3). Se non specificato, metti 1. NON calcolare divisioni: restituisci solo il numero letto o dedotto dallo scontrino.
- "prezzo_totale_riga" e' l'importo TOTALE pagato per quella riga cosi' come stampato sullo scontrino (es. se "3x Mele" costano in totale 3,60€, metti 3.60, non il prezzo di una singola mela). Numero con punto decimale.
- "unita" es. "€/pezzo", "€/kg", "€/l"; null se non desumibile.
- Nome pulito e leggibile, senza codici o sigle EAN.
- Se lo scontrino e' illeggibile restituisci {"supermercato":null,"data":null,"totale":null,"prodotti":[]}.
- Rispondi con SOLO il JSON, niente altro.`;

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallback: primo oggetto JSON grezzo
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const SUPERMERCATI_NOTI = ["Lidl", "Aldi", "Eurospar", "dm"] as const;

function normalizeSupermercato(raw: unknown): string {
  if (typeof raw !== "string") return "altro";
  const v = raw.trim().toLowerCase();
  const hit = SUPERMERCATI_NOTI.find((s) => v.includes(s.toLowerCase()));
  return hit ?? "altro";
}

function normalizePriceRow(raw: unknown): ExtractedPriceRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const nome = typeof r.nome === "string" ? r.nome.trim() : "";
  if (!nome) return null;

  const totaleRigaNum =
    typeof r.prezzo_totale_riga === "number"
      ? r.prezzo_totale_riga
      : typeof r.prezzo_totale_riga === "string"
        ? Number(r.prezzo_totale_riga.replace(",", "."))
        : // fallback: se il modello ha comunque risposto con il vecchio campo "prezzo"
          typeof r.prezzo === "number"
          ? r.prezzo
          : typeof r.prezzo === "string"
            ? Number(r.prezzo.replace(",", "."))
            : NaN;
  if (!Number.isFinite(totaleRigaNum) || totaleRigaNum < 0) return null;

  const quantitaNum =
    typeof r.quantita === "number" && Number.isFinite(r.quantita) && r.quantita > 0
      ? r.quantita
      : typeof r.quantita === "string" && Number(r.quantita.replace(",", ".")) > 0
        ? Number(r.quantita.replace(",", "."))
        : 1;

  const unita = typeof r.unita === "string" && r.unita.trim() ? r.unita.trim() : null;

  // Prezzo per-unita' calcolato deterministicamente in codice (non fidarsi della matematica del modello).
  const prezzoUnitario = Math.round((totaleRigaNum / quantitaNum) * 100) / 100;

  return { nome, quantita: quantitaNum, prezzo: prezzoUnitario, unita };
}

/**
 * Estrae supermercato, data, totale e i prezzi riga per riga da uno scontrino.
 * Riusabile ovunque serva popolare prezzi_prodotti / spese_scontrino.
 */
export async function extractPricesFromReceipt(input: {
  imageUrl: string;
  model?: string;
}): Promise<ExtractedReceiptPrices> {
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
          { type: "text", text: PRICE_PROMPT },
          { type: "image", image: new URL(input.imageUrl) },
        ],
      },
    ],
  });

  const obj = parseJsonObject(result.text ?? "");
  if (!obj) return { supermercato: "altro", data: null, totale: null, prodotti: [] };

  const dataRaw = typeof obj.data === "string" ? obj.data.trim() : "";
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataRaw) ? dataRaw : null;
  const totaleNum =
    typeof obj.totale === "number"
      ? obj.totale
      : typeof obj.totale === "string"
        ? Number(obj.totale.replace(",", "."))
        : NaN;

  const prodotti: ExtractedPriceRow[] = [];
  const list = Array.isArray(obj.prodotti) ? obj.prodotti : [];
  for (const item of list) {
    const row = normalizePriceRow(item);
    if (row) prodotti.push(row);
  }

  return {
    supermercato: normalizeSupermercato(obj.supermercato),
    data,
    totale: Number.isFinite(totaleNum) ? Math.round(totaleNum * 100) / 100 : null,
    prodotti,
  };
}
