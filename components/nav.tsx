"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/actions/auth";

const links = [
  { href: "/", label: "Today" },
  { href: "/activities", label: "Activities" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-xl italic tracking-tight text-ink">
          Routine
        </Link>

        <nav className="flex items-center gap-6">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm pb-1 border-b transition-colors",
                  active
                    ? "border-moss text-ink"
                    : "border-transparent text-ink-soft hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            );
          })}

          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-ink-soft hover:text-rust transition-colors"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
