import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildSystemPrompt } from "@/lib/system-prompt.server";

type ChatRequestBody = { messages?: unknown };

function extractText(message: UIMessage): string {
  return (message.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: ricette } = await supabase.from("ricette").select("*");
        const system = buildSystemPrompt(ricette ?? []);

        const uiMessages = messages as UIMessage[];
        // Persist the last user message (idempotent-ish: only latest one).
        const last = uiMessages[uiMessages.length - 1];
        if (last?.role === "user") {
          const content = extractText(last);
          if (content) {
            await supabase.from("chat_messages").insert({ role: "user", content });
          }
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          messages: await convertToModelMessages(uiMessages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            const content = extractText(responseMessage);
            if (content) {
              await supabase
                .from("chat_messages")
                .insert({ role: "assistant", content });
            }
          },
        });
      },
    },
  },
});