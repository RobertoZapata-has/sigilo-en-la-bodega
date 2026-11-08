# Sigilo en la bodega

Puzzle de sigilo por turnos, al estilo de Lara Croft GO / Hitman GO.
**Mendoza, 1974.** La noche antes de la Fiesta de la Vendimia, la banda del Zorro Funes roba la corona de la Reina. Elegís con quién la seguís: Pedro, el baquiano, o Clara, su sobrina cosechadora.

**Jugar:** https://robertozapata-has.github.io/sigilo-en-la-bodega/
Se puede instalar en el celular con el botón **Instalar** y después se juega sin internet.

## Capítulos

| # | Capítulo | Niveles | Mecánica nueva |
|---|----------|---------|----------------|
| 1 | La finca | El tapial · Por la espalda · La ronda · La acequia · El patio de la bodega · La bodega | vigías, serenos con ronda, barricas que tapan la vista |
| 2 | El Trasandino | La boletería · El andén · Las vías · Dentro del vagón · El techo del tren · El puente del río | guarda que gira, máquinas que pasan por las vías, puertas que se abren y se cierran, techos de los coches |

## Cómo está hecho

- `src/` código fuente: `page.html` (interfaz), `logic.js` (reglas y resolvedor), `levels.js` (niveles), `characters.js`, `decor.js`, `trasandino.js` (escenarios del capítulo 2) y `game.js` (Three.js).
- `python3 tools/build.py` arma `docs/index.html`, que es lo que publica GitHub Pages.
- `node tools/lab.js` comprueba que todos los niveles tengan solución y muestra el mínimo de movidas.
- `node tools/search2.js tools/casos/c9.js` busca dónde poner a los guardias en un mapa.
- `assets/modelos/` tiene los modelos de Blender: personajes, escenario de la bodega y el kit del Trasandino (`trasandino/`, con `trasandino_kit.blend`).
- `assets/lugares/` tiene las ilustraciones de cada lugar, hechas con Canva.

Sin frameworks: Three.js r128 desde cdnjs y un solo HTML.
