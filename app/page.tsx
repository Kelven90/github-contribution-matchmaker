import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">
          GitHub Contribution Matchmaker
        </h1>
        <p className="text-gray-600">
          Find GitHub issues you can actually contribute to based on your
          skills, interests, and preferred tech stack.
        </p>
      </div>

      <Link
        href="/onboarding"
        className="inline-block rounded-md bg-black px-4 py-2 text-white"
      >
        Get Started
      </Link>
    </section>
  );
}