"use server";

import { auth, signOut } from "@/auth";
import { deleteAccount } from "@/lib/accountDeletion";

/** Deletes the signed-in person's account. On success it signs them out and sends them to the home page. */
export async function deleteMyAccount(password: string): Promise<{ ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  if (!password) return { ok: false, error: "Escribe tu contraseña para confirmar." };
  const result = await deleteAccount(session.user.id, password);
  if (!result.ok) return result;
  await signOut({ redirectTo: "/?cuenta=eliminada" });
  return { ok: false, error: "No pudimos cerrar tu sesión. Recarga la página." }; // signOut redirects; unreachable
}
