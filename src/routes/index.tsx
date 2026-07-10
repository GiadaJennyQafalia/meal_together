import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ChatWindow } from "@/components/ChatWindow";
import { loadChatHistory, type StoredMessage } from "@/lib/chat.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const load = useServerFn(loadChatHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["chat", "history"],
    queryFn: () => load(),
  });

  const initial: StoredMessage[] = data ?? [];

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <AppHeader
        title="Il Quaderno"
        subtitle="Pianificazione pasti · Giada & Francesco"
      />
      <div className="flex-1 min-h-0 pb-16">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Apro il quaderno…
          </div>
        ) : (
          <ChatWindow initial={initial} />
        )}
      </div>
      <BottomNav />
    </div>
  );
}
