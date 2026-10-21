import type { Metadata } from "next";
import { FileText, ShieldAlert, CheckCircle, Scale, Globe, CreditCard } from "lucide-react";

export const metadata: Metadata = {
  title: "Términos y Condiciones de Uso | Operix ERP",
  description:
    "Términos y Condiciones Generales de Uso del Software como Servicio (SaaS) Operix ERP.",
};

export default function TerminosPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-xs">
      <div className="border-b border-border pb-6 mb-8">
        <div className="flex items-center gap-2.5 text-primary mb-2">
          <FileText className="h-6 w-6" />
          <span className="text-xs font-bold uppercase tracking-wider">Marco Contractual</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground m-0">
          Términos y Condiciones de Uso
        </h1>
        <p className="text-sm text-muted-foreground mt-2 mb-0">
          Última actualización: 21 de Octubre de 2026 • Válido para la República de Chile y usuarios internacionales
        </p>
      </div>

      <div className="space-y-8 text-foreground/90 text-sm sm:text-base leading-relaxed">
        {/* Sección 1 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            1. Aceptación de los Términos
          </h2>
          <p>
            Bienvenido a <strong>Operix ERP</strong> (en adelante, la &quot;Plataforma&quot; o el &quot;Servicio&quot;), accesible a través del sitio web{" "}
            <a href="https://operixerp.cloud" className="text-primary underline">https://operixerp.cloud</a> y sus subdominios asociados.
          </p>
          <p>
            El acceso, registro, navegación o utilización de cualquiera de las herramientas y servicios provistos por Operix ERP implica la aceptación plena, expresa y sin reservas de la totalidad de los presentes Términos y Condiciones. Si el usuario no está de acuerdo con alguna de las cláusulas aquí estipuladas, deberá abstenerse de utilizar la Plataforma.
          </p>
        </section>

        {/* Sección 2 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            2. Descripción del Servicio (SaaS)
          </h2>
          <p>
            Operix ERP es un software provisto bajo la modalidad de Software como Servicio (<em>Software as a Service - SaaS</em>), diseñado para facilitar la administración comercial y operacional de micro, pequeñas y medianas empresas. Entre sus funciones principales se incluyen:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Punto de Venta (POS) rápido y adaptable para retail, minimarkets y gastronomía.</li>
            <li>Control y descuento atómico de stock e inventario multi-sucursal.</li>
            <li>Gestión de clientes, historial de compras, créditos y deudas (fiados).</li>
            <li>Catálogos web interactivos y pedidos en línea con sincronización en tiempo real.</li>
            <li>Comandas de cocina digitales y administración de mesas para locales de comida.</li>
            <li>Arqueos de caja, reportes de recaudación y exportación de información comercial.</li>
          </ul>
        </section>

        {/* Sección 3 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            3. Registro, Cuentas y Seguridad
          </h2>
          <p>
            Para acceder a las funciones del ERP, el usuario debe crear una cuenta proporcionando información verídica, actualizada y completa (incluyendo nombre comercial, RUT o identificador tributario y correo electrónico de contacto).
          </p>
          <div className="bg-muted/40 border border-border rounded-xl p-4 my-3 text-xs sm:text-sm">
            <p className="font-semibold text-foreground mb-1">Responsabilidad sobre las credenciales:</p>
            El titular de la cuenta es el único responsable de preservar la confidencialidad de su contraseña y de las acciones realizadas por los colaboradores a quienes otorgue roles de acceso (Cajero, Mozo, Cocinero, Administrador). Operix ERP no será responsable por pérdidas originadas por negligencia en la custodia de claves.
          </div>
        </section>

        {/* Sección 4 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            4. Planes, Tarifas y Pasarela de Pago (Mercado Pago)
          </h2>
          <p>
            Operix ERP ofrece un plan de inicio gratuito y planes de suscripción de pago (<strong>Plan Básico</strong> y <strong>Plan Pro</strong>), con opciones de facturación mensual y anual:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li><strong>Moneda y Precios:</strong> Todas las tarifas están expresadas en Pesos Chilenos (CLP).</li>
            <li>
              <strong>Procesamiento Seguro:</strong> Los pagos y cobros recurrentes de suscripciones se procesan a través de la pasarela de pagos oficial <strong>Mercado Pago</strong> (MercadoLibre Chile Ltda.), certificada bajo los más altos estándares internacionales de seguridad PCI-DSS.
            </li>
            <li>
              <strong>Renovación Automática:</strong> Las suscripciones se renuevan de manera automática al término de cada ciclo (mensual o anual) salvo que el usuario solicite la cancelación con anterioridad.
            </li>
            <li>
              <strong>Sin Contratos de Amarre:</strong> El usuario puede cancelar su suscripción en cualquier momento sin multas ni cobros de desvinculación, rigiéndose por nuestra <a href="/devoluciones" className="text-primary underline">Política de Devoluciones y Cancelación</a>.
            </li>
          </ul>
        </section>

        {/* Sección 5 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            5. Propiedad de los Datos y Propiedad Intelectual
          </h2>
          <div className="space-y-2">
            <p>
              <strong>Tus datos te pertenecen:</strong> El usuario es el dueño absoluto de toda la información cargada en el sistema, incluidos productos, precios, listas de clientes, registros de deudas y transacciones de venta. Operix ERP no comercializa ni arrienda la información comercial de sus usuarios.
            </p>
            <p>
              <strong>Propiedad del Software:</strong> La plataforma, marcas comerciales, código fuente, logotipos, interfaces gráficas y algoritmos de Operix ERP son de exclusiva propiedad intelectual de Operix y sus fundadores, protegidos por las leyes de propiedad intelectual e industrial de Chile y tratados internacionales.
            </p>
          </div>
        </section>

        {/* Sección 6 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            6. Disponibilidad del Servicio y Soporte
          </h2>
          <p>
            Nos esforzamos por ofrecer una disponibilidad de servicio superior al 99.5%. No obstante, el servicio puede verse temporalmente interrumpido por mantenciones preventivas programadas, actualizaciones críticas o causas de fuerza mayor imputables a proveedores de telecomunicaciones o infraestructura en la nube global.
          </p>
        </section>

        {/* Sección 7 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            7. Uso Aceptable y Prohibiciones
          </h2>
          <p>Queda estrictamente prohibido a los usuarios:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Utilizar la plataforma para fines ilícitos o contrarios al ordenamiento jurídico chileno.</li>
            <li>Vulnerar o intentar vulnerar la seguridad, autenticación o integridad de los servidores y bases de datos.</li>
            <li>Realizar ingeniería inversa, descompilar o extraer el código fuente de la plataforma.</li>
            <li>Sobrecargar deliberadamente la infraestructura mediante ataques de denegación de servicio (DDoS) o scraping abusivo.</li>
          </ul>
        </section>

        {/* Sección 8 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            8. Modificaciones de los Términos
          </h2>
          <p>
            Operix ERP se reserva el derecho de modificar o actualizar estos Términos y Condiciones en cualquier momento para reflejar cambios legales o mejoras en la plataforma. Las modificaciones sustanciales serán notificadas a través de la interfaz del sistema o mediante correo electrónico.
          </p>
        </section>

        {/* Sección 9 */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            9. Legislación Aplicable y Jurisdicción
          </h2>
          <p>
            Estos Términos y Condiciones se rigen e interpretan de conformidad con las leyes de la <strong>República de Chile</strong>. Cualquier controversia, discrepancia o reclamación que derive de su interpretación o ejecución será sometida a la jurisdicción de los tribunales ordinarios de justicia de la ciudad de Santiago de Chile.
          </p>
        </section>

        {/* Canal de Contacto */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mt-8">
          <h3 className="font-bold text-foreground m-0 text-base">¿Tienes consultas legales o contractuales?</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-2">
            Escríbenos directamente a nuestro canal oficial de soporte y atención al cliente:
          </p>
          <a
            href="mailto:soporte@operixerp.cloud"
            className="text-primary font-semibold text-sm underline inline-flex items-center gap-1.5"
          >
            soporte@operixerp.cloud
          </a>
        </div>
      </div>
    </article>
  );
}
