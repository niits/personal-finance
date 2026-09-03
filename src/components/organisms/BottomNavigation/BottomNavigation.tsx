import Link from "next/link";

export type NavigationDestination = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
};

export function BottomNavigation({
  destinations,
}: {
  destinations: NavigationDestination[];
}) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-canvas pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex min-h-[72px] max-w-[720px] items-stretch">
        {destinations.map((destination) => (
          <Link
            key={destination.href}
            href={destination.href}
            aria-current={destination.active ? "page" : undefined}
            className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-xxs px-xxs py-xs no-underline transition-colors ${
              destination.active
                ? "font-semibold text-primary after:absolute after:top-0 after:h-xxs after:w-xl after:rounded-pill after:bg-primary"
                : "font-normal text-ink-muted-48"
            }`}
          >
            <span aria-hidden="true" className="flex size-lg items-center justify-center">
              {destination.icon}
            </span>
            <span className="font-body text-xs leading-none">{destination.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
