import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-gradient-to-r from-sky-50 via-indigo-50 to-purple-50 p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          GitHub Contribution Matchmaker
        </h1>
        <p className="max-w-3xl text-base leading-7 text-gray-700">
          Find GitHub issues you can actually contribute to based on your
          skills, interests, and preferred tech stack.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-gray-900">How this is different from your usual GitHub search</h2>
        <p className="mt-2 text-sm leading-6 text-gray-700">
          GitHub search helps you find issues. This app helps you pick issues you are more likely to finish successfully.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Personalized matching</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Uses your skill level, preferred languages, areas, and issue size to rank candidates.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Transparent scoring</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Every recommendation includes score details so you can see exactly why it was suggested.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Beginner-focused filtering</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Helps surface active, understandable issues instead of noisy raw search results.
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/onboarding"
        className="inline-block rounded-md bg-black px-6 py-4 text-lg font-semibold text-white transition hover:bg-gray-800"
      >
        Get Started
      </Link>

    </section>
  );
}