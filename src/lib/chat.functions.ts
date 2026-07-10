import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";

function server() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const loadChatHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<UIMessage[]> => {
    const sb = server();
    const { data, error } = await sb
      .from("chat_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: String(row.id),
      role: row.role as UIMessage["role"],
      parts: [{ type: "text", text: row.content }],
    }));
  },
);

export const clearChatHistory = createServerFn({ method: "POST" }).handler(
  async () => {
    const sb = server();
    const { error } = await sb.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
    return { ok: true };
  },
);