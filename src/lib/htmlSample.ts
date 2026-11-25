// A page to try the "Código HTML" block and the "Subir mi HTML" page with: the Funnels Labs sales page, one
// self-contained file (styles and script inside) with a contact form that saves to the CRM, so seeing it
// work proves that pasted code runs and that its form reaches the CRM. Nothing in it leaves the page.

export const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Funnels Labs — Tu asistente de WhatsApp que vende 24/7</title>
<style>
  :root{--ink:#14112b;--mut:#5d5a78;--bg:#fbfaff;--card:#ffffff;--line:#e6e2f7;--p:#5b3df5;--p2:#8a5cff;--ok:#16a34a;--wa:#22c55e}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg);line-height:1.55;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1040px;margin:0 auto;padding:0 20px}
  .btn{display:inline-block;padding:15px 26px;border-radius:999px;font-weight:700;font-size:16px;border:0;cursor:pointer}
  .btn-p{background:linear-gradient(135deg,var(--p),var(--p2));color:#fff;box-shadow:0 10px 26px rgba(91,61,245,.32)}
  .btn-w{background:var(--wa);color:#fff;box-shadow:0 10px 26px rgba(34,197,94,.3)}
  .btn-o{background:#fff;color:var(--p);border:2px solid var(--line)}
  nav{display:flex;align-items:center;justify-content:space-between;padding:18px 0}
  .logo{font-weight:800;font-size:20px;letter-spacing:-.3px}
  .logo b{color:var(--p)}
  nav a.btn{padding:10px 18px;font-size:14px}
  .hero{padding:44px 0 56px;text-align:center}
  .tag{display:inline-block;background:#efeaff;color:var(--p);font-weight:700;font-size:13px;padding:7px 14px;border-radius:999px;margin-bottom:18px}
  h1{font-size:clamp(32px,7vw,56px);line-height:1.08;letter-spacing:-1.2px;font-weight:800;max-width:800px;margin:0 auto 18px}
  h1 span{background:linear-gradient(135deg,var(--p),var(--p2));-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:clamp(16px,2.6vw,20px);color:var(--mut);max-width:620px;margin:0 auto 28px}
  .cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
  .proof{margin-top:22px;font-size:14px;color:var(--mut)}
  .chat{max-width:380px;margin:40px auto 0;background:#fff;border:1px solid var(--line);border-radius:22px;padding:16px;text-align:left;box-shadow:0 24px 60px rgba(40,20,120,.14)}
  .chat .h{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:12px;font-weight:700}
  .dot{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--p),var(--p2));color:#fff;display:grid;place-items:center;font-size:14px}
  .m{max-width:84%;padding:10px 13px;border-radius:16px;font-size:14.5px;margin-bottom:8px}
  .m.c{background:#f1eefc;border-bottom-left-radius:4px}
  .m.a{background:#dcf8c6;margin-left:auto;border-bottom-right-radius:4px}
  section{padding:56px 0}
  h2{font-size:clamp(26px,5vw,38px);line-height:1.15;letter-spacing:-.8px;text-align:center;font-weight:800;margin-bottom:10px}
  .lead{text-align:center;color:var(--mut);max-width:600px;margin:0 auto 34px}
  .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
  .card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px}
  .card .i{font-size:28px;margin-bottom:10px}
  .card h3{font-size:19px;margin-bottom:6px}
  .card p{color:var(--mut);font-size:15px}
  .dark{background:var(--ink);color:#fff}
  .dark .lead{color:#b9b4dd}
  .steps{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));counter-reset:s}
  .step{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:24px;counter-increment:s}
  .step:before{content:counter(s);display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--p2);font-weight:800;margin-bottom:12px}
  .step h3{margin-bottom:6px;font-size:18px}
  .step p{color:#b9b4dd;font-size:15px}
  .plans{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));align-items:stretch}
  .plan{background:#fff;border:1px solid var(--line);border-radius:22px;padding:26px;display:flex;flex-direction:column}
  .plan.top{border:2px solid var(--p);box-shadow:0 18px 44px rgba(91,61,245,.18)}
  .plan h3{font-size:20px}
  .plan .for{color:var(--mut);font-size:14px;margin:4px 0 14px}
  .plan ul{list-style:none;margin-bottom:20px;flex:1}
  .plan li{padding:6px 0 6px 26px;position:relative;font-size:15px}
  .plan li:before{content:"✓";position:absolute;left:0;color:var(--ok);font-weight:800}
  .plan .btn{text-align:center}
  details{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:10px}
  summary{font-weight:700;cursor:pointer}
  details p{margin-top:10px;color:var(--mut);font-size:15px}
  .demo{max-width:520px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:0 18px 44px rgba(40,20,120,.1)}
  .demo label{display:block;font-weight:700;font-size:14px;margin:12px 0 6px}
  .demo input,.demo textarea{width:100%;padding:13px 14px;border:1px solid var(--line);border-radius:12px;font:inherit;font-size:16px;background:#fbfaff;color:var(--ink)}
  .demo .btn{width:100%;margin-top:16px}
  .final{text-align:center;background:linear-gradient(135deg,var(--p),var(--p2));color:#fff;border-radius:28px;padding:44px 22px}
  .final h2{color:#fff}
  .final p{opacity:.9;margin:0 auto 22px;max-width:520px}
  .final .btn{background:#fff;color:var(--p)}
  footer{padding:30px 0 90px;text-align:center;color:var(--mut);font-size:13px}
  .sticky{position:fixed;left:0;right:0;bottom:0;padding:10px 16px;background:rgba(255,255,255,.94);border-top:1px solid var(--line);display:none;z-index:9}
  .sticky .btn{display:block;text-align:center;padding:13px}
  @media(max-width:720px){.sticky{display:block}.hero{padding-top:24px}section{padding:42px 0}}
</style>
</head>
<body>

<div class="wrap">
  <nav>
    <div class="logo">Funnels<b>Labs</b></div>
    <a class="btn btn-p" href="#planes">Ver planes</a>
  </nav>

  <header class="hero">
    <span class="tag">🤖 Asistente de IA para WhatsApp</span>
    <h1>Responde a tus clientes en WhatsApp <span>mientras duermes</span></h1>
    <p class="sub">Funnels Labs atiende, califica y agenda a tus clientes con inteligencia artificial, y te da una página web lista para vender. Todo en un solo lugar.</p>
    <div class="cta">
      <a class="btn btn-w" href="https://wa.me/" target="_blank" rel="noopener">Quiero una demo por WhatsApp</a>
      <a class="btn btn-o" href="#como">Cómo funciona</a>
    </div>
    <p class="proof">⭐ Sin tarjeta para empezar · Listo en minutos · En español</p>

    <div class="chat" aria-label="Ejemplo de conversación">
      <div class="h"><div class="dot">FL</div>Tu negocio · en línea</div>
      <div class="m c">Hola, ¿tienen cita para mañana en la tarde?</div>
      <div class="m a">¡Hola! 😊 Sí, tengo libre a las 3:00 pm o 5:30 pm. ¿Cuál te sirve?</div>
      <div class="m c">A las 5:30 por favor</div>
      <div class="m a">¡Listo! Quedó agendada tu cita de mañana a las 5:30 pm ✅</div>
    </div>
  </header>
</div>

<section>
  <div class="wrap">
    <h2>Todo lo que tu negocio necesita para vender</h2>
    <p class="lead">Deja de perder clientes por no contestar a tiempo.</p>
    <div class="grid">
      <div class="card"><div class="i">💬</div><h3>Agente de IA 24/7</h3><p>Contesta preguntas, da precios y cierra citas con el tono de tu marca, a cualquier hora.</p></div>
      <div class="card"><div class="i">🌐</div><h3>Página web lista</h3><p>Crea tu sitio en minutos, edítalo desde el celular y publícalo con un toque.</p></div>
      <div class="card"><div class="i">📇</div><h3>CRM de contactos</h3><p>Cada conversación queda guardada con su etiqueta y estado. Nadie se te pierde.</p></div>
      <div class="card"><div class="i">🎯</div><h3>Embudos de venta</h3><p>Plantillas de lanzamiento, evento y captación listas para usar y personalizar.</p></div>
      <div class="card"><div class="i">🔔</div><h3>Avisos al instante</h3><p>Recibe una notificación cuando un cliente está listo para comprar y toma el control.</p></div>
      <div class="card"><div class="i">📱</div><h3>Pensado para el celular</h3><p>Maneja chats, páginas y clientes desde tu teléfono, sin complicaciones.</p></div>
    </div>
  </div>
</section>

<section class="dark" id="como">
  <div class="wrap">
    <h2>Empieza en 3 pasos</h2>
    <p class="lead">Sin técnicos, sin código, sin esperas.</p>
    <div class="steps">
      <div class="step"><h3>Cuéntanos de tu negocio</h3><p>Nombre, servicios y precios. La IA aprende cómo vendes.</p></div>
      <div class="step"><h3>Conecta tu WhatsApp</h3><p>Vincula tu número y tu asistente empieza a atender.</p></div>
      <div class="step"><h3>Publica y vende</h3><p>Comparte tu página y deja que el agente atienda a cada interesado.</p></div>
    </div>
  </div>
</section>

<section id="planes">
  <div class="wrap">
    <h2>Elige tu plan</h2>
    <p class="lead">Precios de ejemplo para esta página de prueba. Pregunta por el plan que se ajusta a ti.</p>
    <div class="plans">
      <div class="plan"><h3>Inicial</h3><div class="for">Para empezar a vender</div>
        <ul><li>1 agente de WhatsApp</li><li>1 página web</li><li>CRM básico</li></ul>
        <a class="btn btn-o" href="https://wa.me/" target="_blank" rel="noopener">Quiero este</a></div>
      <div class="plan top"><h3>Crece</h3><div class="for">El más elegido</div>
        <ul><li>Agentes ilimitados</li><li>Páginas y embudos</li><li>Avisos y etiquetas</li><li>Soporte prioritario</li></ul>
        <a class="btn btn-p" href="https://wa.me/" target="_blank" rel="noopener">Quiero este</a></div>
      <div class="plan"><h3>Agencia</h3><div class="for">Para varios clientes</div>
        <ul><li>Varios negocios</li><li>Tu propia marca</li><li>Panel de equipo</li></ul>
        <a class="btn btn-o" href="https://wa.me/" target="_blank" rel="noopener">Quiero este</a></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap" style="max-width:720px">
    <h2>Preguntas frecuentes</h2>
    <p class="lead">Lo que más nos preguntan.</p>
    <details><summary>¿Necesito saber de tecnología?</summary><p>No. Todo se hace con toques desde el celular y la IA hace el trabajo pesado.</p></details>
    <details><summary>¿Puedo usar mi número actual de WhatsApp?</summary><p>Sí, puedes conectar tu número o usar uno nuevo para tu negocio.</p></details>
    <details><summary>¿Puedo tomar el control de una conversación?</summary><p>Claro. Cuando quieras respondes tú y el agente se pone en pausa en ese chat.</p></details>
    <details><summary>¿Puedo subir mi propia página en HTML?</summary><p>Sí. Pega tu código o sube tu archivo y queda publicada con tu enlace.</p></details>
  </div>
</section>

<section id="demo">
  <div class="wrap">
    <h2>Pide tu demo gratis</h2>
    <p class="lead">Déjanos tus datos y te escribimos por WhatsApp. Este formulario guarda el contacto en tu CRM de Funnels Labs.</p>
    <form class="demo">
      <label for="f-nombre">Tu nombre</label>
      <input id="f-nombre" name="nombre" type="text" autocomplete="name" placeholder="María Pérez" required>
      <label for="f-wa">Tu WhatsApp</label>
      <input id="f-wa" name="whatsapp" type="tel" autocomplete="tel" placeholder="+57 300 123 4567" required>
      <label for="f-msg">¿Qué vendes? (opcional)</label>
      <textarea id="f-msg" name="mensaje" rows="3" placeholder="Cuéntanos de tu negocio"></textarea>
      <button class="btn btn-p" type="submit">Quiero mi demo</button>
    </form>
  </div>
</section>

<div class="wrap">
  <div class="final">
    <h2>Haz que tu WhatsApp venda por ti</h2>
    <p>Pide tu demo gratis y mira cómo atiende tu asistente en minutos.</p>
    <a class="btn" href="https://wa.me/" target="_blank" rel="noopener">Hablar por WhatsApp</a>
  </div>
  <footer>© <span id="y">2026</span> Funnels Labs · Página de ejemplo para pruebas</footer>
</div>

<div class="sticky"><a class="btn btn-w" href="https://wa.me/" target="_blank" rel="noopener">💬 Pedir demo por WhatsApp</a></div>

<script>document.getElementById("y").textContent=new Date().getFullYear();</script>
</body>
</html>
`;
