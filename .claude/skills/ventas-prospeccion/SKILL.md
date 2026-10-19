---
name: ventas-prospeccion
description: Encuentra y califica prospectos para Funnels Labs (clínicas, odontólogos, estéticas, abogados, contadores y empresas de servicios) en Instagram, Facebook, LinkedIn, Google Maps y la web, consigue su correo con un email finder / mail finder, les busca un gancho de personalización y los carga al tracker sin duplicados. Úsala para "consigue leads", "arma la lista de mañana", "busca odontólogos en Medellín", "importa este CSV de Hunter/Apollo" o la Prueba del WhatsApp.
---

# Prospectar: llenar la lista con buenos leads

Plan y cliente ideal: `ventas/PLAN.md` (secciones 2 a 4). Tracker:
`node ventas/scripts/ventas.mjs` (ver la skill `ventas-metricas` para los
datos y la sincronización con Drive).

## 1. Definir la tanda

Una tanda = **un segmento + una ciudad** (ej. "odontología, Medellín"), con
40 a 60 leads. Así el mensaje se puede localizar y las métricas por
segmento dicen algo.

## 2. Dónde buscar

| Fuente | Cómo | Sirve para |
|---|---|---|
| Google Maps | "{segmento} en {ciudad}" → nombre, teléfono/WhatsApp, web, reseñas | Todos; es la mejor fuente de negocios locales |
| Instagram | Hashtags (#odontologia{ciudad}), ubicaciones, "cuentas sugeridas" de cada clínica | Clínicas y estéticas |
| Facebook | Páginas por búsqueda + grupos del sector y la ciudad | Negocios con poca presencia en IG |
| LinkedIn | Cargo (dueño, socio, director, gerente) + sector + ciudad | Abogados, contadores, clínicas medianas, servicios |
| Web del negocio | Contacto, pie de página, "trabaja con nosotros", políticas | Correo y nombre del dueño |
| Directorios | Colegios profesionales, directorios de la cámara de comercio, páginas amarillas | Abogados y contadores |

Si hay acceso web en la sesión (WebSearch/WebFetch), el agente busca y
completa los datos; si no, le pide a la persona que pegue lo que encontró
(o un CSV) y él lo limpia y lo importa.

## 3. Conseguir el correo (email finder)

1. Con el dominio de la web y el nombre del dueño, buscar en el email
   finder que tengamos (Hunter, Snov, Apollo, Skrapp u otro "mail finder",
   todos con créditos gratis cada mes). Exportar a CSV.
2. **Verificar** cada correo (la mayoría de estas herramientas trae un
   verificador). Poner `email_estado=verificado`, `riesgoso` o
   `no_encontrado`. A los `riesgoso` solo se les escribe si no hay otro
   canal.
3. Sin buscador: probar los patrones típicos (`nombre@`,
   `nombre.apellido@`, `info@`, `contacto@`) y revisar Google con
   `"@dominio.com"`. Los correos de Gmail o Hotmail que publica el mismo
   negocio son válidos.
4. Nunca comprar bases de datos ni sacar correos de lugares privados.

## 4. Calificar (prioridad A, B o C)

Revisar las señales de `ventas/PLAN.md` §2:

- **A** = 3 o más señales (WhatsApp visible, comentarios preguntando
  precio, publica seguido o hace promos, 1 a 3 sedes, dueño ubicable). Se
  les hace la Prueba del WhatsApp.
- **B** = 1 o 2 señales.
- **C** = dudoso (poca actividad, cadena grande). Solo si sobra cuota.
- **Descartar** (no se carga): sin actividad en 3 meses, sin canal de
  contacto, o ya marcado `no_contactar`.

## 5. El gancho (obligatorio)

Una observación **concreta y verificable** de ese negocio para la primera
línea del mensaje. Ejemplos:

- "Publicaron la promo de blanqueamiento el lunes y hay 6 comentarios
  preguntando el precio."
- "Abrieron una sede nueva en Envigado."
- "El dueño publicó en LinkedIn sobre la temporada de declaraciones."
- Prueba del WhatsApp: "Escribí el jue 8:40 pm preguntando por limpieza.
  Respondieron el vie 10:15 am."

Sin gancho, el lead queda en la lista, pero no se le escribe.

## 6. Prueba del WhatsApp (solo prioridad A, ~10 por día)

La persona le manda **una sola pregunta normal de cliente** al WhatsApp del
negocio, idealmente de noche o en fin de semana. Luego se anota en el
`gancho` la hora en que se envió, la hora en que respondieron y cómo lo
hicieron. Reglas en `ventas/PLAN.md` §3: no agendar citas falsas, no
exagerar y, si respondieron bien, decírselo.

## 7. Cargar al tracker

Uno por uno:

```bash
node ventas/scripts/ventas.mjs nuevo negocio="Clínica Dental Sonrisa" segmento=odontologia \
  ciudad=Medellín pais=CO instagram=@sonrisamed whatsapp=+573001234567 web=sonrisa.co \
  fuente=google_maps prioridad=A gancho="6 comentarios preguntando precio en la promo del lunes"
```

O en bloque desde un CSV (por ejemplo el que exporta el email finder),
renombrando antes las columnas a las del tracker (`negocio`, `contacto`,
`cargo`, `email`, `web`, `linkedin`, `ciudad`, `segmento`…):

```bash
node ventas/scripts/ventas.mjs importar /ruta/export.csv fuente=hunter segmento=abogados
```

El script avisa si un lead ya existe (por usuario, correo, teléfono, web o
nombre + ciudad) y no lo duplica. Los valores de segmento que usamos son
`odontologia`, `estetica`, `medicina`, `abogados`, `contadores`,
`servicios` y `agencia` (clientes actuales). Mantenerlos iguales para que
las métricas cuadren.

**El CSV que trae el email finder también es un dato personal:**
guardarlo en `ventas/datos/` o en el scratchpad, nunca en una carpeta que
se suba al repo.
