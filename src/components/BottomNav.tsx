import { Link } from "@tanstack/react-router";
import { MessageCircle, BookOpen, ShoppingBasket, Tag } from "lucide-react";

const items = [
  { to: "/", label: "Chat", icon: MessageCircle },
  { to: "/ricette", label: "Ricette", icon: BookOpen },
  { to: "/spesa", label: "Spesa", icon: ShoppingBasket },
  { to: "/prezzi", label: "Prezzi", icon: Tag },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="group flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground transition-colors data-[status=active]:text-primary"
              activeProps={{ "data-status": "active" } as never}
            >
              <Icon className="h-5 w-5 transition-transform group-data-[status=active]:scale-110" />
              <span className="uppercase">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}