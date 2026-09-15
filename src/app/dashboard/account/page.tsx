import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AccountForm } from "./AccountForm";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Mi perfil</h1>
      <AccountForm
        email={user.email}
        name={user.name ?? ""}
        phone={user.phone ?? ""}
        city={user.city ?? ""}
        country={user.country ?? ""}
        facebook={user.facebook ?? ""}
        instagram={user.instagram ?? ""}
        tiktok={user.tiktok ?? ""}
        linkedin={user.linkedin ?? ""}
      />
    </div>
  );
}
