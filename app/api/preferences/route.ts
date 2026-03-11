import { NextResponse } from "next/server";
import { ensureDemoUser, getUserPreferences, upsertUserPreferences } from "@/lib/db/queries/preference";
import { preferenceSchema } from "@/lib/validations/preference";

export async function GET() {
  try {
    const user = await ensureDemoUser();
    const preferences = await getUserPreferences(user.id);

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Failed to fetch preferences:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = preferenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await ensureDemoUser();
    const preferences = await upsertUserPreferences(user.id, parsed.data);

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Failed to save preferences:", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}