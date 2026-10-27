import Link from "next/link";
import type { Metadata } from "next";
import { Callout, Chip, OpenLink, Step, Steps, Trouble } from "../businesses/[id]/WhatsAppGuide";
import { AGENDA_CALL_URL, supportWhatsAppLink } from "@/lib/constants";

export const metadata: Metadata = { title: "Guía para conectar WhatsApp" };

const CASES = [
  { href: "#otra-plataforma", title: "Ya tengo WhatsApp API", text: "Lo uso en otra plataforma y quiero traerlo aquí." },
  { href: "#desde-cero", title: "Empiezo desde cero", text: "Aún no tengo cuenta de WhatsApp Business ni número." },
];

// One page, one job: take someone from "no sé qué hacer" to a connected number.
// Short sentences, Meta's own button names in chips, the full detail only here
// so the connect dialog itself can stay a single button.
export default function WhatsAppGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      <header className="space-y-3">
        <Link href="/dashboard" className="text-sm font-semibold text-ink-muted hover:text-ink">
          ← Volver al panel
        </Link>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Conecta tu WhatsApp, paso a paso</h1>
        <p className="max-w-prose text-ink-muted">Elige tu caso. En los dos, lo importante lo hace Meta en una ventana: tú solo sigues sus pantallas.</p>
        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          {CASES.map((c) => (
            <a key={c.href} href={c.href} className="rounded-2xl border border-border p-4 transition hover:border-accent hover:bg-accent/5">
              <span className="block text-base font-semibold text-ink">{c.title}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">{c.text}</span>
            </a>
          ))}
        </div>
      </header>

      <section id="otra-plataforma" className="scroll-mt-6 space-y-5">
        <h2 className="text-xl font-bold text-ink">Ya tengo WhatsApp API en otra plataforma</h2>
        <Callout tone="warn" title="Ojo">
          Un número solo puede estar en una plataforma a la vez. Al traerlo aquí, deja de funcionar en la anterior.
        </Callout>
        <Steps>
          <Step n={1} title="En la plataforma de ahora, quita el PIN" time="2 min">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Busca la <Chip>verificación en dos pasos</Chip> de tu número y desactívala, o anota su <strong className="text-ink">PIN de 6 números</strong>. Si no la encuentras, pídele a esa plataforma que la quite.
            </p>
          </Step>
          <Step n={2} title="Pulsa «Continuar con Facebook»" time="1 min">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Está en <strong className="text-ink">Conexiones del agente → WhatsApp Business</strong>. Entra con el Facebook que administra tu negocio.
            </p>
          </Step>
          <Step n={3} title="Elige tu cuenta y tu número" time="1 min">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Escoge tu <strong className="text-ink">portafolio</strong> y tu <strong className="text-ink">cuenta de WhatsApp Business</strong> que ya existen, y marca el número que quieres traer. Pulsa <Chip>Finalizar</Chip>.
            </p>
          </Step>
          <Step n={4} title="Escribe el PIN si te lo pedimos" last>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Si el número tenía PIN, aparece una casilla de 6 números. Escríbelo y listo: tu agente ya responde.
            </p>
          </Step>
        </Steps>
      </section>

      <section id="desde-cero" className="scroll-mt-6 space-y-5">
        <h2 className="text-xl font-bold text-ink">Empiezo desde cero</h2>
        <div className="rounded-2xl border border-border p-4">
          <p className="mb-2 text-sm font-semibold text-ink">Ten a la mano</p>
          <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
            <li>✓ Tu cuenta de Facebook.</li>
            <li>✓ Un número que reciba <strong className="text-ink">SMS o llamada</strong>.</li>
            <li>
              ✓ Que ese número <strong className="text-ink">no esté abierto</strong> en la app de WhatsApp. Si lo está, primero elimina esa cuenta desde la app (Ajustes → Cuenta → Eliminar cuenta).
            </li>
          </ul>
        </div>
        <Steps>
          <Step n={1} title="Pulsa «Continuar con Facebook»" time="1 min">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Está en <strong className="text-ink">Conexiones del agente → WhatsApp Business</strong>. Se abre una ventana de Meta: entra con tu cuenta.
            </p>
          </Step>
          <Step n={2} title="Crea tu portafolio" time="1 min">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Si ya tienes uno, elígelo. Si no, pulsa <Chip>Crear un portafolio</Chip> y escribe el nombre de tu negocio.
            </p>
          </Step>
          <Step n={3} title="Crea tu cuenta de WhatsApp Business" time="1 min">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Escribe el <strong className="text-ink">nombre de tu negocio</strong> como lo verán tus clientes y elige la categoría que más se parezca.
            </p>
          </Step>
          <Step n={4} title="Agrega tu número" time="2 min">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Escríbelo con el código de país (Colombia: +57), elige <Chip>SMS</Chip> o <Chip>Llamada</Chip> y escribe el código de 6 dígitos que te llega.
            </p>
          </Step>
          <Step n={5} title="Pulsa «Finalizar»" last>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              La ventana se cierra sola y verás el aviso verde con un botón para probarlo.
            </p>
          </Step>
        </Steps>
        <Callout tone="info" title="El nombre de tu negocio">
          Meta revisa el nombre que verán tus clientes. Mientras lo aprueba, tu agente ya funciona; solo puede verse tu número en vez del nombre.
        </Callout>
      </section>

      <section id="pin" className="scroll-mt-6 space-y-3">
        <h2 className="text-xl font-bold text-ink">El PIN de 6 números</h2>
        <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
          Los números que vienen de otra plataforma suelen tener una <strong className="text-ink">verificación en dos pasos</strong> con un PIN. Sin él, Meta no deja moverlos. Tienes dos salidas: escribir el PIN cuando te lo pidamos, o desactivarlo en la plataforma anterior antes de conectar.
        </p>
      </section>

      <section id="token" className="scroll-mt-6 space-y-5">
        <h2 className="text-xl font-bold text-ink">Conectar con un token (avanzado)</h2>
        <p className="max-w-prose text-sm text-ink-muted">Solo si prefieres no usar el botón de Facebook. Es una clave larga que empieza con «EAA…».</p>
        <Steps>
          <Step n={1} title="Entra a Configuración del negocio">
            <OpenLink href="https://business.facebook.com/settings/system-users">Abrir Usuarios del sistema</OpenLink>
          </Step>
          <Step n={2} title="Crea un usuario del sistema">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              <Chip>Usuarios</Chip> → <Chip>Usuarios del sistema</Chip> → nombre «Funnels», rol <Chip>Administrador</Chip>.
            </p>
          </Step>
          <Step n={3} title="Dale acceso">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Pulsa <Chip>Asignar activos</Chip> y dale <strong className="text-ink">control total</strong> a tu cuenta de WhatsApp y a tu app.
            </p>
          </Step>
          <Step n={4} title="Genera el token" last>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              <Chip>Generar token</Chip> → tu app → vencimiento <Chip>Nunca</Chip> → marca <Chip>whatsapp_business_management</Chip> y <Chip>whatsapp_business_messaging</Chip>. Cópialo y pégalo en «Ya tengo un token de Meta».
            </p>
            <p className="text-xs text-ink-faint">
              El <strong>Phone Number ID</strong> y el <strong>WABA ID</strong> los ves en WhatsApp Manager → Configuración de la API. No son tu número de teléfono.
            </p>
          </Step>
        </Steps>
      </section>

      <section id="problemas" className="scroll-mt-6 space-y-3">
        <h2 className="text-xl font-bold text-ink">Si algo no sale</h2>
        <Trouble problem="Meta dice que el número ya está registrado" fix={<>Está abierto en la app de WhatsApp o en otra plataforma. Elimina esa cuenta o desactívalo allí y vuelve a intentarlo.</>} />
        <Trouble problem="No me llega el código" fix={<>Elige <Chip>Llamada</Chip> en lugar de SMS y espera un minuto antes de pedirlo otra vez.</>} />
        <Trouble problem="La ventana se cierra o queda en blanco" fix={<>Permite las ventanas emergentes de este sitio y desactiva el bloqueador de anuncios.</>} />
        <Trouble problem="Me pide un PIN y no lo tengo" fix={<>Desactiva la verificación en dos pasos en la plataforma donde estaba el número, o pídenos ayuda.</>} />
      </section>

      <section className="space-y-3 rounded-2xl border border-accent/40 bg-accent/10 p-5">
        <h2 className="text-lg font-bold text-ink">¿Prefieres que lo hagamos contigo?</h2>
        <p className="text-sm text-ink-muted">En una llamada de 30 a 45 minutos lo dejamos funcionando.</p>
        <div className="flex flex-wrap gap-2">
          <a href={AGENDA_CALL_URL} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover">
            Agendar la llamada
          </a>
          <a
            href={supportWhatsAppLink("Hola, necesito ayuda para conectar mi WhatsApp en Funnels Labs")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-border-strong"
          >
            Escribirnos por WhatsApp
          </a>
        </div>
      </section>
    </div>
  );
}
