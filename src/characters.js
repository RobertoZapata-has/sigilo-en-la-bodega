// ===== PERSONAJES ARTICULADOS (hechos en código, sin archivos externos) =====
// Cada personaje es un muñeco con pivotes en caderas, hombros y cuello.
// Mira hacia +z. Los modos de animación son: idle, walk, push, surprised, cheer, down.
const CHARS = (() => {
  const PAL = {
    pedro: {
      name: 'Pedro', ring: 0x8fa04f, skin: 0xdcae8d, torso: 0x2f3a5c, sleeve: 0x7d7448, forearm: 'skin',
      pants: 0x34476a, shoes: 0x5b4636, hair: 0x4a4542, brow: 0x3f3a36, stache: 0x7d7770,
      pack: 0x6f6a3e, packRoll: 0x3f5a3a, leather: 0x8a4f2a,
    },
    clara: {
      name: 'Clara', ring: 0x4f9fc0, skin: 0xe7bb98, torso: 0x2f6f86, sleeve: 0xeee4cf, forearm: 'skin',
      pants: 0x2f6f86, shoes: 0xb7a888, hat: 0x3d8aa6, hair: 0x3a2618, brow: 0x3a2618, blush: 0xe58f7c, metal: 0xa7adb3,
    },
    vigia: {
      name: 'Vigía', skin: 0xc99a7a, torso: 0x2c2a30, poncho: 0x7a2338, pants: 0x2c2a30, shoes: 0x1d1a1a,
      hat: 0x3a3340, brow: 0x221a17, stache: 0x221a17,
    },
    zorro: { name: 'Zorro Funes' },
    corona: { name: 'Corona' },
    sereno: {
      name: 'Sereno', skin: 0xd6a685, torso: 0x6e2236, sleeve: 0x6e2236, forearm: 0x6e2236, pants: 0x2a2830,
      shoes: 0x1d1a1a, hat: 0x26232a, brow: 0x4a3a30, brass: 0xb08d45,
    },
    guarda: {
      name: 'Guarda', skin: 0xcf9f7f, torso: 0x5e1d30, sleeve: 0x5e1d30, forearm: 0x5e1d30, pants: 0x23222b,
      shoes: 0x1d1a1a, hat: 0x1f2233, brow: 0x2a201b, stache: 0x2a201b, brass: 0xc9a24a,
    },
  };

  const mats = new Map();
  const mat = (hex, extra) => {
    const key = hex + (extra ? JSON.stringify(extra) : '');
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.82 }, extra || {})));
    return mats.get(key);
  };
  const G = {
    leg: new THREE.CylinderGeometry(0.066, 0.058, 0.26, 12),
    foot: new THREE.BoxGeometry(0.12, 0.065, 0.19),
    pelvis: new THREE.CylinderGeometry(0.19, 0.18, 0.12, 18),
    torso: new THREE.CylinderGeometry(0.165, 0.2, 0.36, 20),
    shoulders: new THREE.SphereGeometry(0.17, 20, 12),
    sleeve: new THREE.CylinderGeometry(0.058, 0.052, 0.17, 10),
    forearm: new THREE.CylinderGeometry(0.048, 0.046, 0.11, 10),
    hand: new THREE.SphereGeometry(0.056, 12, 10),
    head: new THREE.SphereGeometry(0.24, 26, 18),
    eye: new THREE.SphereGeometry(0.03, 10, 8),
    nose: new THREE.SphereGeometry(0.046, 12, 10),
    ear: new THREE.SphereGeometry(0.05, 10, 8),
    brow: new THREE.BoxGeometry(0.085, 0.024, 0.03),
    stache: new THREE.BoxGeometry(0.15, 0.034, 0.045),
    beret: new THREE.CylinderGeometry(0.275, 0.25, 0.075, 26),
    nub: new THREE.CylinderGeometry(0.016, 0.016, 0.045, 8),
    hairBack: new THREE.SphereGeometry(0.246, 24, 14, Math.PI - 0.35, Math.PI + 0.7, Math.PI * 0.42, Math.PI * 0.24),
    neckScarf: new THREE.TorusGeometry(0.125, 0.034, 8, 20),
    knotTri: new THREE.ConeGeometry(0.06, 0.1, 3),
    hairBall: new THREE.SphereGeometry(0.252, 24, 16),
    scarfCap: new THREE.SphereGeometry(0.264, 26, 12, 0, Math.PI * 2, 0, Math.PI * 0.43),
    knot: new THREE.SphereGeometry(0.06, 10, 8),
    tail: new THREE.ConeGeometry(0.035, 0.12, 6),
    braid: new THREE.SphereGeometry(1, 10, 8),
    blush: new THREE.SphereGeometry(0.03, 10, 8),
    bucket: new THREE.CylinderGeometry(0.09, 0.072, 0.14, 16, 1, true),
    bucketBase: new THREE.CircleGeometry(0.072, 16),
    strap: new THREE.BoxGeometry(0.03, 0.62, 0.02),
    poncho: new THREE.ConeGeometry(0.35, 0.46, 22),
    collar: new THREE.CylinderGeometry(0.1, 0.13, 0.07, 14),
    woolCap: new THREE.SphereGeometry(0.258, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    capFold: new THREE.TorusGeometry(0.245, 0.04, 8, 26),
    pompom: new THREE.SphereGeometry(0.065, 10, 8),
    skirt: new THREE.CylinderGeometry(0.205, 0.245, 0.2, 18, 1, true),
    flatCap: new THREE.CylinderGeometry(0.262, 0.255, 0.07, 24),
    visor: new THREE.BoxGeometry(0.2, 0.018, 0.13),
    ring: new THREE.TorusGeometry(0.3, 0.026, 8, 36),
    capBand: new THREE.CylinderGeometry(0.258, 0.258, 0.03, 24),
    button: new THREE.SphereGeometry(0.022, 8, 6),
    flagStick: new THREE.CylinderGeometry(0.01, 0.01, 0.42, 6),
    flagCloth: new THREE.PlaneGeometry(0.14, 0.1),
    lampTop: new THREE.CylinderGeometry(0.035, 0.06, 0.035, 10),
    lampGlass: new THREE.CylinderGeometry(0.048, 0.048, 0.085, 10),
    lampBase: new THREE.CylinderGeometry(0.058, 0.058, 0.025, 10),
    lampHandle: new THREE.TorusGeometry(0.04, 0.009, 6, 14, Math.PI),
    packBody: new THREE.BoxGeometry(0.3, 0.34, 0.16),
    packRoll: new THREE.CylinderGeometry(0.075, 0.075, 0.4, 14),
    packStrap: new THREE.BoxGeometry(0.035, 0.36, 0.02),
  };

  Object.values(G).forEach(geo => { geo.userData.keep = true; });

  const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  const ALL = [];

  // Modelos 3D animados (Pedro: hecho en Blender, ver CLAUDE.md). Si no cargan, queda el muñeco de bloques.
  const MODELS = {};
  const MODEL_H = { pedro: 1.17, clara: 1.12, vigia: 1.14, sereno: 1.17, zorro: 1.19, corona: 0.4 };
  let onModel = null;
  function loadModel(kind, url) {
    if (!THREE.GLTFLoader || !THREE.SkeletonUtils) return Promise.resolve(false);
    return new Promise(res => {
      const key = 'MODEL_' + kind.toUpperCase();
      const s = document.createElement('script');
      s.src = url; s.async = true;
      s.onerror = () => res(false);
      s.onload = () => {
        const b64 = window[key]; if (!b64) return res(false);
        const bin = atob(b64), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        delete window[key];
        new THREE.GLTFLoader().parse(buf.buffer, '', g => {
        g.scene.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.frustumCulled = false;
          const m = o.material;
          if (m && m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0x6a6460); m.roughness = 0.8; m.metalness = 0; m.needsUpdate = true; }
        });
        const box = new THREE.Box3().setFromObject(g.scene);
        // Los objetos sueltos (la corona) se centran sobre su base, por si vinieron corridos
        if (kind === 'corona') {
          const c = box.getCenter(new THREE.Vector3());
          g.scene.children.forEach(o => { o.position.x -= c.x; o.position.z -= c.z; o.position.y -= box.min.y; });
          g.scene.traverse(o => { if (o.isMesh && o.material) { o.material.emissive = new THREE.Color(0xc8a050); o.material.emissiveIntensity = 0.55; } });
        }
        MODELS[kind] = { gltf: g, scale: MODEL_H[kind] / (box.max.y - box.min.y) };
        if (onModel) onModel(kind);
        res(true);
      }, () => res(false));
      };
      document.head.appendChild(s);
    });
  }

  function buildModel(kind) {
    const P = PAL[kind], M = MODELS[kind];
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const inner = THREE.SkeletonUtils.clone(M.gltf.scene);
    inner.scale.setScalar(M.scale);
    body.add(inner);
    const mixer = new THREE.AnimationMixer(inner);
    const actions = {};
    for (const clip of M.gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    // Sorpresa y empujón se hacen una vez y quedan en la pose final
    for (const n of ['surprised', 'push']) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce); actions[n].clampWhenFinished = true; }
    // El farol del sereno: vidrio que brilla y una luz cálida que lo sigue
    if (kind === 'sereno') {
      const farol = inner.getObjectByName('Farol');
      if (farol) {
        farol.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xffb340); o.material.emissiveIntensity = 0.35; } });
        const light = new THREE.PointLight(0xffb45a, 0.9, 2.8, 2);
        light.position.set(0, -0.2 / M.scale, 0); farol.add(light);
      }
    }
    if (P.ring) {
      const ring = new THREE.Mesh(G.ring, mat(P.ring, { emissive: P.ring, emissiveIntensity: 0.25, roughness: 0.5 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.03; root.add(ring);
    }
    const ch = { kind, name: P.name, color: P.ring, root, mode: 'idle', phase: 0, stepRate: 14, seed: Math.random() * 10, model: true, mixer, actions, body, current: null };
    root.userData.ch = ch;
    ALL.push(ch);
    play(ch, 'idle', 0);
    return root;
  }

  function play(ch, name, fade = 0.18) {
    const a = ch.actions[name];
    if (!a || ch.current === a) return;
    a.reset().play();
    if (ch.current) ch.current.crossFadeTo(a, fade, false);
    ch.current = a;
  }

  const ONCE = new Set(['push', 'surprised', 'down']);
  function animateModel(ch, dt, t) {
    // Si el modelo trae un clip con el nombre del modo, lo usa; si no, camina o queda quieto
    const own = !!ch.actions[ch.mode];
    const want = own ? ch.mode : (ch.mode === 'walk' ? 'walk' : 'idle');
    if (ONCE.has(want)) { const a = ch.actions[want]; a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    play(ch, want, ch.mode === 'push' ? 0.08 : 0.18);
    if (ch.actions.walk) ch.actions.walk.timeScale = ch.stepRate / (2 * Math.PI) * ch.actions.walk.getClip().duration;
    let y = 0, lean = 0;
    if (!own) {
      if (ch.mode === 'cheer') y = Math.abs(Math.sin(t * 6)) * 0.08;
      if (ch.mode === 'surprised') y = 0.02;
      if (ch.mode === 'push') lean = 0.25;
    }
    ch.body.position.y += (y - ch.body.position.y) * Math.min(1, dt * 14);
    ch.body.rotation.x += (lean - ch.body.rotation.x) * Math.min(1, dt * 14);
    ch.mixer.update(dt);
  }

  // ---------- El perro de la banda ----------
  // Usa la pieza "perro" del kit de la playa (hecha en Blender con patas, cabeza y cola sueltas);
  // mientras no carga, un perro de formas simples. Mira hacia +Z como los demás.
  function buildDog() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const parts = { legs: [], head: null, tail: null };
    const kit = (typeof TREN !== 'undefined' && TREN.kitClone) ? TREN.kitClone('perro') : null;
    let inner;
    if (kit) {
      inner = kit;
      inner.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        const n = o.name || '';
        if (n.startsWith('perro_pata')) parts.legs.push(o);
        else if (n.startsWith('perro_cabeza') && !parts.head) parts.head = o;
        else if (n.startsWith('perro_cola') && !parts.tail) parts.tail = o;
      });
      parts.legs = parts.legs.filter(o => !o.isMesh || !o.parent || !(o.parent.name || '').startsWith('perro_pata'));
    } else {
      inner = new THREE.Group();
      const fur = mat(0xa8783e), dark = mat(0x5a3c22), light = mat(0xd8bf94);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), fur); b.scale.set(1.9, 0.9, 0.85); b.position.y = 0.42; inner.add(b);
      const hp = new THREE.Group(); hp.position.set(0.33, 0.52, 0); inner.add(hp);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), fur); h.position.set(0.1, 0.08, 0); hp.add(h);
      const sn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), light); sn.scale.set(1.3, 0.8, 0.7); sn.position.set(0.23, 0.04, 0); hp.add(sn);
      [-0.06, 0.06].forEach(z => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), dark); e.position.set(0.05, 0.22, z); hp.add(e); });
      parts.head = hp;
      const tp = new THREE.Group(); tp.position.set(-0.33, 0.5, 0); inner.add(tp);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.012, 0.3, 8), fur); t.position.set(-0.1, 0.11, 0); t.rotation.z = 0.7; tp.add(t);
      parts.tail = tp;
      [[0.25, -0.1], [0.25, 0.1], [-0.27, -0.1], [-0.27, 0.1]].forEach(([x, z]) => {
        const lp = new THREE.Group(); lp.position.set(x, 0.42, z); inner.add(lp);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.42, 8), fur); l.position.y = -0.21; lp.add(l);
        parts.legs.push(lp);
      });
      inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
    }
    inner.rotation.y = -Math.PI / 2;      // la trompa del perro (+X en Blender) mira a +Z
    inner.scale.setScalar(0.98);
    body.add(inner);
    parts.legs.forEach(l => { l.userData.r0 = l.rotation.clone(); });
    if (parts.head) parts.head.userData.r0 = parts.head.rotation.clone();
    if (parts.tail) parts.tail.userData.r0 = parts.tail.rotation.clone();
    const ch = { kind: 'perro', name: 'Perro', color: 0x7a1f36, root, mode: 'idle', phase: 0, stepRate: 16, seed: Math.random() * 10, dog: parts, body };
    root.userData.ch = ch;
    ALL.push(ch);
    return root;
  }
  function animateDog(ch, dt, t) {
    const P = ch.dog, walk = ch.mode === 'walk', bite = ch.mode === 'push' || ch.mode === 'surprised';
    if (walk) ch.phase += dt * ch.stepRate;
    P.legs.forEach((l, i) => {
      const r0 = l.userData.r0, sw = walk ? Math.sin(ch.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.55 : 0;
      // en el espacio del perro las patas giran alrededor de su eje Z (de costado)
      l.rotation.z = r0.z + sw;
    });
    if (P.tail) P.tail.rotation.y = P.tail.userData.r0.y + Math.sin(t * (walk ? 14 : 9) + ch.seed) * (bite ? 0.1 : 0.55);
    if (P.head) P.head.rotation.z = P.head.userData.r0.z + (ch.mode === 'bark' ? Math.abs(Math.sin(t * 16)) * 0.35 : bite ? 0.25 : Math.sin(t * 1.6 + ch.seed) * 0.06);
    const y = walk ? Math.abs(Math.sin(ch.phase)) * 0.03 : 0;
    ch.body.position.y += (y - ch.body.position.y) * Math.min(1, dt * 14);
    ch.body.position.z += ((bite ? 0.25 : 0) - ch.body.position.z) * Math.min(1, dt * 12);
  }

  function build(kind) {
    if (kind === 'perro') return buildDog();
    if (MODELS[kind]) return buildModel(kind);
    const P = PAL[kind];
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const hips = new THREE.Group(); hips.position.y = 0.315; body.add(hips);
    const skin = mat(P.skin);

    // Piernas
    const mkLeg = side => {
      const g = new THREE.Group(); g.position.set(side * 0.088, 0, 0);
      add(g, G.leg, mat(P.pants), 0, -0.13, 0);
      add(g, G.foot, mat(P.shoes), 0, -0.283, 0.03);
      hips.add(g);
      return g;
    };
    const legL = mkLeg(1), legR = mkLeg(-1);
    add(hips, G.pelvis, mat(P.pants), 0, 0.03, 0);

    // Torso (pivote en la cadera, para inclinarse)
    const chest = new THREE.Group(); hips.add(chest);
    add(chest, G.torso, mat(P.torso), 0, 0.2, 0);
    const sh = add(chest, G.shoulders, mat(P.torso), 0, 0.36, 0); sh.scale.set(1.22, 0.55, 0.95);
    const shoulder = new THREE.Group(); shoulder.position.y = 0.36; chest.add(shoulder);

    // Brazos: un grupo para abrirlos hacia el costado y otro para balancearlos
    let armL = null, armR = null, handR = null;
    if (kind !== 'vigia') {
      const mkArm = side => {
        const splay = new THREE.Group(); splay.position.set(side * 0.215, -0.01, 0); splay.rotation.z = side * 0.13;
        const swing = new THREE.Group(); splay.add(swing);
        add(swing, G.sleeve, mat(P.sleeve), 0, -0.085, 0);
        add(swing, G.forearm, P.forearm === 'skin' ? skin : mat(P.forearm), 0, -0.205, 0);
        const hand = add(swing, G.hand, skin, 0, -0.275, 0);
        shoulder.add(splay);
        return { splay, swing, hand, side };
      };
      armL = mkArm(1); armR = mkArm(-1); handR = armR.hand;
    }

    // Cabeza
    const head = new THREE.Group(); head.position.y = 0.05; shoulder.add(head);
    add(head, G.head, skin, 0, 0.2, 0);
    const eyeM = mat(0x1b1714, { roughness: 0.35 });
    add(head, G.eye, eyeM, 0.085, 0.225, 0.208);
    add(head, G.eye, eyeM, -0.085, 0.225, 0.208);
    add(head, G.nose, mat(P.skin, { color: new THREE.Color(P.skin).multiplyScalar(0.9) }), 0, 0.17, 0.235);
    add(head, G.ear, skin, 0.235, 0.19, 0);
    add(head, G.ear, skin, -0.235, 0.19, 0);
    const angry = kind === 'vigia' ? 0.32 : kind === 'sereno' ? 0.12 : kind === 'guarda' ? 0.22 : -0.08;
    const bl = add(head, G.brow, mat(P.brow), 0.088, 0.288, 0.2); bl.rotation.z = angry;
    const br = add(head, G.brow, mat(P.brow), -0.088, 0.288, 0.2); br.rotation.z = -angry;
    if (P.stache) {
      const s1 = add(head, G.stache, mat(P.stache), 0.045, 0.128, 0.218); s1.scale.x = 0.55; s1.rotation.z = -0.22;
      const s2 = add(head, G.stache, mat(P.stache), -0.045, 0.128, 0.218); s2.scale.x = 0.55; s2.rotation.z = 0.22;
    }

    if (kind === 'pedro') {
      // explorador: pelo canoso peinado hacia atrás y mochila con aislante
      add(head, G.hairBack, mat(P.hair), 0, 0.2, 0);
      const top = add(head, G.hairBall, mat(P.hair), 0, 0.29, -0.02); top.scale.set(1.05, 0.55, 1.05);
      const pack = add(chest, G.packBody, mat(P.pack), 0, 0.2, -0.29);
      add(pack, G.packRoll, mat(P.packRoll), 0, 0.27, 0).rotation.z = Math.PI / 2;
      add(pack, G.packStrap, mat(P.leather), 0.08, 0, -0.085); add(pack, G.packStrap, mat(P.leather), -0.08, 0, -0.085);
    }
    if (kind === 'clara') {
      add(head, G.hairBall, mat(P.hair), 0, 0.205, -0.035);
      const cap = add(head, G.scarfCap, mat(P.hat), 0, 0.21, -0.012); cap.rotation.x = -0.32;
      add(head, G.knot, mat(P.hat), 0, 0.3, -0.24);
      const t1 = add(head, G.tail, mat(P.hat), 0.04, 0.24, -0.27); t1.rotation.set(-2.6, 0, 0.35);
      const t2 = add(head, G.tail, mat(P.hat), -0.04, 0.24, -0.27); t2.rotation.set(-2.6, 0, -0.35);
      [[0.06, 0.07, -0.215], [0.054, -0.015, -0.225], [0.048, -0.095, -0.22], [0.042, -0.165, -0.21]].forEach(([r, y, z]) => {
        const b = add(head, G.braid, mat(P.hair), 0, y, z); b.scale.setScalar(r);
      });
      add(head, G.blush, mat(P.blush), 0.13, 0.135, 0.19);
      add(head, G.blush, mat(P.blush), -0.13, 0.135, 0.19);
      // tacho de cosecha colgado del hombro izquierdo hacia la cadera derecha
      const metal = mat(P.metal, { metalness: 0.55, roughness: 0.4, side: THREE.DoubleSide });
      const bucket = add(hips, G.bucket, metal, -0.25, 0.05, 0.02);
      const bb = add(bucket, G.bucketBase, metal, 0, -0.07, 0); bb.rotation.x = Math.PI / 2;
      const strap = add(chest, G.strap, mat(0x6b4a32), 0, 0.27, 0.185); strap.rotation.z = -0.62;
      const strapB = add(chest, G.strap, mat(0x6b4a32), 0, 0.27, -0.185); strapB.rotation.z = 0.62;
    }
    if (kind === 'vigia') {
      add(shoulder, G.poncho, mat(P.poncho), 0, -0.17, 0);
      add(shoulder, G.collar, mat(P.poncho), 0, 0.05, 0);
      add(head, G.woolCap, mat(P.hat), 0, 0.235, 0);
      const fold = add(head, G.capFold, mat(P.hat), 0, 0.245, 0); fold.rotation.x = Math.PI / 2;
      add(head, G.pompom, mat(0x55505c), 0, 0.51, 0);
    }
    if (kind === 'sereno') {
      add(hips, G.skirt, mat(P.torso, { side: THREE.DoubleSide }), 0, -0.07, 0);
      add(head, G.flatCap, mat(P.hat), 0, 0.385, -0.01);
      add(head, G.visor, mat(P.hat), 0, 0.36, 0.25);
      // farol de kerosene en la mano derecha
      const lamp = new THREE.Group(); lamp.position.set(0, -0.36, 0.02); armR.swing.add(lamp);
      const brass = mat(P.brass, { metalness: 0.6, roughness: 0.35 });
      add(lamp, G.lampHandle, brass, 0, 0.075, 0);
      add(lamp, G.lampTop, brass, 0, 0.06, 0);
      const glass = add(lamp, G.lampGlass, new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb340, emissiveIntensity: 1.1, roughness: 0.3 }), 0, 0, 0);
      glass.castShadow = false;
      add(lamp, G.lampBase, brass, 0, -0.055, 0);
      const light = new THREE.PointLight(0xffb45a, 0.9, 2.8, 2);
      lamp.add(light);
    }

    if (kind === 'guarda') {
      // gorra de guarda con visera y cinta dorada, botones dorados y banderín rojo
      add(head, G.flatCap, mat(P.hat), 0, 0.385, -0.01);
      const band = add(head, G.capBand, mat(P.brass, { metalness: 0.6, roughness: 0.35 }), 0, 0.36, -0.01);
      add(head, G.visor, mat(0x111216), 0, 0.355, 0.25);
      [0.3, 0.2, 0.1].forEach(y => add(chest, G.button, mat(P.brass, { metalness: 0.6, roughness: 0.35 }), 0, y, 0.19));
      const flag = new THREE.Group(); flag.position.set(0, -0.3, 0.03); armR.swing.add(flag);
      add(flag, G.flagStick, mat(0x6b4a32), 0, 0.1, 0);
      const cloth = add(flag, G.flagCloth, mat(0xc4332e, { side: THREE.DoubleSide }), 0.07, 0.23, 0);
      cloth.castShadow = false;
    }

    // Aro de color bajo los pies (solo los personajes jugables)
    if (P.ring) {
      const ring = new THREE.Mesh(G.ring, mat(P.ring, { emissive: P.ring, emissiveIntensity: 0.25, roughness: 0.5 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.03;
      root.add(ring);
    }

    const ch = {
      kind, name: P.name, color: P.ring, root, mode: 'idle', phase: 0, stepRate: 14, seed: Math.random() * 10,
      rig: { body, hips, chest, head, legL, legR, armL, armR },
    };
    root.userData.ch = ch;
    ALL.push(ch);
    return root;
  }

  // Ángulos objetivo por modo; cada cuadro las articulaciones se acercan suavemente a ellos.
  function animate(ch, dt, t) {
    const r = ch.rig, s0 = Math.sin(ch.phase);
    const T = { legL: 0, legR: 0, armL: 0.05, armR: 0.05, splay: 0, body: 0, lean: 0, headY: 0, headX: 0 };
    switch (ch.mode) {
      case 'walk': {
        ch.phase += dt * ch.stepRate;
        const s = Math.sin(ch.phase);
        T.legL = s * 0.75; T.legR = -s * 0.75;
        T.armL = -s * 0.65; T.armR = s * 0.65;
        T.body = Math.abs(Math.cos(ch.phase)) * 0.055;
        T.lean = 0.09;
        break;
      }
      case 'idle':
        T.headY = Math.sin(t * 0.7 + ch.seed) * (ch.kind === 'vigia' ? 0.06 : 0.16);
        T.headX = Math.sin(t * 0.5 + ch.seed * 2) * 0.03;
        break;
      case 'push':
        T.armL = -1.45; T.armR = -1.45; T.lean = 0.2; T.legL = -0.35; T.legR = 0.25;
        break;
      case 'surprised':
        T.armL = -2.75; T.armR = -2.75; T.splay = 0.35; T.headX = -0.18; T.lean = -0.1;
        break;
      case 'cheer':
        T.armR = -2.9; T.splay = 0.25 + Math.sin(t * 9) * 0.3; T.armL = 0.15;
        T.body = Math.abs(Math.sin(t * 6)) * 0.07; T.headX = -0.15;
        break;
      case 'down':
        T.armL = 0.4; T.armR = -0.3; T.splay = 0.4; T.legL = 0.2; T.legR = -0.15;
        break;
    }
    if (ch.kind === 'sereno') { T.armR = ch.mode === 'push' ? -1.2 : -0.35 + (T.armR - 0.05) * 0.25; }
    if (ch.kind === 'guarda' && ch.mode === 'idle') { T.armR = -0.5 + Math.sin(t * 2.4 + ch.seed) * 0.08; T.headY = 0; }
    const k = 1 - Math.exp(-dt * (ch.mode === 'walk' ? 30 : 12));
    const ease = (obj, prop, v) => { obj[prop] += (v - obj[prop]) * k; };
    ease(r.legL.rotation, 'x', T.legL);
    ease(r.legR.rotation, 'x', T.legR);
    if (r.armL) {
      ease(r.armL.swing.rotation, 'x', T.armL);
      ease(r.armR.swing.rotation, 'x', T.armR);
      ease(r.armL.splay.rotation, 'z', 0.13 + T.splay);
      ease(r.armR.splay.rotation, 'z', -0.13 - T.splay);
    }
    ease(r.body.position, 'y', T.body);
    ease(r.chest.rotation, 'x', T.lean);
    ease(r.head.rotation, 'y', T.headY);
    ease(r.head.rotation, 'x', T.headX);
    r.chest.scale.y = ch.mode === 'idle' ? 1 + Math.sin(t * 2.2 + ch.seed) * 0.014 : 1;
  }

  function tick(dt, t) {
    for (let i = ALL.length - 1; i >= 0; i--) {
      const ch = ALL[i];
      if (ch.dead) { ALL.splice(i, 1); continue; }
      if (!ch.root.parent) continue;
      if (ch.dog) animateDog(ch, dt, t); else if (ch.model) animateModel(ch, dt, t); else animate(ch, dt, t);
    }
  }
  function release(root) { if (root && root.userData.ch) root.userData.ch.dead = true; }

  return { build, tick, release, PAL, loadModel, has: k => !!MODELS[k], set onModel(f) { onModel = f; }, notify: k => onModel && onModel(k) };
})();
