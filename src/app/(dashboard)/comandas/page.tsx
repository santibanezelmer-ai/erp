"use client";

import { useEffect, useState, useRef } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { precioUnitario } from "@/lib/promo";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Layers,
  UtensilsCrossed,
  Plus,
  Minus,
  Trash2,
  ChefHat,
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  Printer,
  CreditCard,
  User,
  ShoppingBag,
  Flame,
  Bell,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { imprimirTicketTermico } from "@/lib/ticket";

type Mesa = Database["public"]["Tables"]["mesas"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];
type Comanda = Database["public"]["Tables"]["comandas"]["Row"];
type ComandaItem = Database["public"]["Tables"]["comanda_items"]["Row"];

interface ItemDraft {
  producto: Producto;
  variante: Variante | null;
  qty: number;
  precio: number;
  notas: string;
  requiere_preparacion: boolean;
}

export default function ComandasPage() {
  const { negocio, profile } = useTenant();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  // Producto con variantes esperando que se elija una
  const [elegirVarianteProd, setElegirVarianteProd] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(true);

  // Selección actual
  const [tipoPedido, setTipoPedido] = useState<"mesa" | "llevar">("mesa");
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");

  // Comanda activa en la mesa (si ya existe)
  const [comandaActiva, setComandaActiva] = useState<Comanda | null>(null);
  const [itemsEnviados, setItemsEnviados] = useState<ComandaItem[]>([]);
  const [cargandoComanda, setCargandoComanda] = useState(false);

  // Nuevos ítems en borrador (por marchar/enviar a cocina)
  const [draftItems, setDraftItems] = useState<ItemDraft[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");

  // Modal Notas Rápidas para un ítem
  const [itemNotaModal, setItemNotaModal] = useState<ItemDraft | null>(null);
  const [notaTexto, setNotaTexto] = useState("");

  // Estado de envío / guardado
  const [enviandoCocina, setEnviandoCocina] = useState(false);

  // Modal Pre-cuenta
  const [precuentaModalOpen, setPrecuentaModalOpen] = useState(false);

  // Modal Cobrar / Cerrar
  const [cerrarModalOpen, setCerrarModalOpen] = useState(false);
  const [metodoPagoCierre, setMetodoPagoCierre] = useState<"efectivo" | "debito" | "credito" | "transferencia">("efectivo");
  const [efectivoRecibido, setEfectivoRecibido] = useState("");
  const [cerrandoComanda, setCerrandoComanda] = useState(false);

  // Estados de entrega e interactividad en tiempo real
  const [actualizandoItemId, setActualizandoItemId] = useState<string | null>(null);
  const comandaActivaRef = useRef<Comanda | null>(null);
  const mesaSeleccionadaRef = useRef<Mesa | null>(null);
  const itemsNotificadosRef = useRef<Set<string>>(new Set());

  // Mantener refs sincronizadas para el listener de Realtime
  useEffect(() => {
    comandaActivaRef.current = comandaActiva;
  }, [comandaActiva]);

  useEffect(() => {
    mesaSeleccionadaRef.current = mesaSeleccionada;
  }, [mesaSeleccionada]);

  // Síntesis de sonido de timbre para avisar al garzón de platos listos
  const reproducirChimeListo = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
      gain2.gain.setValueAtTime(0.3, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn("Audio chime no disponible:", e);
    }
  };

  const fetchData = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [mesasRes, prodsRes, varsRes] = await Promise.all([
        supabase
          .from("mesas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("numero", { ascending: true }),
        supabase
          .from("productos")
          .select("*")
          .eq("negocio_id", negocio.id)
          .eq("activo", true)
          .order("nombre", { ascending: true }),
        supabase
          .from("producto_variantes")
          .select("*")
          .eq("negocio_id", negocio.id)
          .eq("activo", true)
          .order("nombre", { ascending: true }),
      ]);

      setMesas(mesasRes.data || []);
      setProductos(prodsRes.data || []);
      setVariantes(varsRes.data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar mesas y productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!negocio?.id) return;
    const supabase = createClient();

    // Suscripción Realtime a cambios en productos de comanda para este negocio
    const itemsChannel = supabase
      .channel(`comandas-items-live-${negocio.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comanda_items",
          filter: `negocio_id=eq.${negocio.id}`,
        },
        (payload) => {
          const activeCom = comandaActivaRef.current;

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as ComandaItem;
            // Si el ítem pertenece a la comanda activa actual
            if (activeCom && updated.comanda_id === activeCom.id) {
              setItemsEnviados((prev) =>
                prev.map((item) => (item.id === updated.id ? updated : item))
              );
            }

            // Notificación al garzón si un plato pasa a 'listo'
            if (updated.estado === "listo") {
              if (!itemsNotificadosRef.current.has(updated.id)) {
                itemsNotificadosRef.current.add(updated.id);
                reproducirChimeListo();
                const mesaTxt =
                  activeCom && updated.comanda_id === activeCom.id
                    ? `Mesa #${mesaSeleccionadaRef.current?.numero || "activa"}`
                    : "Pedido de cocina";
                toast.success(`🛎️ ¡Plato listo!: ${updated.nombre}`, {
                  description: `${mesaTxt} está listo para ser servido`,
                  duration: 6000,
                });
              }
            } else if (updated.estado !== "listo") {
              itemsNotificadosRef.current.delete(updated.id);
            }
          } else if (payload.eventType === "INSERT") {
            const inserted = payload.new as ComandaItem;
            if (activeCom && inserted.comanda_id === activeCom.id) {
              setItemsEnviados((prev) => {
                if (prev.some((it) => it.id === inserted.id)) return prev;
                return [...prev, inserted];
              });
            }
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            if (deleted?.id && activeCom) {
              setItemsEnviados((prev) => prev.filter((it) => it.id !== deleted.id));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mesas",
          filter: `negocio_id=eq.${negocio.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updatedMesa = payload.new as Mesa;
            setMesas((prev) =>
              prev.map((m) => (m.id === updatedMesa.id ? updatedMesa : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, [negocio?.id]);

  // Cuando se selecciona una mesa, cargar su comanda activa si existe
  const seleccionarMesa = async (mesa: Mesa) => {
    setMesaSeleccionada(mesa);
    setTipoPedido("mesa");
    setDraftItems([]);
    setCargandoComanda(true);
    const supabase = createClient();

    try {
      const { data: coms, error } = await supabase
        .from("comandas")
        .select("*")
        .eq("negocio_id", negocio!.id)
        .eq("mesa_id", mesa.id)
        .eq("estado", "abierta")
        .maybeSingle();

      if (error) throw error;

      if (coms) {
        setComandaActiva(coms);
        const { data: its } = await supabase
          .from("comanda_items")
          .select("*")
          .eq("comanda_id", coms.id)
          .order("created_at", { ascending: true });
        setItemsEnviados(its || []);
      } else {
        setComandaActiva(null);
        setItemsEnviados([]);
      }
    } catch (err: any) {
      toast.error("Error al verificar comanda de la mesa");
    } finally {
      setCargandoComanda(false);
    }
  };

  const seleccionarParaLlevar = () => {
    setMesaSeleccionada(null);
    setTipoPedido("llevar");
    setComandaActiva(null);
    setItemsEnviados([]);
    setDraftItems([]);
  };

  const variantesDe = (prodId: string) => variantes.filter((v) => v.producto_id === prodId);

  // Precio de la variante; si no tiene uno propio, se usa el del producto
  const precioDe = (prod: Producto, variante: Variante | null) => precioUnitario(prod, variante);

  const nombreItem = (prod: Producto, variante: Variante | null) =>
    variante ? `${prod.nombre} (${variante.nombre})` : prod.nombre;

  // Agregar producto al borrador. Si tiene variantes, primero se pide elegir una.
  const agregarAlDraft = (prod: Producto, variante: Variante | null = null) => {
    if (!variante && variantesDe(prod.id).length > 0) {
      setElegirVarianteProd(prod);
      return;
    }
    setDraftItems((prev) => {
      const idx = prev.findIndex(
        (i) =>
          i.producto.id === prod.id &&
          (i.variante?.id ?? null) === (variante?.id ?? null) &&
          !i.notas
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          producto: prod,
          variante,
          qty: 1,
          precio: precioDe(prod, variante),
          notas: "",
          // Según el producto: sin preparación no pasa por cocina
          requiere_preparacion: prod.requiere_preparacion ?? true,
        },
      ];
    });
  };

  const actualizarQtyDraft = (index: number, delta: number) => {
    setDraftItems((prev) => {
      const copy = [...prev];
      const newQty = copy[index].qty + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== index);
      }
      copy[index].qty = newQty;
      return copy;
    });
  };

  const abrirModalNota = (item: ItemDraft) => {
    setItemNotaModal(item);
    setNotaTexto(item.notas || "");
  };

  const guardarNota = () => {
    if (!itemNotaModal) return;
    setDraftItems((prev) =>
      prev.map((i) => (i === itemNotaModal ? { ...i, notas: notaTexto } : i))
    );
    setItemNotaModal(null);
  };

  // Enviar a Cocina (Marchar platos)
  const enviarACocina = async () => {
    if (!negocio?.id) return;
    if (draftItems.length === 0) {
      toast.error("No hay productos nuevos para marchar");
      return;
    }

    setEnviandoCocina(true);
    const supabase = createClient();

    try {
      let comId = comandaActiva?.id;

      // Si no hay comanda abierta aún, crear una
      if (!comId) {
        const { data: nuevaCom, error: comErr } = await supabase
          .from("comandas")
          .insert({
            negocio_id: negocio.id,
            mesa_id: mesaSeleccionada?.id || null,
            tipo: tipoPedido,
            estado: "abierta",
            cliente_nombre: clienteNombre || null,
            cliente_telefono: clienteTelefono || null,
            mesero_id: profile?.id || null,
            total: 0,
          })
          .select("*")
          .single();

        if (comErr) throw comErr;
        comId = nuevaCom.id;
        setComandaActiva(nuevaCom);

        // Si es mesa, marcar la mesa como ocupada
        if (mesaSeleccionada?.id) {
          await supabase
            .from("mesas")
            .update({ estado: "ocupada" })
            .eq("id", mesaSeleccionada.id);
          setMesas((prev) =>
            prev.map((m) =>
              m.id === mesaSeleccionada.id ? { ...m, estado: "ocupada" } : m
            )
          );
        }
      }

      // Insertar comanda_items
      const nuevosItemsPayload = draftItems.map((d) => ({
        comanda_id: comId!,
        negocio_id: negocio.id,
        producto_id: d.producto.id,
        // variante_id sólo se envía cuando hay variante elegida
        ...(d.variante ? { variante_id: d.variante.id } : {}),
        nombre: nombreItem(d.producto, d.variante),
        qty: d.qty,
        precio: d.precio,
        notas: d.notas || null,
        requiere_preparacion: d.requiere_preparacion,
        // Lo que no requiere preparación no va a cocina: queda listo para servir
        estado: d.requiere_preparacion ? "pendiente" : "listo",
      }));

      let { data: insertedItems, error: itemsErr } = await supabase
        .from("comanda_items")
        .insert(nuevosItemsPayload)
        .select("*");

      // Compatibilidad: si la BD aún no tiene comanda_items.variante_id (migración
      // 20261126_variantes_comandas.sql sin aplicar), se reintenta sin esa columna.
      // El pedido sale igual con nombre y precio de la variante; sólo el descuento
      // de stock queda a nivel de producto hasta aplicar la migración.
      if (
        itemsErr &&
        nuevosItemsPayload.some((i) => "variante_id" in i) &&
        (itemsErr.code === "PGRST204" || /variante_id/i.test(itemsErr.message || ""))
      ) {
        console.warn("[Comandas] comanda_items.variante_id no existe; se guarda sin variante_id");
        const sinVariante = nuevosItemsPayload.map((item) => {
          const copia: Record<string, unknown> = { ...item };
          delete copia.variante_id;
          return copia as Omit<typeof item, "variante_id">;
        });
        ({ data: insertedItems, error: itemsErr } = await supabase
          .from("comanda_items")
          .insert(sinVariante)
          .select("*"));
      }

      if (itemsErr) throw itemsErr;

      // Calcular nuevo total acumulado
      const itemsTotales = [...itemsEnviados, ...(insertedItems || [])];
      const nuevoTotal = itemsTotales.reduce(
        (acc, item) => acc + item.qty * Number(item.precio),
        0
      );

      await supabase
        .from("comandas")
        .update({ total: nuevoTotal })
        .eq("id", comId);

      setItemsEnviados(itemsTotales);
      setDraftItems([]);
      const aCocina = draftItems.filter((d) => d.requiere_preparacion).length;
      const directos = draftItems.length - aCocina;
      toast.success(
        aCocina > 0 && directos > 0
          ? `¡Comanda marchada! ${aCocina} a cocina y ${directos} listo(s) para servir`
          : aCocina > 0
          ? "¡Comanda marchada a cocina con éxito!"
          : `${directos} producto(s) agregados listos para servir (no pasan por cocina)`
      );

      // Efecto sonoro de comanda enviada
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch {}
    } catch (err: any) {
      toast.error(err.message || "Error al enviar la comanda");
    } finally {
      setEnviandoCocina(false);
    }
  };

  // Confirmar entrega de un plato a la mesa por parte del garzón (atómico y condicional)
  const confirmarEntregaItem = async (itemId: string) => {
    if (!negocio?.id || !comandaActiva?.id) return;
    setActualizandoItemId(itemId);
    const supabase = createClient();
    try {
      // Condición atómica: solo si efectivamente sigue en estado 'listo'
      const { data, error } = await supabase
        .from("comanda_items")
        .update({
          estado: "entregado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .eq("negocio_id", negocio.id)
        .eq("estado", "listo")
        .select("id, estado");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("El plato ya no está pendiente de entrega o fue modificado por otro usuario.");
        // Refrescar lista de ítems para mostrar estado real
        const { data: its } = await supabase
          .from("comanda_items")
          .select("*")
          .eq("comanda_id", comandaActiva.id)
          .order("created_at", { ascending: true });
        setItemsEnviados(its || []);
        return;
      }

      setItemsEnviados((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, estado: "entregado" } : it))
      );
      toast.success("✓ Plato confirmado como entregado a la mesa");
    } catch (err: any) {
      toast.error(err.message || "Error al confirmar entrega");
    } finally {
      setActualizandoItemId(null);
    }
  };

  // Confirmar entrega de todos los platos listos en la comanda (atómico y condicional)
  const confirmarEntregaTodosListos = async () => {
    if (!negocio?.id || !comandaActiva?.id) return;
    const listos = itemsEnviados.filter((i) => i.estado === "listo");
    if (listos.length === 0) return;

    setActualizandoItemId("all");
    const supabase = createClient();
    try {
      const listosIds = listos.map((i) => i.id);

      // Actualizar condicionalmente solo aquellos ítems que sigan en 'listo'
      const { data, error } = await supabase
        .from("comanda_items")
        .update({
          estado: "entregado",
          updated_at: new Date().toISOString(),
        })
        .in("id", listosIds)
        .eq("negocio_id", negocio.id)
        .eq("estado", "listo")
        .select("id, estado");

      if (error) throw error;

      const afectados = data?.length || 0;
      if (afectados === 0) {
        toast.warning("Los platos ya habían sido entregados o modificados previamente.");
      } else {
        toast.success(`✓ Se confirmaron ${afectados} plato(s) entregados`);
      }

      // Sincronizar comanda con el estado real de la base de datos
      const { data: its } = await supabase
        .from("comanda_items")
        .select("*")
        .eq("comanda_id", comandaActiva.id)
        .order("created_at", { ascending: true });
      setItemsEnviados(its || []);
    } catch (err: any) {
      toast.error(err.message || "Error al entregar platos");
    } finally {
      setActualizandoItemId(null);
    }
  };

  // Cobrar y cerrar comanda mediante RPC atómico e idempotente
  const cerrarComanda = async () => {
    if (!comandaActiva || !negocio?.id) return;

    const totalComanda = itemsEnviados.reduce(
      (acc, i) => acc + i.qty * Number(i.precio),
      0
    );

    // Validación preventiva de efectivo
    if (metodoPagoCierre === "efectivo") {
      const rec = Number(efectivoRecibido);
      if (!efectivoRecibido || isNaN(rec) || rec < totalComanda) {
        toast.error(`El monto recibido en efectivo debe ser igual o superior a ${formatMoney(totalComanda)}`);
        return;
      }
    }

    setCerrandoComanda(true);
    const supabase = createClient();

    try {
      // Invocación transaccional al coordinador de PostgreSQL
      const { data, error } = await (supabase.rpc as any)("cerrar_comanda_restaurante", {
        _comanda_id: comandaActiva.id,
        _pago: metodoPagoCierre,
        _efectivo_rec: metodoPagoCierre === "efectivo" && efectivoRecibido ? Number(efectivoRecibido) : null,
        _sucursal_id: null,
      });

      if (error) throw error;

      if (data?.ya_cobrada) {
        toast.info(data.mensaje || "La comanda ya había sido cobrada exitosamente.");
      } else {
        toast.success("¡Comanda cobrada y cerrada exitosamente!");
      }

      setCerrarModalOpen(false);
      setEfectivoRecibido("");
      setComandaActiva(null);
      setItemsEnviados([]);
      setDraftItems([]);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al cobrar la comanda");
    } finally {
      setCerrandoComanda(false);
    }
  };

  // Imprimir Pre-cuenta para el cliente
  const imprimirPrecuenta = () => {
    if (!comandaActiva && draftItems.length === 0) return;
    const todos = [
      ...itemsEnviados.map((i) => ({
        nombre: i.nombre,
        qty: i.qty,
        precio: Number(i.precio),
        subtotal: i.qty * Number(i.precio),
        nota: i.notas,
      })),
      ...draftItems.map((d) => ({
        nombre: nombreItem(d.producto, d.variante),
        qty: d.qty,
        precio: d.precio,
        subtotal: d.qty * d.precio,
        nota: d.notas,
      })),
    ];

    const subtotal = todos.reduce((a, b) => a + b.subtotal, 0);

    imprimirTicketTermico(
      {
        negocioNombre: negocio?.nombre || "Restaurante",
        logoUrl: (negocio as any)?.logo_url || (negocio?.perfil?.startsWith("http") ? negocio.perfil : null),
        folio: `PRE-${(comandaActiva?.id || "NUEVA").slice(0, 6).toUpperCase()}`,
        cajero: profile?.nombre || "Mesero",
        mesa: mesaSeleccionada ? `Mesa #${mesaSeleccionada.numero}` : "Para Llevar",
        items: todos,
        subtotal,
        total: subtotal,
        metodoPago: "Pendiente de pago",
        mensajePie: "PRE-CUENTA DE SERVICIO • Propina del 10% voluntaria sugerida",
      },
      80
    );
  };

  // Cálculos de totales
  const totalEnviado = itemsEnviados.reduce((a, b) => a + b.qty * Number(b.precio), 0);
  const totalDraft = draftItems.reduce((a, b) => a + b.qty * b.precio, 0);
  const totalGeneral = totalEnviado + totalDraft;

  // Filtro de catálogo
  const categorias = ["todas", ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]))];
  const productosFiltrados = productos.filter((p) => {
    const q = busquedaProducto.toLowerCase().trim();
    const matchBusqueda = !q || p.nombre.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q));
    const matchCat = categoriaSeleccionada === "todas" || p.categoria === categoriaSeleccionada;
    return matchBusqueda && matchCat;
  });

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4 overflow-hidden">
      {/* Columna Izquierda: Mesas y Catálogo de Platos */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 bg-card rounded-xl border border-border p-4 overflow-hidden">
        {/* Selector de Mesa / Para Llevar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              1. Seleccionar Mesa o Tipo de Pedido
            </span>
            <Button
              variant={tipoPedido === "llevar" ? "default" : "outline"}
              size="sm"
              onClick={seleccionarParaLlevar}
              className="h-7 text-xs gap-1.5"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Para Llevar
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {mesas.map((m) => {
              const selected = mesaSeleccionada?.id === m.id && tipoPedido === "mesa";
              const ocupada = m.estado === "ocupada";
              return (
                <button
                  key={m.id}
                  onClick={() => seleccionarMesa(m)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-xl border min-w-[72px] transition-all relative",
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : ocupada
                      ? "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  )}
                >
                  <UtensilsCrossed className="h-4 w-4 mb-1" />
                  <span className="text-xs font-bold">Mesa {m.numero}</span>
                  <span className="text-[10px] opacity-80 capitalize">{m.estado}</span>
                  {ocupada && !selected && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Buscador de Platos y Categorías */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar plato, trago o producto..."
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
              className="pl-9 bg-background h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaSeleccionada(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border capitalize transition-all",
                  categoriaSeleccionada === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {cat === "todas" ? "Todos" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Platos */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {productosFiltrados.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => agregarAlDraft(prod)}
                  className="p-3 text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between group h-24"
                >
                  <span className="text-xs font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {prod.nombre}
                  </span>
                  <div className="flex justify-between items-end pt-1">
                    <span className="text-xs font-black text-primary">
                      {formatMoney(precioUnitario(prod))}
                      {variantesDe(prod.id).length > 0 && (
                        <span className="block text-[10px] font-semibold text-muted-foreground">
                          {variantesDe(prod.id).length} opciones
                        </span>
                      )}
                    </span>
                    <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Panel de la Comanda Activa */}
      <div className="w-full lg:w-96 flex flex-col bg-card rounded-xl border border-border p-4 overflow-hidden">
        {/* Cabecera del pedido */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                {tipoPedido === "mesa"
                  ? mesaSeleccionada
                    ? `Mesa #${mesaSeleccionada.numero}`
                    : "Selecciona una Mesa"
                  : "Pedido Para Llevar"}
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {comandaActiva
                ? `Comanda #${comandaActiva.id.slice(0, 6).toUpperCase()} • Activa`
                : "Nueva Comanda"}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={imprimirPrecuenta}
            disabled={itemsEnviados.length === 0 && draftItems.length === 0}
            className="h-7 text-xs gap-1"
            title="Imprimir pre-cuenta para mesa"
          >
            <Printer className="h-3.5 w-3.5" />
            Pre-cuenta
          </Button>
        </div>

        {/* Lista de Ítems */}
        <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
          {cargandoComanda ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : itemsEnviados.length === 0 && draftItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-4">
              <Layers className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-semibold">Comanda vacía</p>
              <p className="text-[11px] opacity-75">Selecciona platos del menú a la izquierda</p>
            </div>
          ) : (
            <>
              {/* Ítems ya marchados a cocina */}
              {itemsEnviados.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Marchados en Cocina ({itemsEnviados.length})
                    </span>
                    {itemsEnviados.filter((i) => i.estado === "listo").length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={confirmarEntregaTodosListos}
                        disabled={actualizandoItemId === "all"}
                        className="h-5 text-[9px] px-2 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10 gap-1 font-bold shadow-2xs"
                      >
                        <CheckCheck className="h-2.5 w-2.5" />
                        Entregar todos los listos
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {itemsEnviados.map((it) => {
                      const isListo = it.estado === "listo";
                      const isEntregado = it.estado === "entregado";
                      const isPreparando = it.estado === "preparando";

                      return (
                        <div
                          key={it.id}
                          className={cn(
                            "p-2.5 rounded-lg border transition-all flex items-center justify-between text-xs",
                            isListo
                              ? "border-emerald-500/80 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30"
                              : isEntregado
                              ? "border-border/60 bg-muted/30 opacity-75"
                              : isPreparando
                              ? "border-amber-500/40 bg-amber-500/5"
                              : "border-border/80 bg-muted/20"
                          )}
                        >
                          <div className="flex-1 pr-2">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span className="font-bold text-primary">{it.qty}x</span>
                              <span className={cn(isEntregado && "line-through text-muted-foreground")}>{it.nombre}</span>
                            </div>
                            {it.notas && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
                                "{it.notas}"
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase flex items-center gap-1",
                                  it.estado === "pendiente"
                                    ? "bg-amber-500/20 text-amber-600"
                                    : isPreparando
                                    ? "bg-orange-500/20 text-orange-600"
                                    : isListo
                                    ? "bg-emerald-600 text-white animate-pulse"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                )}
                              >
                                {isListo && <Bell className="h-2.5 w-2.5" />}
                                {isListo
                                  ? "¡Listo para Servir!"
                                  : isEntregado
                                  ? "✓ Entregado"
                                  : isPreparando
                                  ? "🍳 En Cocina"
                                  : "⏳ Pendiente"}
                              </span>

                              {isListo && (
                                <Button
                                  size="sm"
                                  onClick={() => confirmarEntregaItem(it.id)}
                                  disabled={actualizandoItemId === it.id}
                                  className="h-6 text-[10px] px-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs"
                                >
                                  {actualizandoItemId === it.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  Confirmar Entrega
                                </Button>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-foreground shrink-0">
                            {formatMoney(it.qty * Number(it.precio))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ítems nuevos en borrador por marchar */}
              {draftItems.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                    <Flame className="h-3 w-3" /> Por Marchar ({draftItems.length})
                  </span>
                  <div className="space-y-1.5">
                    {draftItems.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 pr-2">
                          <div className="font-bold text-foreground">
                            {nombreItem(d.producto, d.variante)}
                            {!d.requiere_preparacion && (
                              <span className="ml-1.5 align-middle text-[9px] font-semibold text-sky-700 dark:text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded">
                                Directo
                              </span>
                            )}
                          </div>
                          {d.notas ? (
                            <button
                              onClick={() => abrirModalNota(d)}
                              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline block text-left italic font-medium"
                            >
                              "{d.notas}"
                            </button>
                          ) : (
                            <button
                              onClick={() => abrirModalNota(d)}
                              className="text-[10px] text-muted-foreground hover:text-primary transition-colors block text-left"
                            >
                              + Agregar nota (sin sal, etc.)
                            </button>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatMoney(d.precio)} c/u
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => actualizarQtyDraft(idx, -1)}
                            className="h-6 w-6 rounded bg-background border flex items-center justify-center hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center font-bold">{d.qty}</span>
                          <button
                            onClick={() => actualizarQtyDraft(idx, 1)}
                            className="h-6 w-6 rounded bg-background border flex items-center justify-center hover:bg-muted"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Resumen y Acciones */}
        <div className="pt-3 border-t border-border space-y-3">
          <div className="space-y-1 text-xs">
            {itemsEnviados.length > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Ya marchado:</span>
                <span>{formatMoney(totalEnviado)}</span>
              </div>
            )}
            {draftItems.length > 0 && (
              <div className="flex justify-between text-primary font-semibold">
                <span>Por marchar:</span>
                <span>+{formatMoney(totalDraft)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base pt-1 border-t border-border/60">
              <span>TOTAL COMANDA:</span>
              <span className="text-primary">{formatMoney(totalGeneral)}</span>
            </div>
          </div>

          <div className="space-y-2">
            {/* Botón Marchar a Cocina */}
            <Button
              onClick={enviarACocina}
              disabled={draftItems.length === 0 || enviandoCocina}
              className="w-full gap-2 font-bold"
            >
              {enviandoCocina ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Marchando...
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 text-orange-400" />
                  Marchar a Cocina {draftItems.length > 0 ? `(${draftItems.length})` : ""}
                </>
              )}
            </Button>

            {/* Botón Cobrar y Cerrar */}
            {comandaActiva && (
              <Button
                variant="outline"
                onClick={() => {
                  setMetodoPagoCierre("efectivo");
                  setEfectivoRecibido(totalEnviado.toString());
                  setCerrarModalOpen(true);
                }}
                disabled={draftItems.length > 0}
                className="w-full gap-2 font-semibold text-xs border-emerald-600/40 text-emerald-600 hover:bg-emerald-500/10"
              >
                <CreditCard className="h-4 w-4" />
                Cobrar y Liberar Mesa ({formatMoney(totalEnviado)})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Elegir Variante */}
      <Dialog open={!!elegirVarianteProd} onOpenChange={(v) => !v && setElegirVarianteProd(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{elegirVarianteProd?.nombre}</DialogTitle>
            <DialogDescription className="text-xs">Elige una opción</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5 py-2 max-h-80 overflow-y-auto">
            {elegirVarianteProd &&
              variantesDe(elegirVarianteProd.id).map((v) => {
                const sinStock =
                  !elegirVarianteProd.sin_control_stock && Number(v.stock || 0) <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={sinStock}
                    onClick={() => {
                      agregarAlDraft(elegirVarianteProd, v);
                      setElegirVarianteProd(null);
                    }}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all hover:border-primary/50 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="font-semibold">{v.nombre}</span>
                    <span className="flex items-center gap-2">
                      {!elegirVarianteProd.sin_control_stock && (
                        <span className="text-[10px] text-muted-foreground">
                          {sinStock ? "Sin stock" : `${Number(v.stock || 0)} u.`}
                        </span>
                      )}
                      <span className="font-black text-primary">
                        {formatMoney(precioDe(elegirVarianteProd, v))}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setElegirVarianteProd(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nota Especial */}
      <Dialog open={!!itemNotaModal} onOpenChange={(v) => !v && setItemNotaModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Notas de Preparación</DialogTitle>
            <DialogDescription className="text-xs">
              Instrucciones especiales para cocina (ej: Sin sal, término medio, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Escribe la indicación..."
              className="text-xs"
            />

            <div className="flex flex-wrap gap-1.5">
              {[
                "Sin cebolla",
                "Sin sal",
                "Término medio",
                "Bien cocido",
                "Sin hielo",
                "Aderezo aparte",
                "Para compartir",
              ].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setNotaTexto(sug)}
                  className="px-2 py-1 rounded-md text-[10px] bg-muted hover:bg-primary hover:text-primary-foreground border transition-all"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setItemNotaModal(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={guardarNota}>
              Guardar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cobrar y Cerrar Comanda */}
      <Dialog open={cerrarModalOpen} onOpenChange={setCerrarModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Cobrar Comanda</DialogTitle>
            <DialogDescription className="text-xs">
              {mesaSeleccionada ? `Mesa #${mesaSeleccionada.numero}` : "Para Llevar"} •{" "}
              Total a pagar: <span className="font-bold text-foreground">{formatMoney(totalEnviado)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Método de Pago</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "efectivo" as const, label: "Efectivo" },
                  { id: "debito" as const, label: "Débito" },
                  { id: "credito" as const, label: "Crédito" },
                  { id: "transferencia" as const, label: "Transfer." },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMetodoPagoCierre(m.id);
                      if (m.id === "efectivo" && !efectivoRecibido) {
                        setEfectivoRecibido(totalEnviado.toString());
                      }
                    }}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs font-semibold capitalize transition-all text-center",
                      metodoPagoCierre === m.id
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {metodoPagoCierre === "efectivo" && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="efectivoRecibido" className="text-xs font-medium">
                    Efectivo Recibido
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-primary hover:text-primary font-medium"
                    onClick={() => setEfectivoRecibido(totalEnviado.toString())}
                  >
                    Monto Exacto ({formatMoney(totalEnviado)})
                  </Button>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                    $
                  </span>
                  <Input
                    id="efectivoRecibido"
                    type="number"
                    min={totalEnviado}
                    step="1"
                    placeholder={totalEnviado.toString()}
                    value={efectivoRecibido}
                    onChange={(e) => setEfectivoRecibido(e.target.value)}
                    className="pl-7 font-mono font-bold text-sm"
                    autoFocus
                  />
                </div>

                {/* Cálculo en vivo de Vuelto */}
                {(() => {
                  const montoRec = Number(efectivoRecibido);
                  const vuelto = montoRec >= totalEnviado ? montoRec - totalEnviado : 0;
                  const faltante = montoRec < totalEnviado && efectivoRecibido !== "" ? totalEnviado - montoRec : 0;

                  return (
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-muted-foreground font-medium">Vuelto a entregar:</span>
                      {faltante > 0 ? (
                        <span className="font-bold text-destructive">
                          Faltan {formatMoney(faltante)}
                        </span>
                      ) : (
                        <span className={cn("font-bold text-sm", vuelto > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                          {formatMoney(vuelto)}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCerrarModalOpen(false)}
              disabled={cerrandoComanda}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={cerrarComanda}
              disabled={
                cerrandoComanda ||
                (metodoPagoCierre === "efectivo" && (!efectivoRecibido || Number(efectivoRecibido) < totalEnviado))
              }
              className="gap-1.5 font-bold"
            >
              {cerrandoComanda ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cobrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Pago ({formatMoney(totalEnviado)})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
