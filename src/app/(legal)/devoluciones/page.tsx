import type { Metadata } from "next";
import { RotateCcw, CheckCircle2, AlertCircle, Clock, CreditCard, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Devoluciones y Cancelación | Operix ERP",
  description:
    "Política clara de reembolsos, garantía de satisfacción de 7 días y cancelación de suscripciones en Operix ERP.",
};

export default function DevolucionesPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-xs">
      <div className="border-b border-border pb-6 mb-8">
        <div className="flex items-center gap-2.5 text-amber-500 mb-2">
          <RotateCcw className="h-6 w-6" />
          <span className="text-xs font-bold uppercase tracking-wider">Políticas Comerciales</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground m-0">
          Política de Devoluciones, Reembolsos y Cancelación
        </h1>
        <p className="text-sm text-muted-foreground mt-2 mb-0">
          Última actualización: 21 de Octubre de 2026 • Garantía de transparencia para usuarios y suscriptores
        </p>
      </div>

      <div className="space-y-8 text-foreground/90 text-sm sm:text-base leading-relaxed">
        {/* Banner de Garantía */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 my-2">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 m-0">
                Garantía de Satisfacción de 7 Días
              </h2>
              <p className="text-xs sm:text-sm text-foreground/90 mt-1 mb-0">
                Queremos que pruebes Operix ERP con total tranquilidad. Si contratas por primera vez cualquiera de nuestros planes de pago (Básico o Pro) y la plataforma no cumple con tus expectativas operativas, tienes <strong>7 días corridos desde tu pago inicial</strong> para solicitar el <strong>reembolso íntegro del 100%</strong> de tu dinero, sin preguntas ni trabas.
              </p>
            </div>
          </div>
        </div>

        {/* Sección 1 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            1. Modelo de Suscripción del Software (SaaS)
          </h2>
          <p>
            Operix ERP opera como un servicio de software basado en la nube con cobro recurrente por adelantado. Las suscripciones pueden ser contratadas bajo dos modalidades:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li><strong>Mensual:</strong> Facturación recurrente cada 30 días calendario.</li>
            <li><strong>Anual:</strong> Facturación anual anticipada con beneficio de 2 meses gratis (descuento promocional).</li>
          </ul>
        </section>

        {/* Sección 2 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            2. Cancelación de la Suscripción en Cualquier Momento
          </h2>
          <p>
            Creemos en la libertad comercial de nuestros clientes. En Operix ERP <strong>no existen contratos forzosos de permanencia ni cláusulas de penalización por desvinculación</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              <strong>Cómo cancelar:</strong> Puedes solicitar la cancelación de la renovación automática de tu plan en cualquier momento desde tu panel de usuario o comunicándote con nuestro equipo de soporte.
            </li>
            <li>
              <strong>Período activo:</strong> Al cancelar la suscripción, continuarás disfrutando de todos los beneficios de tu plan (Básico o Pro) hasta el último día del período que ya fue pagado.
            </li>
            <li>
              <strong>No se generarán cobros futuros:</strong> Una vez finalizado el ciclo facturado, la suscripción se dará por terminada sin que se realice ningún cargo adicional a tu tarjeta o cuenta de Mercado Pago.
            </li>
            <li>
              <strong>Conservación de tus datos:</strong> Tu negocio pasará automáticamente al plan gratuito. Tu información comercial (ventas pasadas, inventario, clientes) no será eliminada, por lo que podrás seguir consultándola o reactivar tu plan cuando lo requieras.
            </li>
          </ul>
        </section>

        {/* Sección 3 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            3. Condiciones y Excepciones para Reembolsos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div className="p-4 rounded-xl border border-border bg-muted/30">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5 m-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Situaciones con Derecho a Reembolso
              </h3>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1.5 pl-4 list-disc">
                <li>Solicitud enviada dentro de los primeros 7 días corridos de la primera contratación (Garantía de Satisfacción).</li>
                <li>Cobros dobles o duplicados por fallas técnicas en la pasarela de pagos.</li>
                <li>Cobros efectuados con posterioridad a una solicitud formal de cancelación confirmada.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/30">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5 m-0">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Situaciones No Sujetas a Reembolso
              </h3>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1.5 pl-4 list-disc">
                <li>Suscripciones mensuales que ya han superado la ventana inicial de 7 días del primer ciclo.</li>
                <li>Períodos mensuales pasados ya utilizados y consumidos por el cliente.</li>
                <li>Reembolsos proporcionales de planes anuales solicitados después de vencida la garantía de 7 días.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Sección 4 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            4. Procedimiento para Solicitar un Reembolso
          </h2>
          <p>
            Para tramitar una solicitud de devolución por garantía o cobro duplicado, sigue estos simples pasos:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
            <li>
              Envía un correo electrónico a <a href="mailto:pagos@operixerp.cloud" className="text-primary underline">pagos@operixerp.cloud</a> con copia a <a href="mailto:soporte@operixerp.cloud" className="text-primary underline">soporte@operixerp.cloud</a>, o escríbenos directamente a nuestro canal de soporte en WhatsApp.
            </li>
            <li>
              Indica en el asunto: <em>&quot;Solicitud de Reembolso - [Nombre de tu Negocio]&quot;</em>.
            </li>
            <li>
              Adjunta en el mensaje:
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>RUT o correo electrónico con el que te registraste en Operix ERP.</li>
                <li>Comprobante digital o número de operación de Mercado Pago.</li>
                <li>Motivo de la solicitud (para ayudarnos a mejorar nuestro servicio).</li>
              </ul>
            </li>
          </ol>
        </section>

        {/* Sección 5 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            5. Plazos y Métodos de Devolución del Dinero
          </h2>
          <p>
            Una vez recibida la solicitud y verificados los requisitos:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li><strong>Tiempo de respuesta:</strong> Nuestro equipo procesará y responderá a tu requerimiento en un plazo máximo de <strong>48 a 72 horas hábiles</strong>.</li>
            <li>
              <strong>Medio de acreditación:</strong> El reembolso se emite a través de la pasarela oficial <strong>Mercado Pago</strong> directamente hacia el mismo medio de pago con el que realizaste la compra (tarjeta de crédito, débito o dinero en cuenta).
            </li>
            <li>
              <strong>Reflejo bancario:</strong> Dependiendo de la entidad bancaria o emisor de tu tarjeta en Chile, los fondos suelen verse reflejados en tu extracto en un plazo de 1 a 10 días hábiles.
            </li>
          </ul>
        </section>

        {/* Bloque de Contacto */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mt-8">
          <h3 className="font-bold text-foreground m-0 text-base">Atención directa para pagos y facturación</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-2">
            Si presentas cualquier inconveniente con tu cobro o necesitas asistencia inmediata, nuestro equipo de soporte financiero está a tu disposición:
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <a
              href="mailto:pagos@operixerp.cloud"
              className="text-primary font-semibold underline inline-flex items-center gap-1.5"
            >
              pagos@operixerp.cloud
            </a>
            <span className="text-muted-foreground">•</span>
            <a
              href="mailto:soporte@operixerp.cloud"
              className="text-primary font-semibold underline inline-flex items-center gap-1.5"
            >
              soporte@operixerp.cloud
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
