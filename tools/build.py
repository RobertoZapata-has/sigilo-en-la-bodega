"""Arma docs/index.html (la versión que publica GitHub Pages) juntando los archivos de src/.
Uso: python3 tools/build.py
También copia sw.js con una versión nueva, así el celular baja la actualización."""
from pathlib import Path
import time
root = Path(__file__).resolve().parent.parent
src = root / 'src'
out_dir = root / 'docs'
read = lambda n: (src / n).read_text(encoding='utf-8')
page = read('page.html')
page = page.replace('/*__LOGIC__*/', read('logic.js')).replace('/*__LEVELS__*/', read('levels.js'))
page = page.replace('/*__GAME__*/', '\n'.join(read(n) for n in ('characters.js', 'decor.js', 'trasandino.js', 'game.js')))
version = time.strftime('%Y%m%d%H%M')
page = page.replace('__VERSION__', version)
(out_dir / 'index.html').write_text(page, encoding='utf-8')
sw = read('sw.js').replace('__VERSION__', version)
(out_dir / 'sw.js').write_text(sw, encoding='utf-8')
print('Listo:', out_dir / 'index.html', 'versión', version)
