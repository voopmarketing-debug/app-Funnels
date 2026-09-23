import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";

const LAST_UPDATED = "22 de septiembre de 2026";

export const metadata = {
  title: "Política de privacidad — Funnels Labs",
};

export default function PrivacyPolicyPage() {
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
            <h1 className="text-2xl font-bold text-ink">Política de privacidad</h1>
            <p className="text-sm text-ink-muted">Última actualización: {LAST_UPDATED}</p>
          </div>

          <p className="text-sm leading-relaxed text-ink">
            Esta política explica qué información recolecta Funnels Labs, para qué la usamos, y con quién la
            compartimos al operar la plataforma de agentes de inteligencia artificial que responden por WhatsApp
            en nombre de las empresas que la contratan.
          </p>

          <Section title="1. Quiénes somos">
            <p>
              Funnels Labs es una plataforma que permite a negocios (nuestros &quot;clientes&quot;) conectar un
              número de WhatsApp Business a un agente de inteligencia artificial que responde automáticamente a
              sus propios clientes finales (los &quot;usuarios finales&quot;). Actuamos como proveedor de
              tecnología para ese cliente, quien decide qué negocio opera y qué información recibe de sus propios
              contactos.
            </p>
          </Section>

          <Section title="2. Qué información recolectamos">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Datos de la cuenta:</strong> nombre, correo, contraseña (cifrada) y datos del negocio que
                un cliente registra al crear su cuenta en Funnels Labs.
              </li>
              <li>
                <strong>Credenciales de WhatsApp Business:</strong> el Phone Number ID, el ID de la cuenta de
                WhatsApp Business (WABA) y el token de acceso que cada cliente conecta desde su propia cuenta de
                Meta — el token se guarda cifrado.
              </li>
              <li>
                <strong>Mensajes de WhatsApp:</strong> el contenido de las conversaciones entre el agente de IA
                (o el equipo del cliente) y los usuarios finales que le escriben al número conectado —
                incluyendo texto, imágenes, documentos y notas de voz que se envíen o reciban.
              </li>
              <li>
                <strong>Datos de contacto de usuarios finales:</strong> el número de teléfono y nombre de
                perfil de WhatsApp de cada persona que escribe al número del cliente, junto con la información
                que esa persona comparta voluntariamente en la conversación (por ejemplo, al agendar una cita).
              </li>
              <li>
                <strong>Datos de uso de la plataforma:</strong> estadísticas de conversaciones, tasas de
                respuesta y uso del panel, para mostrarle a cada cliente sus propias métricas.
              </li>
            </ul>
          </Section>

          <Section title="3. Cómo usamos la información">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Para operar el agente de IA: generar respuestas automáticas basadas en el historial de la conversación y la configuración que cada cliente le da a su agente.</li>
              <li>Para transcribir notas de voz entrantes y generar notas de voz de salida, cuando esa función está activada.</li>
              <li>Para mostrarle a cada cliente el panel de conversaciones, métricas y gestión de contactos (CRM) de su propio negocio.</li>
              <li>Para notificaciones operativas: alertas de citas agendadas, cambios de métricas, o avisos sobre el estado del plan contratado.</li>
              <li>Para procesar pagos y activar cuentas cuando un cliente compra un plan.</li>
            </ul>
            <p className="mt-2">
              No usamos las conversaciones de los usuarios finales para entrenar modelos de inteligencia
              artificial ni las vendemos a terceros.
            </p>
          </Section>

          <Section title="4. Con quién compartimos información">
            <p>Para poder funcionar, la plataforma envía datos a estos proveedores, únicamente para prestar el servicio:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong>Meta / WhatsApp Business Platform:</strong> para enviar y recibir los mensajes de WhatsApp a través del número que cada cliente conecta.</li>
              <li><strong>Anthropic (Claude):</strong> para generar el texto de las respuestas del agente de IA a partir del historial de la conversación.</li>
              <li><strong>OpenAI:</strong> para transcribir notas de voz entrantes y generar las notas de voz de las respuestas, cuando esa función está activa.</li>
              <li><strong>Proveedores de infraestructura</strong> (hosting, base de datos y almacenamiento de archivos) que alojan la plataforma y los archivos adjuntos de las conversaciones.</li>
              <li><strong>Procesador de pagos</strong> utilizado para cobrar las suscripciones de los clientes.</li>
            </ul>
            <p className="mt-2">No compartimos esta información con terceros para fines publicitarios.</p>
          </Section>

          <Section title="5. Cuánto tiempo conservamos la información">
            <p>
              Conservamos los datos de la cuenta y las conversaciones mientras el cliente mantenga su cuenta
              activa en Funnels Labs. Si un cliente cancela su plan o solicita la eliminación de su cuenta,
              eliminamos su información dentro de un plazo razonable, salvo que la ley exija conservar algún
              registro por más tiempo (por ejemplo, comprobantes de pago).
            </p>
          </Section>

          <Section title="6. Seguridad">
            <p>
              Los tokens de acceso a WhatsApp y las contraseñas se almacenan cifrados. El acceso al panel
              requiere inicio de sesión, y cada cliente solo puede ver la información de su propio negocio (o de
              los negocios de sus clientes, en el caso de agencias que administran varias cuentas).
            </p>
          </Section>

          <Section title="7. Tus derechos">
            <p>
              Si eres cliente de Funnels Labs, puedes acceder, corregir o eliminar los datos de tu cuenta desde
              tu propio panel, o solicitándolo por los medios de contacto abajo. Si eres un usuario final que le
              escribió a un negocio que usa Funnels Labs, tus datos los administra ese negocio — puedes
              contactarlo directamente a él, o escribirnos y te dirigimos con el negocio correspondiente.
            </p>
          </Section>

          <Section title="8. Cambios a esta política">
            <p>
              Podemos actualizar esta política cuando cambien nuestras prácticas o los servicios que usamos.
              Publicaremos cualquier cambio en esta misma página con la fecha de actualización correspondiente.
            </p>
          </Section>

          <Section title="9. Contacto">
            <p>
              Para preguntas sobre esta política o el manejo de tus datos, escríbenos por WhatsApp:{" "}
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
