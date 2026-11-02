"use client";

import { useState } from "react";
import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  MessageCircle,
  Loader2,
  Truck,
  Store,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CartModal() {
  const {
    isCartOpen,
    closeCart,
    cart,
    updateQty,
    getUnitPrice,
    cartTotal,
    negocio,
  } = useCatalog();

  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"despacho" | "retiro">("despacho");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [metodoPago, setMetodoPago] = useState<"transferencia" | "efectivo" | "tarjeta">("transferencia");
  const [notasPedido, setNotasPedido] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio || cart.length === 0) return;

    if (!clienteNombre.trim() || !clienteTelefono.trim()) {
      toast.error("Por favor ingresa tu nombre y teléfono de contacto");
      return;
    }

    if (tipoEntrega === "despacho" && !direccionEntrega.trim()) {
      toast.error("Por favor ingresa tu dirección para el despacho");
      return;
    }

    setEnviando(true);
    const supabase = createClient();

    try {
      const itemsPayload = cart.map((i) => {
        const unitPrice = getUnitPrice(i.producto, i.variante);
        const nom = i.variante
          ? `${i.producto.nombre} (${i.variante.nombre})`
          : i.producto.nombre;
        return {
          producto_id: i.producto.id,
          variante_id: i.variante?.id || null,
          nombre: nom,
          qty: i.qty,
          precio: unitPrice,
          subtotal: i.qty * unitPrice,
        };
      });

      const pagoEtiqueta =
        metodoPago === "transferencia"
          ? "Transferencia Bancaria"
          : metodoPago === "efectivo"
          ? "Efectivo al recibir"
          : "Tarjeta / Débito";

      const entregaEtiqueta =
        tipoEntrega === "despacho"
          ? `Despacho a Domicilio (${direccionEntrega.trim()})`
          : "Retiro en Local";

      const notasConsolidadas = [
        `Entrega: ${entregaEtiqueta}`,
        `Pago: ${pagoEtiqueta}`,
        notasPedido.trim() ? `Nota: ${notasPedido.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      // 1. Guardar en Supabase
      await supabase.from("pedidos_whatsapp").insert({
        negocio_id: negocio.id,
        cliente_nombre: clienteNombre.trim(),
        cliente_telefono: clienteTelefono.trim(),
        notas: notasConsolidadas,
        total: cartTotal,
        items: itemsPayload as any,
        estado: "pendiente",
      });

      // 2. Construir mensaje estructurado para WhatsApp
      let msg = `🛍️ *NUEVO PEDIDO - ${negocio.nombre}*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `👤 *Cliente:* ${clienteNombre.trim()}\n`;
      msg += `📱 *Teléfono:* ${clienteTelefono.trim()}\n`;
      msg += `📦 *Modalidad:* ${tipoEntrega === "despacho" ? "🛵 Despacho a Domicilio" : "🏬 Retiro en Tienda / Local"}\n`;

      if (tipoEntrega === "despacho") {
        msg += `📍 *Dirección de Entrega:* ${direccionEntrega.trim()}\n`;
      }
      msg += `💳 *Medio de Pago:* ${pagoEtiqueta}\n\n`;

      msg += `🛒 *DETALLE DEL PEDIDO:*\n`;
      cart.forEach((i) => {
        const nom = i.variante
          ? `${i.producto.nombre} (${i.variante.nombre})`
          : i.producto.nombre;
        const unitPrice = getUnitPrice(i.producto, i.variante);
        msg += `• ${i.qty}× ${nom} → *${formatMoney(i.qty * unitPrice)}*\n`;
      });

      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `💰 *TOTAL A PAGAR:* ${formatMoney(cartTotal)}\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (notasPedido.trim()) {
        msg += `📝 *Observaciones:* ${notasPedido.trim()}\n\n`;
      }

      msg += `_Pedido realizado desde la tienda online oficial (operixerp.cloud/c/${negocio.slug})_`;

      const telNegocio = (negocio as any).telefono || "";
      const waUrl = telNegocio
        ? `https://wa.me/${telNegocio.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

      window.open(waUrl, "_blank");

      toast.success("¡Pedido generado! Abriendo WhatsApp...");
      closeCart();
      setClienteNombre("");
      setClienteTelefono("");
      setDireccionEntrega("");
      setNotasPedido("");
    } catch (err: any) {
      toast.error(err.message || "Error al procesar pedido");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={isCartOpen} onOpenChange={(open) => !open && closeCart()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span>Tu Carrito de Compras ({cart.reduce((a, b) => a + b.qty, 0)})</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Revisa tus productos y envía el pedido directamente por WhatsApp para coordinar el pago y despacho.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Tu carrito está vacío. Agrega productos para comenzar.
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => {
                const unitPrice = getUnitPrice(item.producto, item.variante);
                const itemSubtotal = item.qty * unitPrice;
                const img = item.variante?.imagen_url || item.producto.imagen_url;

                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/60"
                  >
                    <div className="h-14 w-14 rounded-lg bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                      {img ? (
                        <img
                          src={img}
                          alt={item.producto.nombre}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-xs sm:text-sm text-foreground truncate">
                        {item.producto.nombre}
                      </h4>
                      {item.variante && (
                        <span className="text-[11px] text-primary font-medium block truncate">
                          Variante: {item.variante.nombre}
                        </span>
                      )}
                      <div className="text-xs font-bold text-foreground mt-0.5">
                        {formatMoney(unitPrice)}{" "}
                        <span className="text-[10px] text-muted-foreground font-normal">c/u</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 rounded-md"
                        onClick={() => updateQty(item.key, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 rounded-md"
                        onClick={() => updateQty(item.key, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="text-right shrink-0 w-20">
                      <div className="text-xs font-black text-foreground">
                        {formatMoney(itemSubtotal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cart.length > 0 && (
            <form id="wa-order-form" onSubmit={handleSubmit} className="pt-4 border-t border-border space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Modalidad de Entrega
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoEntrega("despacho")}
                    className={cn(
                      "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      tipoEntrega === "despacho"
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border bg-card/60 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Truck className="h-4 w-4" />
                    <span>Despacho a Domicilio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoEntrega("retiro")}
                    className={cn(
                      "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      tipoEntrega === "retiro"
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border bg-card/60 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Store className="h-4 w-4" />
                    <span>Retiro en Tienda</span>
                  </button>
                </div>
              </div>

              {/* Datos del Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="clienteNombre" className="text-xs font-semibold">
                    Tu Nombre *
                  </Label>
                  <Input
                    id="clienteNombre"
                    placeholder="Ej: Camila Soto"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clienteTelefono" className="text-xs font-semibold">
                    Tu Teléfono WhatsApp *
                  </Label>
                  <Input
                    id="clienteTelefono"
                    placeholder="+56 9 1234 5678"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Dirección si es despacho o aviso si es retiro */}
              {tipoEntrega === "despacho" ? (
                <div className="space-y-1">
                  <Label htmlFor="direccionEntrega" className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>Dirección de Entrega *</span>
                  </Label>
                  <Input
                    id="direccionEntrega"
                    placeholder="Calle, Número, Depto / Casa, Comuna"
                    value={direccionEntrega}
                    onChange={(e) => setDireccionEntrega(e.target.value)}
                    required={tipoEntrega === "despacho"}
                    className="h-9 text-xs"
                  />
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-border bg-muted/30 text-xs flex items-start gap-2.5">
                  <Store className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground block">Punto de Retiro:</span>
                    <span className="text-muted-foreground text-[11px]">
                      {(negocio as any).direccion || "Local comercial del negocio"}. Coordinaremos la entrega contigo por WhatsApp.
                    </span>
                  </div>
                </div>
              )}

              {/* Medio de Pago Preferido */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Medio de Pago Preferido
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "transferencia", label: "Transferencia", icon: ArrowRightLeft },
                    { id: "efectivo", label: "Efectivo", icon: Banknote },
                    { id: "tarjeta", label: "Tarjeta", icon: CreditCard },
                  ].map((p) => {
                    const Icon = p.icon;
                    const isSelected = metodoPago === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setMetodoPago(p.id as any)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : "border-border bg-card/60 text-muted-foreground hover:bg-muted/40"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notas opcionales */}
              <div className="space-y-1">
                <Label htmlFor="notasPedido" className="text-xs text-muted-foreground">
                  Notas u observaciones adicionales (opcional)
                </Label>
                <Input
                  id="notasPedido"
                  placeholder="Ej: Tocar timbre 202, dejar en conserjería..."
                  value={notasPedido}
                  onChange={(e) => setNotasPedido(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </form>
          )}
        </div>

        {cart.length > 0 && (
          <DialogFooter className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-auto text-left">
              <span className="text-[11px] text-muted-foreground block">Total a Pagar</span>
              <span className="text-xl font-black text-foreground">{formatMoney(cartTotal)}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeCart}
                className="text-xs"
              >
                Seguir Comprando
              </Button>
              <Button
                type="submit"
                form="wa-order-form"
                disabled={enviando}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-5 shadow-sm"
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" />
                    Pedir por WhatsApp
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
