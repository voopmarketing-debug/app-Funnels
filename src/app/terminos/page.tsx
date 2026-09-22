import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

const SUPPORT_WHATSAPP_LINK = "https://wa.me/message/F2RWC3YUI7EYM1";
const LAST_UPDATED = "22 de septiembre de 2026";

export const metadata = {
  title: "Condiciones del servicio — Funnels Labs",
};

export default function TermsOfServicePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-2xl px-6 py-12">
        <Link href="/" className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
        </Link>

        <div className="fl-card-hero mt-8 space-y-8 p-7">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-ink">Condiciones del servicio</h1>
            <p className="text-sm text-ink-muted">Última actualización: {LAST_UPDATED}</p>
          </div>

          <p className="text-sm leading-relaxed text-ink">
            Al crear una cuenta o usar la plataforma Funnels Labs, aceptas estas condiciones. Si estás usando
            Funnels Labs en nombre de una empresa, aceptas estas condiciones en representación de esa empresa.
          </p>

          <Section title="1. Qué es Funnels Labs">
            <p>
              Funnels Labs es una plataforma que conecta un número de WhatsApp Business a un agente de
              inteligencia artificial configurable, junto con un panel de gestión de conversaciones (CRM),
              métricas, plantillas de mensajes y un generador de sitios web para el negocio del cliente.
            </p>
          </Section>

          <Section title="2. Cuentas y planes">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Eres responsable de mantener segura tu contraseña y de la actividad que ocurra en tu cuenta.</li>
              <li>Cada plan tiene límites de uso (por ejemplo, contactos activos por mes o números de WhatsApp conectados) — puedes ver los tuyos en el panel.</li>
              <li>Si superas el límite de tu plan, el agente de IA puede pausarse automáticamente en las conversaciones nuevas hasta que actualices de plan o un humano tome el control.</li>
              <li>Puedes cancelar tu suscripción cuando quieras; el acceso se mantiene activo hasta el final del periodo ya pagado.</li>
            </ul>
          </Section>

          <Section title="3. Tu responsabilidad sobre el contenido y el uso del agente">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Tú configuras qué dice tu agente de IA (tono, instrucciones, información del negocio) y eres responsable del contenido que le indiques que use.</li>
              <li>Debes usar el número de WhatsApp conectado y el agente de forma legal, sin enviar spam, contenido engañoso, o mensajes no solicitados a personas que no han interactuado con tu negocio.</li>
              <li>Eres responsable de cumplir con las políticas comerciales de WhatsApp/Meta para el número que conectas — Funnels Labs no controla si Meta aprueba, suspende o restringe tu número.</li>
              <li>Debes obtener el consentimiento correspondiente de tus propios clientes finales antes de comunicarte con ellos por WhatsApp, según lo exija la ley aplicable a tu negocio.</li>
            </ul>
          </Section>

          <Section title="4. Servicios de terceros">
            <p>
              El agente de IA funciona apoyándose en modelos de Anthropic (Claude) y, para notas de voz, en
              servicios de OpenAI; el envío y recepción de mensajes ocurre a través de la API de WhatsApp
              Business de Meta. La disponibilidad de Funnels Labs depende de la disponibilidad de estos
              servicios externos — una interrupción de alguno de ellos puede afectar temporalmente el
              funcionamiento del agente, sin que esto dependa de nosotros.
            </p>
          </Section>

          <Section title="5. Límites de responsabilidad">
            <p>
              El agente de IA genera respuestas automáticas y puede cometer errores o dar información
              imprecisa. Eres responsable de revisar la configuración de tu agente y de supervisar las
              conversaciones que consideres importantes. Funnels Labs no se hace responsable por decisiones
              comerciales tomadas con base en una respuesta generada por el agente, ni por pérdidas derivadas de
              una interrupción del servicio de WhatsApp, Anthropic u OpenAI.
            </p>
          </Section>

          <Section title="6. Suspensión de la cuenta">
            <p>
              Podemos suspender o cancelar el acceso a una cuenta que incumpla estas condiciones, use la
              plataforma para actividades ilegales, o ponga en riesgo la operación del servicio para otros
              clientes.
            </p>
          </Section>

          <Section title="7. Cambios a estas condiciones">
            <p>
              Podemos actualizar estas condiciones cuando cambien nuestros servicios. Publicaremos cualquier
              cambio en esta misma página con la fecha de actualización correspondiente.
            </p>
          </Section>

          <Section title="8. Contacto">
            <p>
              Para preguntas sobre estas condiciones, escríbenos por WhatsApp:{" "}
              <a
                href={SUPPORT_WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {SUPPORT_WHATSAPP_LINK}
              </a>
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <div className="text-sm leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}
