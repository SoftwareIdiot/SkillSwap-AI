import Workspace from "@/components/workspace";
import { db, isSupabaseConfigured } from "./supabase";
import { loadWorkspace } from "./workspace-server";
import { emptyWorkspace } from "./workspace";
import { redirect } from "next/navigation";
export async function openWorkspace(
  role: "Student" | "Teacher" | "Recruiter",
  protectedRoute = false,
) {
  if (!isSupabaseConfigured()) return <Workspace initialRole={role} />;
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    if (protectedRoute) redirect("/auth");
    return <Workspace initialRole={role} />;
  }
  try {
    return (
      <Workspace
        initialRole={role}
        connected
        initialData={await loadWorkspace(client, user.id)}
      />
    );
  } catch (e) {
    return (
      <Workspace
        initialRole={role}
        connected
        initialData={emptyWorkspace(user.id)}
        initialError={
          e instanceof Error ? e.message : "Your workspace could not be loaded."
        }
      />
    );
  }
}
