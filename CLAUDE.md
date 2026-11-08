# Sigilo en la bodega

Juego de puzzle por turnos estilo Lara Croft GO / Hitman GO / Deus Ex GO, hecho por Rober (Mendoza, Argentina).
Se habla en español rioplatense. Rober no es programador profesional: explicale los pasos con palabras simples y avisale qué tiene que hacer él con sus manos (por ejemplo, en Blender o en Mixamo).

## La historia

Mendoza, 1974. La noche antes de la Fiesta de la Vendimia, la banda del Zorro Funes roba la corona de la Reina.
El jugador elige con quién va esa noche:

- **Pedro** (nuevo aspecto desde el 24/10/2026): explorador de unos 50 años. Pelo corto canoso peinado hacia atrás, barba corta canosa, campera de lona verde oliva abierta con cuatro bolsillos, remera azul marino, jean con botamanga doblada, borcegos marrones y mochila de lona verde con correas de cuero y aislante enrollado arriba. Color identificador: verde oliva (#8fa04f). (Antes era un viñatero con boina y bigote; esas referencias viejas siguen en `assets/referencias/` y en la página de prompts.)
- **Clara**: su sobrina, cosechadora de unos 22 años. Pañuelo azul petróleo en la cabeza, trenza oscura, camisa clara, overol azul petróleo, tacho de cosecha. Color identificador: azul petróleo (#4f9fc0).

La banda (todos en bordó):
- **Vigía**: poncho bordó y gorro de lana, se queda quieto mirando en una dirección.
- **Sereno**: saco bordó largo, gorra y farol de kerosene encendido; hace una ronda fija.
- **Zorro Funes**: el jefe (todavía no está en el juego).

Capítulos: 1 La finca (hecho), 2 El Trasandino (hecho), 3 La playa de camiones, 4 La Vía Blanca, 5 El Teatro Griego.

## Reglas del juego (src/logic.js)

- El tablero es un grafo de puntos unidos por caminos. Por turno el jugador se mueve un punto; después actúan los enemigos.
- Cada enemigo "mira" un punto vecino (flecha roja). Si el jugador termina ahí, pierde.
- Si el jugador entra al punto de un enemigo por detrás o de costado, lo saca del tablero. Si entra de frente, pierde.
- El sereno avanza un paso por turno por su ruta (ida y vuelta, o en loop).
- `solve()` es un resolvedor por búsqueda en anchura: verifica que cada nivel tenga solución y da el mínimo de movidas. Usalo SIEMPRE al crear o cambiar niveles (`node tools/lab.js` muestra mínimo y movidas mortales; `tools/search.js` busca configuraciones de enemigos).

## Archivos

- `src/page.html`: HTML y CSS de la página, con marcadores `/*__LOGIC__*/`, `/*__LEVELS__*/`, `/*__GAME__*/`.
- `src/logic.js`: reglas y resolvedor (sin gráficos; también corre en Node).
- `src/levels.js`: niveles. El mapa es texto: posiciones pares = puntos (`o`, `S` inicio, `G` salida), `-` y `|` = caminos. Campos extra: `theme`, `pad` (borde en casilleros), `heights` (altura de un punto, ej. la pasarela), `chapter`, `zones` (tramos de cámara) y `finale` (dónde está el Zorro junto a la corona).
- `src/characters.js`: personajes. Muñecos articulados hechos en código (Pedro, Clara, vigía, sereno) con modos `idle`, `walk`, `push`, `surprised`, `cheer`, `down`. Si se carga un modelo GLB (`CHARS.loadModel`), lo usa en vez del muñeco: si el modelo trae un clip con el nombre del modo (`walk`, `idle`, `surprised`, `push`, `cheer`) lo reproduce; si no, cae en `walk`/`idle` y mueve el cuerpo por código. `surprised` y `push` se reproducen una vez y quedan en la pose final.
- `src/decor.js`: escenarios hechos en código (bloque de piedra, galpón, barricas, piletas con pasarela, viñedos, faroles).
- `src/game.js`: escena Three.js r128, cámara ortográfica isométrica, animaciones, controles, pantalla de elección de personaje.
- `tools/build.py`: arma `docs/index.html` y `docs/sw.js` (correr después de cada cambio). `docs/` es lo que publica GitHub Pages.
- `tools/glb_a_js.py`: convierte un `.glb` en `dist/pedro_model.js` (la página publicada en claude.ai no sirve archivos .glb, pero sí .js).
- `tools/fixrig.py`: script (Playwright + Three.js) que unió los 3 FBX de Mixamo en un GLB y corrigió los pesos de las piernas.
- `docs/`: la versión publicada (index.html, modelos `*_model.js`, `trasandino_model.js`, `lugares/*.jpg`, `manifest.json`, `sw.js`, `icons/`).
- `src/trasandino.js`: escenarios del capítulo 2 con el kit de Blender (`TREN.build(scene, ...)`, escenas boleteria, anden, vias, vagon, techo, puente).
- `assets/prompts_gemini.html`: página de prompts para Gemini con botón de copiar (a Rober le sirve más eso que bloques de código en el chat).
- `assets/referencias/`: imágenes de Gemini (Pedro de frente, giro, retratos, en el tablero, hoja de estilo, escenario de la bodega).
- `assets/modelos/`: `pedro_explorador.glb` (el Pedro actual, hecho en Blender) y, como historial, el Pedro viejo: modelo de Meshy, OBJ con textura, FBX de Mixamo y su GLB animado.

Librerías: Three.js r128 desde cdnjs; GLTFLoader y SkeletonUtils desde cdn.jsdelivr.net/npm/three@0.128.0/examples/js/.
Sin frameworks ni build complejo, a propósito.

## Pedro en 3D (hecho en Blender)

Camino: Gemini (frente y espalda en pose A, sin accesorios) → Hunyuan3D (imagen a 3D, malla sin color) → Blender.
En Blender (archivo `explorador.blend`, en `Documentos/3D Objects/explorador` de Rober):
- Malla escalada a 1,80 m, limpia y pintada proyectando las imágenes de frente y espalda (textura horneada).
- Esqueleto propio de 21 huesos (root, hips, spine, chest, neck, head; shoulder/upper_arm/forearm/hand y thigh/shin/foot/toe .L/.R) con pesos automáticos.
- Mochila aparte (también de Hunyuan3D), pintada proyectando su imagen y pegada al hueso `chest`.
- Clips hechos a mano: `idle`, `walk` (en el lugar), `surprised`, `push`, `cheer` y `wave` (saludo, no se usa todavía).
- Para el juego se exporta una versión liviana: ~8.000 triángulos el cuerpo + 2.200 la mochila, texturas JPG de 1024. Archivo: `assets/modelos/pedro_explorador.glb` → `dist/pedro_model.js`.
- Mira hacia +Z con los pies en Y=0; el juego lo escala a `MODEL_H`.

## Clara y la banda en 3D (hechos en Blender, 24/10/2026)

Mismo camino que Pedro, automatizado con `tools/pipe.py` (se ejecuta dentro de Blender con `exec(open(ruta).read())`): `importar`, `normalizar` (1,80 m, pies en 0, limpieza), `proyectar` (pinta con imágenes de frente y espalda y hornea la textura), `medir` + `esqueleto` (21 huesos ubicados según la forma del cuerpo, pesos automáticos), `animar` (clips), `enganchar` (objeto pegado a un hueso) y `exportar` (versión liviana para el juego).
Los .blend y las imágenes están en `Documentos/3D Objects/banda` de Rober.

- **Clara** (`assets/modelos/clara.glb` → `dist/clara_model.js`): idle, walk, surprised, push, cheer, down, wave. Tacho de cosecha colgado de la cadera izquierda (hueso `hips`).
- **Vigía** (`vigia.glb` → `dist/vigia_model.js`): idle (mira a los costados), walk, surprised, push, down. Hunyuan3D le dio la espalda negra; se repintó con la imagen de espalda.
- **Sereno** (`sereno.glb` → `dist/sereno_model.js`): idle, walk, surprised, push, down. Farol en la mano derecha (objeto `Farol`, hueso `hand.R`); el juego le pone una luz cálida y brillo al vidrio (characters.js, `buildModel`).
- **Zorro Funes** (`zorro.glb`) y **la corona** (`corona.glb`): listos pero todavía no se usan en el juego (no hay nivel con el Zorro).
- Cuando un modelo termina de cargar, `CHARS.onModel` (game.js) reemplaza al muñeco de bloques: el jugador, las figuras de la pantalla de elección y los guardias en el tablero.
- Los muñecos de bloques siguen como respaldo si un modelo no carga.

## Cámara estilo Lara Croft GO y pantalla acostada (25/10/2026)

Rober juega con el celular acostado. Primero se probó una cámara que saltaba por tramos; después, mirando un video de Lara Croft GO, pidió la cámara más baja y cerca. Quedó así:
- Cámara ortográfica baja (`CAM_EL` ≈ 31°) y con el tablero en diagonal (`CAM_AZ` = 45°).
- Sigue al jugador en cada movida (`followRect`): encuadra al jugador, sus vecinos y los guardias que lo pueden atrapar (`threatPoints`: los que están o miran a 1 casillero y los serenos que llegan en 3 pasos). Nunca muestra menos de `VIEW_H` de alto y no se pasa del borde de la maqueta.
- Al empezar un nivel se ve el mapa entero ~2 s y después se acerca. Botón "Ver mapa" / "Acercar" (tecla M).
- `zones` con nombre (solo la bodega: El galpón, Las piletas, La salida por la viña) ya no mueven la cámara: solo muestran el aviso con el nombre al entrar.
- Con la pantalla acostada (`orientation: landscape` y proporción ≥ 4:3) los botones van en una columna a la derecha y el título queda encima del tablero.
- Al final de la bodega, la corona gira sobre la salida y el Zorro Funes espera al lado; cuando ganás, se sorprende.
- Escenario en 3D (Gemini → Hunyuan3D → Blender), en `assets/modelos/escenario/` y empaquetado en `dist/escenario_model.js` (`window.PROPS_B64 = {nombre: base64}`):
  galpón, barrica, pileta, escalera, prensa y tramo de viña. `DECOR.loadProps` las carga; en `bodega()` cada pieza está en un "hueco" (`slot`) que muestra la versión de formas simples hasta que la pieza nueva carga (`applyProps`).
  La viña se arma repitiendo la pieza `vina` con instancias a lo largo de cada hilera. La pila de barricas se arma con 6 barricas (la pieza `pila.glb` de Hunyuan3D salió con la textura rota y no se usa). La pasarela de las piletas sigue hecha en código.
  Prompts de las piezas que faltan: página "Piezas 3D de la bodega" (portón, carreta, cajón, farol de poste, árbol seco, jarilla, tanque de agua).

## Campaña de 30 niveles (diseño acordado el 25/10/2026)

El diseño completo está en el doc "Sigilo en la bodega — Diseño de la campaña" (claude.ai/artifact/WYqQoznNhtx4Ns6Wh5N2C4): 5 capítulos de 6 niveles (La finca, El andén del Trasandino, La playa de camiones, La Vía Blanca, El Teatro Griego), una mecánica nueva por capítulo, cada nivel es una isla-maqueta flotando sobre Mendoza.
Decisiones: en el final del capítulo 4 el Zorro se lleva como rehén al personaje que no elegiste; las viñetas de historia van con texto puesto por el juego (las imágenes de Gemini sin texto); los guardias noqueados quedan atados al costado.

Capítulo 1 (hecho el 25/10/2026):
- Niveles 1 a 5 con `theme: 'finca'`: `DECOR.finca` decora solo (hileras de viña en todo lo libre, faroles, barricas, prensa, jarilla) y cada nivel puede tener un `extra` ('tapial', 'acequia', 'galpon').
- `sky` por nivel ('tarde', 'anochecer', 'noche'): cambia el cielo (CSS `.stage[data-sky]`) y las luces. El capítulo va del atardecer (1-3) al anochecer (4-5) y la noche (6, la bodega).
- Reglas nuevas en logic.js: vigía con `range` (ve en línea recta varios puntos; se dibuja con el modelo del sereno, que lleva farol) y puntos `b` en el mapa = barricas: ahí no te ven y la vista del vigía no pasa. `sight(lv, e)` da los puntos que ve cada guardia. Nivel 5 "El patio de la bodega" enseña esto (`tools/search_cover.js` buscó la configuración).
- Guardias noqueados: clip `tied` (sentado, en vigía y sereno); quedan en una esquina del punto donde cayeron (`tiedSpot`), con soga y, el sereno, con el farol apagado.
- Prompts de lo que falta del capítulo (tapial, álamo, parral, acequia, portón, carreta, cajón, farol, jarilla, fondo y 3 viñetas): claude.ai/artifact/3dy6zvAggtKuL39aRfzTUQ

## Capítulo 2 e interfaz nueva (1/11/2026, desde el chat de claude.ai)

Se hizo en paralelo a lo de arriba y se fusionó a mano el 1/11 (fusión de tres vías: lo de Claude Code + lo del chat). Si algo de lo anterior falta, revisar contra esta versión.
- **Nivel 7 "El andén"** (`theme: 'anden'`, capítulo 2 · El Trasandino): estación con alero, andén con línea amarilla, vías, dos vagones con escaleras y una locomotora a vapor con humo animado (`DECOR.anden`, devuelve `update` para el humo). Hecho en código, sin modelos de Blender todavía.
  Los techos de los vagones son puntos con altura (`heights`) y `climb: [0.5, 0.66]` hace que el personaje camine hasta la escalera y suba en vertical.
- **Mecánica nueva: el guarda que gira** (`turn: ['E','S','W','N']`, `ti`): un vigía que rota la mirada cada turno, después de tu movida. `nextFacing(lv, e)` da hacia dónde va a mirar; se dibuja con anillo y flecha rosados claros. Se ve con el muñeco de bloques `guarda` (gorra, saco bordó, banderín rojo) porque no tiene modelo: **falta hacerlo en Blender** con clips idle, surprised, push, down y tied.
- **Interfaz nueva** (page.html), estética de etiqueta de vino de noche: Bodoni Moda + Barlow Condensed; el tablero ocupa toda la pantalla; arriba la etiqueta del nivel (`#hud`) y el sello de lacre con las movidas; abajo una botonera redonda flotante (`#dock`, ahora con 5 botones: Deshacer, Reiniciar, Pista, Mapa, Ruta); consejos en una nota de papel; victoria con etiqueta "Cosecha 1974" y 1 a 3 racimos; derrota con un sello; niveles como horario de trenes ("Hoja de ruta"); elección de personaje con boletos de tren; cartel de capítulo (`#chapBox`) en los niveles que tienen `intro`.
  `rectFor` (game.js) deja libre el alto de `#hud` arriba y de la nota y `#dock` abajo. Con el celular acostado la botonera se achica y la nota va a la derecha (ya no hay columna lateral de botones).
- `levelLabel(i)` arma el rótulo "Capítulo 1 · 3 de 7 · Pedro". Los capítulos se escriben "Capítulo N · Nombre" y el cartel usa el nombre.

## Capítulo 2 completo, GitHub e instalación (8/11/2026)

- Repositorio: github.com/RobertoZapata-has/sigilo-en-la-bodega (rama main). Página: robertozapata-has.github.io/sigilo-en-la-bodega/ (GitHub Pages desde `main` /docs).
- **Kit del Trasandino hecho en Blender** con código (`assets/modelos/trasandino/`, `trasandino_kit.blend`): locomotora, coche, furgón, estación, tanque, señal, álamo verde y dorado, rocas, cerro nevado, puente de hierro, túnel, Puente del Inca. Empaquetado en `docs/trasandino_model.js` (`window.KIT_B64`); `TREN.loadKit` lo carga y cada pieza tiene un "hueco" con la versión de formas simples hasta que carga. Los colores de Blender se pasan a sRGB al cargar.
  Convención: los trenes van en X con la trompa a +X; los edificios miran a +Z; ruedas en Y=0 (el juego las sube a `RAIL_Y` = 0,19, así el techo de un coche queda a 1,18).
- **Seis niveles del capítulo 2** (7 a 12): La boletería (enseña al guarda que gira), El andén (bancos y valijas `b` tapan), Las vías, Dentro del vagón, El techo del tren (en Uspallata) y El puente del río (final con `outro`).
- **Reglas nuevas** en logic.js: `trains: [{y, x0, x1, every, phase, dir}]` (la máquina pasa cuando `(t+phase) % every == 0`; si estás en esa vía, perdés) y `doors: [{a, b, every, open, phase}]` (camino abierto cuando `(t+phase) % every < open`; la vista de los guardias tampoco pasa). `lv.period` entra en la clave del resolvedor. Ojo con la paridad: el tablero es bipartito, así que una puerta con `every: 2` puede quedar imposible de cruzar.
- `tools/search2.js` + `tools/casos/c7..c12.js`: búsqueda de guardias por nivel.
- Carteles en el tablero (`badge` en game.js): turnos que faltan para el tren (rojo cuando falta 1) y estado de las puertas.
- **Ilustraciones de Canva** (`assets/lugares/`, `docs/lugares/`): finca, viña, patio, bodega, estación, andén, vías, vagón, Uspallata, puente. Están en el diseño de Canva "Álbum ilustrado de Mendoza 1974" (páginas 9 a 18). Cada nivel tiene `art` y `place`: se ven en la postal al empezar (`#postal`), de fondo en el cartel de capítulo y en la hoja de ruta.
- Cielos nuevos `luna` y `alba`. Los guardas que giran usan el modelo del vigía.
- **PWA:** `manifest.json`, `sw.js` (red primero para la página, caché para lo demás), íconos en `docs/icons/` (sello de lacre con corona), botón "Instalar" en la elección de personaje y en la hoja de ruta (en iPhone muestra los pasos).

## Ideas pendientes

- Darle función a la pasarela (desde arriba no te ven los de abajo) y a las barricas (tapan la vista).
- Pantallas de capítulo con las imágenes de Gemini de fondo.
- Modelo propio del guarda en Blender (hoy usa el del vigía).
- Capítulos 3 a 5 con su escenario.
