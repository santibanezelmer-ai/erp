"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  pregunta: string;
  respuesta: string;
}

const FAQS: FaqItem[] = [
  {
    pregunta: "¿Necesito comprar computadores o equipos caros para usar Operix ERP?",
    respuesta:
      "No. Operix ERP es 100% en la nube y funciona en cualquier computador convencional, notebook, tablet Android/iPad o teléfono móvil moderno con navegador web. Además, es compatible con lectores de código de barras USB/Bluetooth e impresoras térmicas estándar de 58mm y 80mm.",
  },
  {
    pregunta: "¿Cómo funciona la garantía de satisfacción de 7 días?",
    respuesta:
      "Si contratas por primera vez cualquiera de nuestros planes de pago (Básico o Pro) y la plataforma no cumple tus expectativas operativas, puedes solicitar el reembolso íntegro del 100% de tu dinero durante los primeros 7 días posteriores a tu pago, sin preguntas ni complicaciones.",
  },
  {
    pregunta: "¿Existen contratos de permanencia forzada o multas de salida?",
    respuesta:
      "Ninguno. Puedes darte de baja en cualquier momento directamente desde tu panel o comunicándote con nuestro equipo de soporte. Tu servicio continuará activo hasta el último día del período ya pagado y luego pasará al plan gratuito sin borrar tu historial comercial.",
  },
  {
    pregunta: "¿Puedo importar mis productos si actualmente uso una planilla Excel?",
    respuesta:
      "Sí. Operix cuenta con un asistente de importación y exportación masiva en formato Excel (.xlsx). Puedes subir cientos o miles de productos con sus códigos de barra, precios y stock en pocos segundos.",
  },
  {
    pregunta: "¿Cómo funciona el catálogo online y los pedidos por WhatsApp?",
    respuesta:
      "Tu negocio obtiene una tienda web pública optimizada para celulares (ej: operixerp.cloud/c/tu-tienda) con tu logotipo oficial. Tus clientes pueden revisar productos, agregar ítems a un carrito de compra y enviarte el pedido detallado directamente a tu WhatsApp comercial listo para preparar y despachar.",
  },
  {
    pregunta: "¿Qué medios de pago puedo registrar en mis ventas de punto de venta (POS)?",
    respuesta:
      "El punto de venta permite registrar transacciones en Efectivo (con cálculo automático de vuelto), Débito/Crédito (Transbank, SumUp, Getnet, Mercado Pago Point), Transferencias Bancarias y Fiados (crédito al cliente), con arqueos de caja ciegos para evitar descuadres entre turnos.",
  },
];

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 w-full max-w-4xl mx-auto scroll-mt-20">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold mb-3">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Resolvemos tus dudas</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          Preguntas Frecuentes
        </h2>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground">
          Todo lo que necesitas saber antes de empezar a operar con Operix ERP.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="border border-border rounded-xl bg-card overflow-hidden transition-all shadow-xs"
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                className="w-full p-4 sm:p-5 text-left font-semibold text-sm sm:text-base text-foreground flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <span>{item.pregunta}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-primary" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40">
                  {item.respuesta}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
