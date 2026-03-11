import PreferenceForm from "../../components/onboarding/PreferenceForm";

export default function OnboardingPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Set your preferences</h1>
        <p className="text-gray-600">
          Tell us what kind of GitHub issues you want to discover.
        </p>
      </div>

      <PreferenceForm />
    </section>
  );
}