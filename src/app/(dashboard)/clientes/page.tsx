"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  DollarSign,
  Phone,
  Mail,
  Loader2,
  UserCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];

export default function ClientesPage() {
  const { negocio } = useTenant();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroDeuda, setFiltroDeuda] = useState<"todos" | "con_deuda">("todos");

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clienteEdit, setClienteEdit] = useState<Cliente | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");

  // Modal Abonar Deuda
  const [abonoModalOpen, setAbonoModalOpen] = useState(false);
  const [clienteAbono, setClienteAbono] = useState<Cliente | null>(null);
  const [montoAbono, setMontoAbono] = useState<string>("");
  const [savingAbono, setSavingAbono] = useState(false);

  const fetchClientes = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("nombre", { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, [negocio?.id]);

  const abrirCrear = () => {
    setClienteEdit(null);
    setNombre("");
    setTelefono("");
    setEmail("");
    setDireccion("");
    setNotas("");
    setModalOpen(true);
  };

  const abrirEditar = (c: Cliente) => {
    setClienteEdit(c);
    setNombre(c.nombre);
    setTelefono(c.telefono || "");
    setEmail(c.email || "");
    setDireccion(c.direccion || "");
    setNotas(c.notas || "");
    setModalOpen(true);
  };

  const guardarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;

    if (!nombre.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const payload = {
        negocio_id: negocio.id,
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        direccion: direccion.trim() || null,
        notas: notas.trim() || null,
      };

      if (clienteEdit?.id) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", clienteEdit.id);

        if (error) throw error;
        toast.success("Cliente actualizado");
      } else {
        const { error } = await supabase.from("clientes").insert(payload);
        if (error) throw error;
        toast.success("Cliente creado");
      }

      setModalOpen(false);
      fetchClientes();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el cliente");
    } finally {
      setSaving(false);
    }
  };

  const eliminarCliente = async (id: string) => {
    if (!confirm("¿Deseas eliminar este cliente?")) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cliente eliminado");
      fetchClientes();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const abrirAbono = (c: Cliente) => {
    setClienteAbono(c);
    setMontoAbono("");
    setAbonoModalOpen(true);
  };

  const procesarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteAbono) return;

    const monto = Number(montoAbono);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingresa un monto válido para abonar");
      return;
    }

    setSavingAbono(true);
    const supabase = createClient();

    try {
      const deudaActual = Number(clienteAbono.deuda_total || 0);
      const nuevaDeuda = Math.max(0, deudaActual - monto);

      // 1. Actualizar deuda del cliente
      const { error: cErr } = await supabase
        .from("clientes")
        .update({ deuda_total: nuevaDeuda })
        .eq("id", clienteAbono.id);

      if (cErr) throw cErr;

      // 2. Registrar abono en deudas
      await supabase.from("deudas").insert({
        negocio_id: negocio!.id,
        cliente_id: clienteAbono.id,
        monto: monto,
        tipo: "pago",
        notas: `Abono a deuda de cliente: ${formatMoney(monto)}`,
      });

      toast.success(`Abono registrado. Nueva deuda: ${formatMoney(nuevaDeuda)}`);
      setAbonoModalOpen(false);
      fetchClientes();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el abono");
    } finally {
      setSavingAbono(false);
    }
  };

  const clientesFiltrados = clientes.filter((c) => {
    const q = busqueda.toLowerCase().trim();
    const matchQ =
      !q ||
      c.nombre.toLowerCase().includes(q) ||
      (c.telefono && c.telefono.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q));

    if (filtroDeuda === "con_deuda") {
      return matchQ && Number(c.deuda_total || 0) > 0;
    }
    return matchQ;
  });

  const deudaTotalGlobal = clientes.reduce((acc, c) => acc + Number(c.deuda_total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes y Fiados</h1>
          <p className="text-sm text-muted-foreground">
            Control de cuentas corrientes, libreta de fiados y pagos ({clientes.length} clientes)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-card border border-border px-4 py-2 rounded-xl text-xs font-semibold shadow-xs">
            <span className="text-muted-foreground mr-1.5">Deuda Total por Cobrar:</span>
            <span className="text-amber-600 font-bold text-base">{formatMoney(deudaTotalGlobal)}</span>
          </div>

          <Button onClick={abrirCrear} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Buscador y filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltroDeuda("todos")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroDeuda === "todos"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Todos los Clientes
          </button>
          <button
            onClick={() => setFiltroDeuda("con_deuda")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroDeuda === "con_deuda"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-background border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Solo con Deuda (Fiados)
          </button>
        </div>
      </div>

      {/* Tabla de Clientes */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Cargando directorio...</span>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No se encontraron clientes registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Correo</th>
                    <th className="py-3 px-4 text-right">Deuda Actual</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientesFiltrados.map((c) => {
                    const deuda = Number(c.deuda_total || 0);
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{c.nombre}</div>
                          {c.direccion && (
                            <div className="text-xs text-muted-foreground">{c.direccion}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {c.telefono ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {c.telefono}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {c.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {c.email}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {deuda > 0 ? (
                            <span className="font-bold text-amber-600 dark:text-amber-500">
                              {formatMoney(deuda)}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 dark:text-emerald-500 font-semibold">
                              Al día ($0)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {deuda > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => abrirAbono(c)}
                                className="h-7 text-xs px-2 gap-1 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                                Abonar
                              </Button>
                            )}
                            <button
                              onClick={() => abrirEditar(c)}
                              title="Editar"
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => eliminarCliente(c.id)}
                              title="Eliminar"
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Crear / Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{clienteEdit ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              Registra los datos de contacto y facturación del cliente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarCliente} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cli-nombre">Nombre o Razón Social *</Label>
              <Input
                id="cli-nombre"
                placeholder="Ej: María González o Almacén Los Pinos"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cli-tel">Teléfono / WhatsApp</Label>
                <Input
                  id="cli-tel"
                  placeholder="+56 9 1234 5678"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cli-mail">Correo Electrónico</Label>
                <Input
                  id="cli-mail"
                  type="email"
                  placeholder="cliente@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cli-dir">Dirección</Label>
              <Input
                id="cli-dir"
                placeholder="Av. Principal 123, Local 4"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                disabled={saving}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Abonar Deuda */}
      <Dialog open={abonoModalOpen} onOpenChange={setAbonoModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Abono a Deuda</DialogTitle>
            <DialogDescription>
              {clienteAbono?.nombre} • Deuda actual:{" "}
              <strong className="text-amber-600">{formatMoney(clienteAbono?.deuda_total)}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={procesarAbono} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="monto-abono">Monto que paga el cliente</Label>
              <Input
                id="monto-abono"
                type="number"
                min="1"
                placeholder="Ej: 5000"
                value={montoAbono}
                onChange={(e) => setMontoAbono(e.target.value)}
                required
                disabled={savingAbono}
                className="text-lg font-bold"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbonoModalOpen(false)} disabled={savingAbono}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAbono}>
                {savingAbono ? "Registrando..." : "Registrar Pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
