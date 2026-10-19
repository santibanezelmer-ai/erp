import { redirect } from "next/navigation";

export default function FiadosRedirectPage() {
  redirect("/clientes?filtro=con_deuda");
}
