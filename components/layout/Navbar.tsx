import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          GitHub Contribution Matchmaker
        </Link>

        <nav className="flex gap-4 text-sm">
          <Link href="/onboarding">Onboarding</Link>
          <Link href="/discover">Discover</Link>
        </nav>
      </div>
    </header>
  );
}