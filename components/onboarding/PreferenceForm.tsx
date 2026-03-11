"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { CONTRIBUTION_TYPE_OPTIONS } from "@/lib/constants/contributionTypes";
import SimpleModal from "@/components/ui/SimpleModal";

export default function PreferenceForm() {
  const router = useRouter();

  const [skillLevel, setSkillLevel] = useState("beginner");
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>([]);
  const [preferredAreas, setPreferredAreas] = useState<string[]>([]);
  const [customLanguage, setCustomLanguage] = useState("");
  const [customArea, setCustomArea] = useState("");
  const [preferredIssueSize, setPreferredIssueSize] = useState("small");
  const [activeReposOnly, setActiveReposOnly] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSkillInfoOpen, setIsSkillInfoOpen] = useState(false);
  const [isIssueSizeInfoOpen, setIsIssueSizeInfoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingPreferences() {
      try {
        const response = await fetch("/api/preferences");
        if (!response.ok) return;

        const data = (await response.json()) as {
          skillLevel?: string;
          preferredLanguages?: string[];
          preferredAreas?: string[];
          preferredIssueSize?: string;
          activeReposOnly?: boolean;
        } | null;

        if (!data || cancelled) return;

        if (data.skillLevel) setSkillLevel(data.skillLevel);
        if (Array.isArray(data.preferredLanguages) && data.preferredLanguages.length > 0) {
          setPreferredLanguages(data.preferredLanguages);
        }
        if (Array.isArray(data.preferredAreas) && data.preferredAreas.length > 0) {
          setPreferredAreas(data.preferredAreas);
        }
        if (data.preferredIssueSize) setPreferredIssueSize(data.preferredIssueSize);
        if (typeof data.activeReposOnly === "boolean") setActiveReposOnly(data.activeReposOnly);
      } catch {
        // Keep defaults if preferences cannot be loaded.
      }
    }

    loadExistingPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLanguage = (language: string) => {
    setPreferredLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((item) => item !== language)
        : [...prev, language]
    );
  };

  const toggleArea = (area: string) => {
    setPreferredAreas((prev) =>
      prev.includes(area)
        ? prev.filter((item) => item !== area)
        : [...prev, area]
    );
  };

  const addCustomLanguage = () => {
    const normalized = customLanguage.trim();
    if (!normalized) return;

    setPreferredLanguages((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setCustomLanguage("");
  };

  const addCustomArea = () => {
    const normalized = customArea.trim().toLowerCase();
    if (!normalized) return;

    setPreferredAreas((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setCustomArea("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      skillLevel,
      preferredLanguages,
      preferredAreas,
      preferredIssueSize,
      activeReposOnly,
    };

    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      alert("Failed to save preferences");
      return;
    }

    router.push("/discover");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-sky-50 to-purple-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Quick Guide</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">Want to understand how matching and scoring work?</p>
            <p className="mt-1 text-xs text-gray-600">
              See how preferences, scoring signals, and ranking combine before you save your setup.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="shrink-0 rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            How Matching Works
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-semibold uppercase tracking-wide text-slate-700">Skill Level</label>
          <button
            type="button"
            onClick={() => setIsSkillInfoOpen(true)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold leading-none text-gray-700 hover:bg-gray-50"
            aria-label="How skill level is applied"
            title="How skill level is applied"
          >
            i
          </button>
        </div>
        <select
          value={skillLevel}
          onChange={(e) => setSkillLevel(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
        </select>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">Preferred Languages</p>
        <p className="text-xs text-gray-600">GitHub supports many languages. Pick defaults or add your own.</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((language) => (
            <label
              key={language}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                preferredLanguages.includes(language)
                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <input
                type="checkbox"
                checked={preferredLanguages.includes(language)}
                onChange={() => toggleLanguage(language)}
              />
              <span className="font-medium">{language}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
            placeholder="Add custom language (e.g. Haskell)"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addCustomLanguage}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {preferredLanguages.map((language) => (
            <button
              key={`selected-language-${language}`}
              type="button"
              onClick={() => toggleLanguage(language)}
              className="rounded-full border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800"
            >
              {language} x
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">Preferred Areas</p>
        <p className="text-xs text-gray-600">Use broad areas or add custom label keywords used in GitHub issues.</p>
        <div className="flex flex-wrap gap-2">
          {CONTRIBUTION_TYPE_OPTIONS.map((area) => (
            <label
              key={area.value}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                preferredAreas.includes(area.value)
                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <input
                type="checkbox"
                checked={preferredAreas.includes(area.value)}
                onChange={() => toggleArea(area.value)}
              />
              <span className="font-medium">{area.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={customArea}
            onChange={(e) => setCustomArea(e.target.value)}
            placeholder="Add custom area/label (e.g. devops, kubernetes)"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addCustomArea}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {preferredAreas.map((area) => (
            <button
              key={`selected-area-${area}`}
              type="button"
              onClick={() => toggleArea(area)}
              className="rounded-full border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800"
            >
              {area} x
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-semibold uppercase tracking-wide text-slate-700">Preferred Issue Size</label>
          <button
            type="button"
            onClick={() => setIsIssueSizeInfoOpen(true)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold leading-none text-gray-700 hover:bg-gray-50"
            aria-label="How preferred issue size is applied"
            title="How preferred issue size is applied"
          >
            i
          </button>
        </div>
        <select
          value={preferredIssueSize}
          onChange={(e) => setPreferredIssueSize(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
        >
          <option value="very_small">Very small</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
        </select>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={activeReposOnly}
          onChange={(e) => setActiveReposOnly(e.target.checked)}
        />
        <span>Only show active repositories</span>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save Preferences"}
        </button>
      </div>

      <SimpleModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="How Matching Works">
        <p>
          Your preferences are used to build a broad GitHub query, then each issue is scored and ranked. We avoid over-
          restricting results, so good issues are not hidden when you select more options.
        </p>
        <p>
          <strong>Skill level</strong> and <strong>preferred issue size</strong> are applied as ranking signals (difficulty and
          discussion complexity), not strict filters.
        </p>
        <p>
          <strong>Languages</strong> and <strong>areas</strong> use label/topic matches first, then fallback keyword inference from
          issue title/body when labels are missing.
        </p>
        <p>
          Final score combines freshness, repo health, clarity, accessibility/newcomer-friendliness, tech match,
          skill/size fit, and penalties.
        </p>
      </SimpleModal>

      <SimpleModal
        isOpen={isSkillInfoOpen}
        onClose={() => setIsSkillInfoOpen(false)}
        title="How Skill Level Affects Scoring"
      >
        <p>
          We estimate each issue difficulty from comments, assignees, issue detail length, and label complexity.
        </p>
        <p>
          <strong>Beginner</strong> targets easier issues (difficulty around 30). <strong>Intermediate</strong> targets
          moderate complexity (difficulty around 55).
        </p>
        <p>
          Accessibility/newcomer-friendliness is still considered for both levels, but it is weighted lower for
          intermediate profiles (0.5x) to avoid over-prioritizing beginner-oriented issues.
        </p>
      </SimpleModal>

      <SimpleModal
        isOpen={isIssueSizeInfoOpen}
        onClose={() => setIsIssueSizeInfoOpen(false)}
        title="How Preferred Issue Size Is Applied"
      >
        <p>
          Preferred Issue Size is a ranking signal, not a hard filter. We estimate each issue size/complexity using four
          signals: comment count, issue body length, assignee count, and labels.
        </p>
        <p>
          Labels like <strong>good first issue</strong> reduce complexity, while labels like <strong>epic</strong> or
          <strong> needs discussion</strong> increase complexity.
        </p>
        <p>
          We compare the issue&apos;s complexity with your target:
          <strong> very small</strong> (simplest), <strong>small</strong> (light-medium), and
          <strong> medium</strong> (more involved). Closer matches get a higher issue-size fit score.
        </p>
      </SimpleModal>
    </form>
  );
}