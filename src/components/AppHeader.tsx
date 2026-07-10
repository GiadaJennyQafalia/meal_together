import { Link } from "@tanstack/react-router";

export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 flex-col leading-tight">
          <span className="font-serif text-lg font-medium text-foreground">
            {title}
          </span>
          {subtitle ? (
            <span className="truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </Link>
        {right}
      </div>
    </header>
  );
}