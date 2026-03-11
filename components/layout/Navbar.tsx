import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
          GitHub Contribution Matchmaker
        </Link>

        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link href="/onboarding" className="rounded-md px-3 py-1.5 text-gray-700 transition hover:bg-gray-100 hover:text-gray-900">
            Onboarding
          </Link>
          <Link href="/discover" className="rounded-md px-3 py-1.5 text-gray-700 transition hover:bg-gray-100 hover:text-gray-900">
            Discover
          </Link>
        </nav>
      </div>
    </header>
  );
}