import asyncio, base64, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":1600,"height":520})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        base="npmthree/node_modules/three/"
        libs="".join(f"<script>{open(base+f).read()}</script>" for f in ["build/three.min.js","examples/js/loaders/GLTFLoader.js"])
        data=base64.b64encode(open("pedro_animado.glb","rb").read()).decode()
        await pg.set_content(f"""<html><body style="margin:0"><canvas id=c width=1600 height=520></canvas>{libs}<script>
        const R=new THREE.WebGLRenderer({{canvas:document.getElementById('c'),antialias:true}});R.setClearColor(0xd8d4cc);R.outputEncoding=THREE.sRGBEncoding;R.setScissorTest(true);
        const bin=Uint8Array.from(atob('{data}'),c=>c.charCodeAt(0)).buffer;
        new THREE.GLTFLoader().parse(bin,'',g=>{{
          const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xffffff,0x777777,1.0));const dl=new THREE.DirectionalLight(0xffffff,.8);dl.position.set(1,2,3);sc.add(dl);sc.add(g.scene);
          const mixer=new THREE.AnimationMixer(g.scene);const info={{clips:g.animations.map(a=>a.name+':'+a.duration.toFixed(2))}};
          const shots=[['walk',.2,1.57],['walk',.45,1.57],['walk',.7,2.4],['surprised',.35,1.2],['surprised',.55,0.2],['idle',.5,0.6],['surprised',.45,-1.2],['walk',.95,0.0]];
          shots.forEach(([n,f,az],i)=>{{
            mixer.stopAllAction();const clip=g.animations.find(a=>a.name===n);const a=mixer.clipAction(clip);a.play();mixer.setTime(clip.duration*f);
            const cam=new THREE.PerspectiveCamera(28,200/520,.01,50);cam.position.set(Math.sin(az)*2.4,.55,Math.cos(az)*2.4);cam.lookAt(0,.45,0);
            R.setViewport(i*200,0,200,520);R.setScissor(i*200,0,200,520);R.render(sc,cam);
          }});
          window.info=info;
        }},e=>window.info={{err:String(e)}});
        </script></body></html>""")
        await pg.wait_for_function("window.info", timeout=60000)
        print(json.dumps(await pg.evaluate("window.info")), errs[:3])
        await pg.screenshot(path="glb_anim_check.png")
        await b.close()
asyncio.run(main())
