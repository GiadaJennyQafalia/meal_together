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
        // Basic abuse guards for the shared-access chat endpoint (no login in app).
        // Reject cross-origin callers and cap payload size to prevent runaway AI cost.
        const origin = request.headers.get("origin") ?? "";
        const referer = request.headers.get("referer") ?? "";
        const host = request.headers.get("host") ?? "";
        const allowedHosts = [host, "meal-together-easy.lovable.app"];
        const sameOrigin =
          !origin ||
          allowedHosts.some(
            (h) => origin.endsWith(h) || referer.includes(h),
          );
        if (!sameOrigin) {
          return new Response("Forbidden", { status: 403 });
        }

        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 50_000) {
          return new Response("Payload too large", { status: 413 });
        }

        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }
        if (messages.length > 100) {
          return new Response("Too many messages", { status: 413 });
        }
        // Cap individual message text length.
        for (const m of messages as UIMessage[]) {
          const text = extractText(m);
          if (text.length > 4000) {
            return new Response("Message too long", { status: 413 });
          }
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