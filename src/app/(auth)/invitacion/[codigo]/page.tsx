import { redirect } from "next/navigation";

export default async function InvitacionCodigoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  redirect(`/unirse?codigo=${encodeURIComponent(codigo)}`);
}
