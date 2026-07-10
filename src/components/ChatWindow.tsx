import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { StoredMessage } from "@/lib/chat.functions";

function toUiMessages(stored: StoredMessage[]): UIMessage[] {
  return stored.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
  })) as UIMessage[];
}

export function ChatWindow({ initial }: { initial: StoredMessage[] }) {
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    messages: toUiMessages(initial),
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err) => toast.error(err.message ?? "Errore nella chat"),
  });

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const busy = status === "submitted" || status === "streaming";

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setInput("");
    await sendMessage({ text: trimmed });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-6"
      >
        {empty ? <EmptyState /> : null}
        <ul className="mx-auto flex max-w-xl flex-col gap-4">
          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            return <MessageBubble key={m.id} role={m.role} text={text} />;
          })}
          {status === "submitted" ? (
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Sto pensando…</span>
            </li>
          ) : null}
          {error ? (
            <li className="rounded-md bg-destructive/20 px-3 py-2 text-sm text-destructive-foreground">
              {error.message}
            </li>
          ) : null}
        </ul>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border/60 bg-background/80 px-3 py-3 backdrop-blur"
      >
        <div className="mx-auto flex max-w-xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            rows={1}
            placeholder="Scrivi al Quaderno…  (es. 'pianifichiamo la settimana')"
            className="min-h-11 max-h-40 flex-1 resize-none rounded-2xl border border-border/50 bg-paper px-4 py-2.5 text-sm text-paper-foreground placeholder:text-paper-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !input.trim()}
            className="h-11 w-11 shrink-0 rounded-full"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ role, text }: { role: string; text: string }) {
  if (role === "user") {
    return (
      <li className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {text}
        </div>
      </li>
    );
  }
  return (
    <li className="flex">
      <div className="prose prose-sm prose-invert max-w-none text-[15px] leading-relaxed text-foreground">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-xl pb-6 text-center">
      <p className="font-serif text-2xl leading-tight text-foreground">
        Il Quaderno
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        L'assistente di pianificazione settimanale di Giada &amp; Francesco.
        <br />
        Comincia chiedendo <em>"pianifichiamo la settimana"</em> o
        raccontando cosa c'è da consumare.
      </p>
    </div>
  );
}