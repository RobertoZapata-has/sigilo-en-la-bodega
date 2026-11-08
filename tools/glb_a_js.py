"""Empaqueta un .glb como .js (las páginas publicadas no sirven .glb).
Uso: python3 tools/glb_a_js.py assets/modelos/pedro_animado.glb dist/pedro_model.js PEDRO"""
import base64, sys
glb, out, key = sys.argv[1], sys.argv[2], sys.argv[3].upper()
data = base64.b64encode(open(glb, 'rb').read()).decode()
open(out, 'w').write(f'window.MODEL_{key}="{data}";\n')
print('Listo:', out)
