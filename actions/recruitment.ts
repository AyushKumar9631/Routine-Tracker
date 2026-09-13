"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RecruitmentFormInput } from "@/lib/types";

export async function createRecruitmentActivity(input: RecruitmentFormInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const companyName = input.company_name.trim();
  const role = input.role.trim();
  if (!companyName) throw new Error("Company name is required");
  if (!role) throw new Error("Role is required");

  const companyUrl = input.company_url.trim() || null;
  const testDate = input.test_date || null;

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .insert({
      user_id: user.id,
      name: `${companyName} \u2014 ${role}`,
      icon: "\ud83c\udfaf",
      kind: "recruitment",
      // period/completion_type are left at their table defaults ("daily" /
      // "boolean") purely to satisfy the existing NOT NULL constraints — a
      // recruitment-kind activity must never have these read by the app.
    })
    .select("id")
    .single();

  if (activityError) throw new Error(activityError.message);

  // From here on, if either insert below fails we'd otherwise be left with
  // an orphaned activities row (kind = "recruitment" with no
  // recruitment_details to go with it) that every recruitment query assumes
  // exists — clean it back up rather than leave that half-created.
  try {
    const { error: detailsError } = await supabase.from("recruitment_details").insert({
      activity_id: activity.id,
      user_id: user.id,
      company_name: companyName,
      company_url: companyUrl,
      role,
    });
    if (detailsError) throw new Error(detailsError.message);

    const { error: roundError } = await supabase.from("recruitment_rounds").insert({
      activity_id: activity.id,
      user_id: user.id,
      round_no: 1,
      round_type: input.round_type,
      test_date: testDate,
    });
    if (roundError) throw new Error(roundError.message);
  } catch (err) {
    await supabase.from("activities").delete().eq("id", activity.id);
    throw err;
  }

  // TODO(Phase F): trigger the AI research passes here — company overview
  // (round_id = null) and round prep for this round 1 — fire-and-forget, must
  // not block this action's return. See plan doc section 1.6 / task F3.

  revalidatePath("/");
  revalidatePath("/activities");
}
