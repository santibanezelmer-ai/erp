import type { Metadata } from "next";
import { Shield, Lock, EyeOff, Server, UserCheck, KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidad | Operix ERP",
  description:
    "Política de Privacidad y Tratamiento de Datos Personales y Comerciales en la plataforma Operix ERP conforme a la Ley N° 19.628 de Chile.",
};

export default function PrivacidadPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-xs">
      <div className="border-b border-border pb-6 mb-8">
        <div className="flex items-center gap-2.5 text-emerald-500 mb-2">
          <Shield className="h-6 w-6" />
          <span className="text-xs font-bold uppercase tracking-wider">Protección de Datos</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground m-0">
          Política de Privacidad y Tratamiento de Datos
        </h1>
        <p className="text-sm text-muted-foreground mt-2 mb-0">
          Última actualización: 21 de Octubre de 2026 • En conformidad con la Ley N° 19.628 sobre Protección de la Vida Privada (Chile)
        </p>
      </div>

      <div className="space-y-8 text-foreground/90 text-sm sm:text-base leading-relaxed">
        {/* Sección 1 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            1. Compromiso de Privacidad y Confidencialidad
          </h2>
          <p>
            En <strong>Operix ERP</strong> (operixerp.cloud) entendemos que la información de tu negocio, ventas, clientes y catálogo es el activo más valioso de tu empresa. Por esta razón, asumimos el compromiso inquebrantable de proteger la privacidad, confidencialidad e integridad de todos los datos recopilados a través de nuestra plataforma, cumpliendo rigurosamente con la normativa chilena vigente.
          </p>
        </section>

        {/* Sección 2 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            2. Información que Recopilamos
          </h2>
          <p>Para proporcionar un servicio de gestión integral recopilamos las siguientes categorías de información:</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>
              <strong>Datos de Registro y Cuenta:</strong> Nombre completo, correo electrónico, teléfono de contacto, nombre comercial de la tienda o empresa y RUT o número de identificación tributaria.
            </li>
            <li>
              <strong>Datos de Operación Comercial:</strong> Catálogo de productos, listas de precios, existencias de inventario, registro de proveedores, categorías y movimientos de stock.
            </li>
            <li>
              <strong>Datos Transaccionales:</strong> Registros de ventas efectuadas, comprobantes emitidos, arqueos de caja, métodos de pago utilizados por los clientes finales (efectivo, débito, transferencia) y saldos de créditos o fiados por cobrar.
            </li>
            <li>
              <strong>Datos Técnicos de Navegación:</strong> Dirección IP anonimizada, tipo de navegador, sistema operativo y eventos de diagnóstico para asegurar el rendimiento y resolver fallas técnicas.
            </li>
          </ul>
        </section>

        {/* Sección 3 - Crucial para Mercado Pago y Seguridad */}
        <section>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 my-4">
            <h2 className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 m-0 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              3. Seguridad Financiera y Datos de Pago (Mercado Pago)
            </h2>
            <p className="text-xs sm:text-sm text-foreground/90 mt-2 mb-0">
              <strong>Operix ERP NUNCA almacena ni tiene acceso a los números completos de tus tarjetas de crédito, débito, fechas de vencimiento ni códigos de seguridad (CVV/CVC).</strong>
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 mb-0">
              Todas las transacciones financieras y cobros de suscripción se procesan a través de la pasarela certificada <strong>Mercado Pago</strong> bajo estándares internacionales <strong>PCI-DSS Nivel 1</strong>. Operix ERP únicamente recibe tokens criptográficos y confirmaciones del estado del pago (aprobado, pendiente o rechazado) para habilitar las funcionalidades de tu plan.
            </p>
          </div>
        </section>

        {/* Sección 4 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            4. Finalidad del Tratamiento de Datos
          </h2>
          <p>Los datos recabados son utilizados exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Garantizar la operatividad del sistema de ventas, control de inventario y punto de venta.</li>
            <li>Sincronizar en tiempo real el catálogo web y la recepción de pedidos en línea.</li>
            <li>Procesar cobros, emitir comprobantes de suscripción y gestionar los planes contratados.</li>
            <li>Proporcionar soporte técnico, atención de incidencias y asistencia personalizada.</li>
            <li>Enviar alertas operativas esenciales sobre el estado de la cuenta, seguridad o facturación.</li>
          </ul>
        </section>

        {/* Sección 5 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            5. No Venta ni Comercialización de Datos
          </h2>
          <p className="font-semibold text-foreground">
            Operix ERP no vende, no alquila, no cede ni comercializa bajo ninguna circunstancia las bases de datos de sus usuarios ni la información comercial de sus negocios a agencias de publicidad, corredores de datos ni a terceros no autorizados.
          </p>
          <p className="text-muted-foreground">
            La información únicamente podrá ser compartida con proveedores tecnológicos indispensables para la prestación del servicio (infraestructura en la nube con Supabase/AWS/Google Cloud, procesador de pagos Mercado Pago) bajo estrictas cláusulas de confidencialidad y secreto profesional.
          </p>
        </section>

        {/* Sección 6 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            6. Medidas de Seguridad y Cifrado
          </h2>
          <p>Aplicamos rigurosas medidas técnicas y organizativas para salvaguardar tu información:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li><strong>Cifrado en Tránsito:</strong> Todas las comunicaciones entre tu navegador y nuestros servidores están protegidas mediante certificados SSL/TLS con encriptación HTTPS de 256 bits.</li>
            <li><strong>Cifrado en Reposo:</strong> Las bases de datos se encuentran encriptadas y respaldadas de forma automática.</li>
            <li><strong>Aislamiento de Negocios (RLS):</strong> Implementamos políticas a nivel de fila (<em>Row Level Security</em>) para garantizar que los datos de un negocio sean total e irrevocablemente inaccesibles para otros usuarios del sistema.</li>
          </ul>
        </section>

        {/* Sección 7 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            7. Derechos del Titular (Derechos ARCO)
          </h2>
          <p>
            En virtud de la legislación chilena (Ley N° 19.628), tienes el derecho en todo momento de ejercer tus derechos de:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li><strong>Acceso:</strong> Conocer los datos personales almacenados en tu cuenta.</li>
            <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos o desactualizados.</li>
            <li><strong>Cancelación o Eliminación:</strong> Solicitar la supresión definitiva de tu cuenta y datos cuando desees darte de baja.</li>
            <li><strong>Oposición:</strong> Oponerte al tratamiento de tus datos para finalidades específicas.</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Para ejercer cualquiera de estos derechos, basta con enviar una comunicación formal a nuestro oficial de privacidad a <a href="mailto:privacidad@operixerp.cloud" className="text-primary underline">privacidad@operixerp.cloud</a>.
          </p>
        </section>

        {/* Sección 8 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            8. Uso de Cookies
          </h2>
          <p>
            Utilizamos únicamente cookies estrictamente necesarias para autenticar tu sesión, mantener tus preferencias de navegación y proteger contra ataques de suplantación de identidad (CSRF). No utilizamos cookies de rastreo publicitario invasivo de terceros.
          </p>
        </section>

        {/* Contacto de Privacidad */}
        <div className="bg-muted/40 border border-border rounded-xl p-5 mt-8">
          <h3 className="font-bold text-foreground m-0 text-base">Contacto de Privacidad y Tratamiento de Datos</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-2">
            Si tienes dudas o inquietudes sobre cómo protegemos y gestionamos la información de tu negocio, contáctanos en:
          </p>
          <p className="text-xs sm:text-sm m-0 space-y-1">
            <span className="block font-medium text-foreground">Oficial de Privacidad Operix ERP</span>
            <span className="block text-primary">privacidad@operixerp.cloud</span>
            <span className="block text-muted-foreground">Santiago de Chile, República de Chile</span>
          </p>
        </div>
      </div>
    </article>
  );
}
