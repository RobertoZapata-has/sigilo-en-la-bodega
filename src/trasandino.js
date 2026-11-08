// ===== CAPÍTULO 2: EL TRASANDINO =====
// Escenarios del ferrocarril armados con las piezas hechas en Blender (assets/modelos/trasandino,
// empaquetadas en trasandino_model.js como window.KIT_B64). Mientras no cargan, cada pieza muestra
// una versión de formas simples (la del capítulo viejo).
// Convención de las piezas: los trenes van a lo largo de X con la trompa hacia +X; los edificios
// miran hacia +Z (hacia la cámara). Ruedas y bases apoyan en Y = 0.
const TREN = (() => {
  const P = DECOR.parts;
  const mat = P.mat, shadow = P.shadow;
  const RAIL_Y = 0.19;          // altura del riel: los coches apoyan acá
  const KIT = {};
  let slots = [];

  // ---------- carga de piezas ----------
  function loadKit(url, done, varName = 'KIT_B64') {
    if (!THREE.GLTFLoader) return;
    const s = document.createElement('script'); s.src = url; s.async = true;
    s.onload = () => {
      const all = window[varName] || {}; delete window[varName];
      const names = Object.keys(all); let left = names.length;
      const fin = () => { if (--left === 0) { applyKit(); if (done) done(); } };
      names.forEach(n => {
        const bin = atob(all[n]), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        new THREE.GLTFLoader().parse(buf.buffer, '', g => {
          const root = g.scene;
          root.traverse(o => {
            if (!o.isMesh) return;
            o.castShadow = true; o.receiveShadow = true;
            o.geometry.userData.keep = true;
            const m = o.material;
            // el juego dibuja en espacio lineal: los colores elegidos en Blender se pasan a sRGB para que se vean igual
            if (!m.userData.fixed) {
              m.color.convertLinearToSRGB(); m.emissive.convertLinearToSRGB();
              if (m.emissiveIntensity > 1) m.emissiveIntensity = Math.min(1.6, m.emissiveIntensity * 0.4);
              m.userData.fixed = true;
            }
          });
          const bb = new THREE.Box3().setFromObject(root);
          KIT[n] = { root, bb, size: bb.getSize(new THREE.Vector3()) };
          fin();
        }, fin);
      });
    };
    document.head.appendChild(s);
  }
  const has = n => !!KIT[n];
  function clone(n) { return KIT[n].root.clone(true); }
  // Hueco: muestra "fallback" hasta que la pieza de Blender esté lista; "make" arma la versión buena
  function slot(fallback, make) {
    const g = new THREE.Group();
    if (fallback) g.add(fallback);
    slots.push({ g, make });
    applyKit();
    return g;
  }
  function applyKit() {
    slots = slots.filter(sl => {
      if (sl.done) return false;
      let o = sl.g; while (o.parent) o = o.parent;
      const n = sl.make(); if (!n) return true;          // todavía no cargó
      sl.g.children.slice().forEach(c => sl.g.remove(c));
      sl.g.add(n); sl.done = true; return false;
    });
  }
  // Pieza del kit con un tamaño dado: len (largo en X), h (alto) o s (escala)
  function piece(name, opt = {}, fallback) {
    return slot(fallback ? fallback() : null, () => {
      if (!has(name)) return null;
      const K = KIT[name], o = clone(name);
      let sx = 1, sy = 1, sz = 1;
      if (opt.s) sx = sy = sz = opt.s;
      if (opt.h) sx = sy = sz = opt.h / K.size.y;
      if (opt.len) sx = opt.len / K.size.x;
      o.scale.set(sx, sy, sz);
      if (!opt.keep) {
        const c = K.bb.getCenter(new THREE.Vector3());
        o.position.set(-c.x * sx, -K.bb.min.y * sy, -c.z * sz);
      }
      const w = new THREE.Group(); w.add(o); w.position.y = opt.y || 0; return w;
    });
  }

  function kitClone(name) {
    if (!has(name)) return null;
    const o = clone(name), w = new THREE.Group(); w.add(o); return w;
  }

  // ---------- piezas sueltas ----------
  const glow = (c = 0xffd38a, e = 0xffaa55, i = 1.2) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: i });
  function signTexture(text, sub) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 72;
    const x = cv.getContext('2d');
    x.fillStyle = '#f1e8d2'; x.fillRect(0, 0, 512, 72);
    x.strokeStyle = '#2f4a3a'; x.lineWidth = 4; x.strokeRect(6, 6, 500, 60);
    x.fillStyle = '#22352a'; x.font = '700 40px Georgia, "Times New Roman", serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text.toUpperCase().split('').join(String.fromCharCode(8202)), 256, 38);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  function sign(text, w = 2.0, h = 0.28) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.6, emissive: 0x2a2418, emissiveIntensity: 0.6 }));
    return m;
  }
  // Estación con galería y cartel con el nombre. W = ancho aproximado (mundo)
  function estacion(name, W = 6.5) {
    const s = W / 6.5;
    const g = piece('estacion', { s, keep: true }, () => P.station(W, 1.8, 1.75));
    const sg = sign(name, 2.0 * s, 0.26 * s); sg.position.set(0, 1.86 * s, 0.94 * s + 0.012); g.add(sg);
    const l = new THREE.PointLight(0xffb060, 1.1, 6, 2); l.position.set(0, 1.3, 1.9); g.add(l);
    return g;
  }
  function coche(len, ladders = []) {
    const g = new THREE.Group();
    g.add(piece('coche', { len, y: RAIL_Y }, () => P.wagon(len, [])));
    for (const [lx, side] of ladders) { const l = P.ladder(1.18); l.position.set(lx, 0, side * 0.74); g.add(l); }
    return g;
  }
  function furgon(len = 3.4) {
    const g = new THREE.Group();
    g.add(piece('furgon', { len, y: RAIL_Y }, () => P.wagon(len, [])));
    return g;
  }
  function loco(scale = 0.74) {
    const g = new THREE.Group();
    g.add(piece('locomotora', { s: scale, y: RAIL_Y }, () => { const f = P.locomotive().g; f.scale.setScalar(0.92); return f; }));
    // humo y farol
    const puffs = [], smokeM = new THREE.MeshStandardMaterial({ color: 0xdfe0e6, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
    for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), smokeM.clone()); p.castShadow = false; g.add(p); puffs.push(p); }
    const head = new THREE.SpotLight(0xffe2a0, 1.4, 8, 0.5, 0.5, 1.5); head.position.set(1.6, 1.4, 0); head.target.position.set(5, 0, 0); g.add(head, head.target);
    g.userData.smoke = (t, speed = 1) => puffs.forEach((p, i) => {
      const u = ((t * 0.35 * speed + i / puffs.length) % 1);
      p.position.set(1.2 - u * 1.8, 1.72 + u * 1.3, Math.sin(i * 2.1 + t) * 0.15 * u);
      p.scale.setScalar(0.5 + u * 1.9); p.material.opacity = 0.55 * (1 - u);
    });
    return g;
  }
  // Tren entero en fila: [['loco'], ['coche', len], ['furgon', len]] de adelante hacia atrás (de +x a -x)
  function trainSet(spec, gap = 0.25) {
    const g = new THREE.Group(); let x = 0; const parts = [];
    for (const [k, len] of spec) {
      const L = k === 'loco' ? 3.45 : len;
      const o = k === 'loco' ? loco() : k === 'coche' ? coche(len) : furgon(len);
      o.position.x = x - L / 2; x -= L + gap; g.add(o); parts.push(o);
    }
    g.userData.length = -x - gap;
    g.userData.parts = parts;
    return g;
  }

  function rails(x0, x1, z) { return P.rails(x0, x1, z); }
  function plat(a, b, y = 0.03, color = 0x9c958a) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(b.x - a.x), y, Math.abs(b.z - a.z)), mat(color, { roughness: 0.95 }));
    m.position.set((a.x + b.x) / 2, y / 2, (a.z + b.z) / 2); m.receiveShadow = true; return m;
  }
  function yellowLine(x0, x1, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.035, 0.09), mat(0xd9b23e, { emissive: 0x3a2c00 }));
    m.position.set((x0 + x1) / 2, 0.035, z); return m;
  }
  function alamo(gold, h = 2.6) { return piece(gold ? 'alamo_oro' : 'alamo', { h }, () => { const t = P.bush(1.6); t.scale.y = 3; return t; }); }
  function roca(big, s = 1) { return piece(big ? 'roca1' : 'roca2', { s }, () => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 * s, 0), mat(0x8b7461, { flatShading: true })); m.scale.y = 0.5; m.position.y = 0.1; return m; }); }
  function cerro(s = 0.6) { return piece('cerro', { s }, () => { const m = new THREE.Mesh(new THREE.ConeGeometry(3 * s, 4 * s, 7), mat(0x6b5848, { flatShading: true })); m.position.y = 2 * s; return m; }); }
  function senal(s = 0.75) { return piece('senal', { s }, () => P.farol(false)); }
  function tanque(s = 0.9) { return piece('tanque', { s }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 16), mat(0x7a5330)); m.position.y = 1.6; return m; }); }
  function kiosco() {   // boletería exenta: casilla de madera con ventanilla encendida
    const g = new THREE.Group(), wood = mat(0x2f4a3a), cream = mat(0xe2cfa6);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.7), cream); b.position.y = 0.5; g.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.4, 4), mat(0x9a3b2a)); r.position.y = 1.2; r.rotation.y = Math.PI / 4; r.scale.z = 0.8; g.add(r);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.02), glow()); w.position.set(0, 0.62, 0.36); g.add(w);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.14), wood); sill.position.set(0, 0.45, 0.39); g.add(sill);
    const sg = sign('Boletería', 0.8, 0.13); sg.position.set(0, 0.88, 0.352); g.add(sg);
    return shadow(g);
  }
  function auto(color = 0x6d8fa8) {   // un Falcon de los 70, en formas simples
    const g = new THREE.Group(), body = mat(color, { roughness: 0.4, metalness: 0.3 }), dark = mat(0x1d1f22), chrome = mat(0xc9ccd1, { metalness: 0.8, roughness: 0.3 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.66), body); b.position.y = 0.3; g.add(b);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.6), body); c.position.set(-0.08, 0.56, 0); g.add(c);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.62), mat(0x283246, { roughness: 0.2, metalness: 0.5 })); gl.position.set(-0.08, 0.56, 0); g.add(gl);
    [[0.48, 0.33], [-0.48, 0.33], [0.48, -0.33], [-0.48, -0.33]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 14), dark); w.rotation.x = Math.PI / 2; w.position.set(x, 0.14, z); g.add(w); });
    const bump = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.68), chrome); bump.position.set(0.77, 0.2, 0); g.add(bump);
    [-0.2, 0.2].forEach(z => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), glow(0xfff1c4, 0xffe08a, 1.4)); l.rotation.z = Math.PI / 2; l.position.set(0.76, 0.32, z); g.add(l); });
    return shadow(g);
  }
  function valijas() {
    const g = new THREE.Group();
    const a = P.suitcase(0x7b4a2a); a.position.set(0, 0, 0); g.add(a);
    const b = P.suitcase(0x3b5a6b, 0.36, 0.26); b.position.set(0.05, 0.3, 0); b.rotation.y = 0.2; g.add(b);
    const c = P.suitcase(0x8a2f2f, 0.4, 0.28); c.position.set(0.42, 0, 0.12); c.rotation.y = -0.4; g.add(c);
    return g;
  }
  // Agua del río: plano con ondas que se mueven
  function water(w, d) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = '#4f6f78'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(${210 + Math.random() * 45},${225 + Math.random() * 30},${230 + Math.random() * 25},${0.15 + Math.random() * 0.35})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 10 + Math.random() * 26); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 2, d / 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.2, metalness: 0.1, color: 0xffffff, emissive: 0x1a3038, emissiveIntensity: 0.5 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.receiveShadow = true;
    m.userData.tex = t;
    return m;
  }
  // Nieve: manchas blancas sobre el piso
  function snowPatches(board, toW, box, n = 14, seed = 5) {
    let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const m = mat(0xf1f4fa, { roughness: 0.7 });
    for (let i = 0; i < n; i++) {
      const p = toW(box[0] + R() * (box[2] - box[0]), box[1] + R() * (box[3] - box[1]));
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.3 + R() * 0.5, 9), m); d.rotation.x = -Math.PI / 2; d.scale.y = 0.6 + R() * 0.6;
      d.position.set(p.x, 0.008 + i * 0.0003, p.z); d.receiveShadow = true; board.add(d);
    }
  }

  // ---------- escenas ----------
  // Cada escena recibe el tablero, el pasaje de casilleros a mundo y el nivel leído; devuelve
  // { update(t), passTrain(i) (promesa), setDoors(t) }.
  function build(scene, board, toW, SP, LV, LVD, box) {
    slots = slots.filter(s => !s.done);
    const add = (o, gx, gy, ry = 0, y = 0) => { const p = toW(gx, gy); o.position.set(p.x, y, p.z); o.rotation.y = ry; board.add(o); return o; };
    const api = { tick: [], trains: [], doors: [] };
    const [bx0, by0, bx1, by1] = box;
    const W = (gx, gy) => toW(gx, gy);

    // vías con trenes que pasan (niveles con "trains")
    (LVD.trains || []).forEach((t, i) => {
      const z = W(0, t.y).z;
      board.add(rails(W(bx0 + 0.05, 0).x, W(bx1 - 0.05, 0).x, z));
      api.trains[i] = { z, dir: t.dir || 1 };
    });

    if (scene === 'boleteria') {
      add(estacion('Mendoza', 8.4), 2, by0 + 0.75);
      add(kiosco(), -0.8, 0.0, 0.5);
      add(P.farol(true), 0.5, -0.55); add(P.farol(true), 3.5, -0.55); add(P.farol(false), -0.7, 2.6);
      add(P.bench(), 1.0, 0.48); add(P.bench(), 3.0, 0.48);
      add(alamo(false, 3.0), -1.0, -1.3); add(alamo(false, 2.8), 5.1, -1.3); add(alamo(false, 2.6), -1.05, 1.2);
      add(auto(0x6d8fa8), 4.9, 2.55, -0.35); add(auto(0x9a3b2a), 0.1, 3.0, 0.2);
      add(valijas(), 4.8, 0.5, 0.4);
      add(P.bush(1.1), 5.2, 1.4); add(P.bush(0.9), 1.0, 2.9);
    }

    if (scene === 'anden') {
      add(estacion('Mendoza', 9), 3, by0 + 0.78);
      board.add(plat(W(bx0 + 0.1, by0 + 0.2), W(bx1 - 0.1, 2.85), 0.03));
      board.add(yellowLine(W(bx0 + 0.1, 0).x, W(bx1 - 0.1, 0).x, W(0, 2.75).z));
      const tz = W(0, 3.75).z;
      board.add(rails(W(bx0 + 0.05, 0).x, W(bx1 - 0.05, 0).x, tz));
      const tr = trainSet([['loco'], ['coche', 4.2], ['coche', 4.2], ['furgon', 3.4]]);
      tr.position.set(W(bx1 - 0.4, 0).x, 0, tz); board.add(tr);
      api.tick.push(t => tr.userData.parts[0].userData.smoke(t));
      add(P.farol(true), 1.0, 2.35); add(P.farol(true), 5.0, 2.35); add(P.farol(false), -0.75, -0.55);
      add(alamo(false, 3), bx0 + 0.4, by0 + 0.4);
    }

    if (scene === 'vias') {
      // andén arriba, ripio entre vías, galpón de locomotoras al fondo
      board.add(plat(W(bx0 + 0.1, by0 + 0.15), W(bx1 - 0.1, 0.5), 0.03));
      board.add(yellowLine(W(bx0 + 0.1, 0).x, W(bx1 - 0.1, 0).x, W(0, 0.45).z));
      add(estacion('Cargas', 5), 1.6, by0 - 0.35);
      add(tanque(0.9), bx1 - 0.45, 1.95);
      add(senal(0.8), bx0 + 0.3, 0.62, 0); add(senal(0.8), bx0 + 0.3, 2.62, 0);
      add(P.crate(0.5), bx1 - 0.5, 0.2); add(P.crate(0.4), bx1 - 0.35, -0.2, 0.4);
      add(P.farol(true), 2.5, 2.0); add(P.farol(false), bx0 + 0.4, 4.0);
      // vía muerta al fondo con furgones quietos
      add(roca(true, 0.8), bx1 - 0.4, by1 - 0.4); add(roca(false, 1), bx0 + 0.5, by1 - 0.3);
      add(alamo(true, 2.8), bx0 + 0.3, by0 + 0.3);
    }

    if (scene === 'vagon') {
      // tres coches cortados (sin techo) sobre la vía; afuera, el andén
      board.add(plat(W(bx0 + 0.1, by0 + 0.15), W(bx1 - 0.1, 0.5), 0.03));
      board.add(yellowLine(W(bx0 + 0.1, 0).x, W(bx1 - 0.1, 0).x, W(0, 0.48).z));
      const coachX = [[-0.45, 2.45], [2.55, 5.45], [5.55, 8.45]];
      const teak = mat(0x7a4526, { roughness: 0.55 }), teakD = mat(0x4e2a17), cream = mat(0xe8d8b0), floorM = mat(0x8a6440, { roughness: 0.85 }), seatM = mat(0x3f5f44, { roughness: 0.7 }), brass = mat(0xc9a24a, { metalness: 0.8, roughness: 0.3 }), under = mat(0x1b1c21, { metalness: 0.3 });
      const gz0 = 0.55, gz1 = 2.5, Hw = 0.42;
      const doorsAt = [0, 3, 6, 8];
      coachX.forEach(([a, b], ci) => {
        const p0 = W(a, gz0), p1 = W(b, gz1), cx = (p0.x + p1.x) / 2, cz = (p0.z + p1.z) / 2, L = p1.x - p0.x, D = p1.z - p0.z;
        const g = new THREE.Group(); g.position.set(cx, -0.012, cz); board.add(g);   // el piso del coche queda a ras de los puntos
        const box2 = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
        box2(L, 0.1, D, 0, -0.05, 0, under);
        box2(L - 0.08, 0.04, D - 0.08, 0, 0.02, 0, floorM);
        // pared del lado del andén con huecos de puerta en los puntos que conectan
        const zN = -D / 2, zS = D / 2;
        const gaps = doorsAt.filter(x => x >= a && x <= b).map(x => W(x, 0).x - cx).sort((u, v) => u - v);
        let from = -L / 2;
        for (const gx of [...gaps, L / 2 + 0.6]) {
          const to = Math.min(L / 2, gx - 0.55);
          if (to > from + 0.05) { box2(to - from, Hw, 0.08, (from + to) / 2, Hw / 2, zN, teak); box2(to - from, 0.04, 0.1, (from + to) / 2, Hw, zN, cream); }
          from = gx + 0.55;
        }
        // pared de atrás con ventanas encendidas
        box2(L, Hw, 0.08, 0, Hw / 2, zS, teak); box2(L, 0.04, 0.1, 0, Hw, zS, cream);
        for (let k = 0; k < Math.floor(L / 0.7); k++) box2(0.34, 0.16, 0.02, -L / 2 + 0.45 + k * 0.7, 0.28, zS + 0.05, glow());
        // testeros
        [-1, 1].forEach(s => { box2(0.08, Hw, D * 0.32, s * L / 2, Hw / 2, -D * 0.34, teak); box2(0.08, Hw, D * 0.32, s * L / 2, Hw / 2, D * 0.34, teak); });
        // compartimientos: asientos enfrentados a los lados del punto del fondo, y tabiques
        const ccx = W(1 + ci * 3, 0).x - cx;
        [-0.62, 0.62].forEach(dx => {
          box2(0.36, 0.2, 0.8, ccx + dx, 0.12, zS - 0.5, seatM); box2(0.08, 0.36, 0.8, ccx + dx + Math.sign(dx) * 0.18, 0.2, zS - 0.5, seatM);
        });
        [-0.95, 0.95].forEach(dx => box2(0.05, Hw * 0.9, 0.95, ccx + dx, Hw * 0.45, zS - 0.5, teakD));
        // lamparitas
        const lamp = new THREE.PointLight(0xffb060, 0.7, 3.2, 2); lamp.position.set(ccx, 0.9, 0); g.add(lamp);
        box2(0.08, 0.08, 0.08, ccx, 0.62, zS - 0.05, glow(0xfff1c4, 0xffd08a, 1.4));
        // bogies debajo
        [-L / 2 + 0.6, L / 2 - 0.6].forEach(x => { [-D / 2 + 0.25, D / 2 - 0.25].forEach(z => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 14), under); w.rotation.x = Math.PI / 2; w.position.set(x, -0.18, z); g.add(w); }); });
      });
      // fuelles entre coches y puertas corredizas (se abren y se cierran)
      (LVD.doors || []).forEach((d, i) => {
        const mx = (d.a[0] + d.b[0]) / 2, p = W(mx, d.a[1]);
        const bel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.95), mat(0x26282c, { roughness: 1 })); bel.position.set(p.x, 0.25, p.z); board.add(bel);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 1.0), brass); frame.position.set(p.x, Hw + 0.12, p.z); board.add(frame);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.48), mat(0x5a3420, { roughness: 0.6 }));
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.3), glow(0xffe0a0, 0xffb060, 0.8)); pane.position.y = 0.08; leaf.add(pane);
        leaf.castShadow = true; board.add(leaf);
        api.doors[i] = { leaf, x: p.x, z: p.z, cur: null };
      });
      add(P.farol(true), 1.5, -0.45); add(P.farol(true), 4.5, -0.45); add(P.farol(true), 7.5, -0.45);
      add(P.bench(), 4.0, -0.62); add(valijas(), 6.6, -0.62);
      add(estacion('Mendoza', 6), 4, by0 - 0.55);
    }

    if (scene === 'techo') {
      board.add(plat(W(bx0 + 0.1, by0 + 0.4), W(bx1 - 0.1, 1.5), 0.03, 0x8f887c));
      board.add(yellowLine(W(bx0 + 0.1, 0).x, W(bx1 - 0.1, 0).x, W(0, 1.42).z));
      add(estacion('Uspallata', 7), 2.2, by0 + 0.95);
      const rz = W(0, 2).z;
      board.add(rails(W(bx0 + 0.05, 0).x, W(bx1 - 0.05, 0).x, rz));
      const w1 = [0.55, 2.45], w2 = [2.6, 5.45];
      const mk = (r, lads) => {
        const x0 = W(r[0], 0).x, x1 = W(r[1], 0).x, c = (x0 + x1) / 2;
        const o = coche(x1 - x0, lads.map(([gx, side]) => [W(gx, 0).x - c, side])); o.position.set(c, 0, rz); board.add(o); return o;
      };
      const c1 = mk(w1, [[1, -1], [2, 1]]), c2 = mk(w2, [[4, -1], [5, 1]]);
      const lc = loco(); lc.position.set(W(6.55, 0).x, 0, rz); board.add(lc);
      api.tick.push(t => lc.userData.smoke(t, 0.5));
      add(tanque(0.95), 6.75, 0.85);
      add(cerro(0.55), bx0 + 0.9, by0 + 0.9); add(cerro(0.42), bx0 + 2.2, by0 + 0.5, 0.6);
      add(alamo(true, 2.8), bx1 - 0.5, by0 + 0.5); add(alamo(true, 2.4), bx0 + 0.35, 1.3);
      add(roca(true, 0.9), bx1 - 0.4, by1 - 0.4); add(roca(false, 1.2), 3.3, by1 - 0.3);
      add(P.farol(true), 3.0, 1.3); add(P.farol(false), -0.7, 1.2);
    }

    if (scene === 'puente') {
      // río Mendoza: columna x = 3, de arriba a abajo
      const rx0 = W(2.45, 0).x, rx1 = W(3.55, 0).x, zt = W(0, by0).z, zb = W(0, by1).z;
      const wt = water(rx1 - rx0, zb - zt); wt.position.x = (rx0 + rx1) / 2; wt.position.z = (zt + zb) / 2; board.add(wt);
      api.tick.push(t => { wt.userData.tex.offset.y = -t * 0.25; });
      for (let k = 0; k < 9; k++) {
        const gy = by0 + 0.2 + k * (by1 - by0 - 0.4) / 8;
        if (Math.abs(gy - 1) < 0.6 || Math.abs(gy - 2) < 0.6) continue;
        add(roca(k % 2 === 0, 0.7 + (k % 3) * 0.2), 2.45 + (k % 2) * 0.05, gy, k);
        add(roca(k % 2 === 1, 0.6 + (k % 3) * 0.2), 3.55 - (k % 2) * 0.05, gy + 0.2, k * 2);
      }
      // puentes de hierro para las dos vías
      [1, 2].forEach(gy => add(piece('puente_hierro', { len: (rx1 - rx0) * 1.55, keep: true }, () => { const g = new THREE.Group(); const d = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.5), mat(0x6e2a22)); d.position.y = 0.05; g.add(d); return g; }), 3, gy));
      // tren frenado sobre el puente (los techos son puntos del tablero)
      const rz = W(0, 2).z;
      board.add(rails(W(bx0 + 0.05, 0).x, W(bx1 - 0.05, 0).x, rz));
      const x0 = W(0.55, 0).x, xm = W(2.95, 0).x, x1 = W(5.45, 0).x;
      const ca = coche(xm - x0 - 0.1, [[W(1, 0).x - (x0 + xm) / 2, -1], [W(1, 0).x - (x0 + xm) / 2, 1]]); ca.position.set((x0 + xm) / 2, 0, rz); board.add(ca);
      const cb = coche(x1 - xm - 0.1, [[W(5, 0).x - (xm + x1) / 2, -1], [W(5, 0).x - (xm + x1) / 2, 1]]); cb.position.set((xm + x1) / 2, 0, rz); board.add(cb);
      const lc = loco(); lc.position.set(W(6.6, 0).x, 0, rz); board.add(lc);
      api.tick.push(t => lc.userData.smoke(t, 0.35));
      // túnel a la izquierda, donde entra la vía; cerros y álamos atrás
      add(piece('tunel', { s: 0.5 }, null), bx0 + 0.25, 1.5, Math.PI / 2);
      add(cerro(0.5), bx0 + 1.3, by0 + 0.75); add(cerro(0.4), 5.4, by0 + 0.7, 1.2);
      add(alamo(true, 2.6), 4.2, by0 + 0.5); add(alamo(true, 2.2), 6.7, by0 + 0.6);
      add(senal(0.75), 4.4, 0.62); add(P.farol(false), 0.5, 3.6);
      snowPatches(board, toW, [bx0 + 0.3, by0 + 0.2, 2.2, by1 - 0.2], 7, 3);
      snowPatches(board, toW, [3.8, by0 + 0.2, bx1 - 0.3, by1 - 0.2], 7, 9);
    }

    // ===== CAPÍTULO 3: LA PLAYA DE CAMIONES =====
    if (LVD.theme === 'playa') buildPlaya(scene, board, toW, LV, LVD, box, add, api);

    // los trenes de paso: se arman una vez y se esconden hasta que pasan
    api.trains.forEach((tr, i) => {
      const set = trainSet([['loco'], ['furgon', 3.2], ['furgon', 3.2]]);
      set.visible = false; set.position.z = tr.z; board.add(set);
      tr.set = set; tr.x0 = W(bx0, 0).x; tr.x1 = W(bx1, 0).x;
    });
    applyKit();
    let tNow = 0;
    return {
      update(t) { tNow = t; api.tick.forEach(f => f(t)); api.trains.forEach(tr => { if (tr.set.visible) tr.set.userData.parts[0].userData.smoke(t, 2.5); }); },
      // faros: prende o apaga cada haz y lo corta donde hay un cajón
      setLights(t, crates) { (api.beams || []).forEach(b => b.set(t, crates)); },
      // el tren cruza de punta a punta (dir 1: de izquierda a derecha)
      passTrain(i, tween) {
        const tr = api.trains[i]; if (!tr) return Promise.resolve();
        const s = tr.set, L = s.userData.length, dir = tr.dir;
        s.rotation.y = dir > 0 ? 0 : Math.PI; s.visible = true;
        const a = dir > 0 ? tr.x0 - 0.5 : tr.x1 + 0.5, b = dir > 0 ? tr.x1 + L + 0.5 : tr.x0 - L - 0.5;
        return tween(1100, u => { s.position.x = a + (b - a) * u; }).then(() => { s.visible = false; });
      },
      // puertas: abiertas = la hoja corrida al costado
      setDoors(t, animate, tween) {
        (LVD.doors || []).forEach((d, i) => {
          const D = api.doors[i]; if (!D) return;
          const open = ((t + (d.phase || 0)) % d.every) < (d.open || 1);
          const z1 = D.z + (open ? 0.42 : 0);
          if (D.cur === null || !animate) { D.leaf.position.set(D.x, 0.27, z1); D.cur = open; return; }
          if (D.cur === open) return;
          D.cur = open; const z0 = D.leaf.position.z;
          tween(260, u => { D.leaf.position.z = z0 + (z1 - z0) * u; });
        });
      },
    };
  }

  // ---------- piezas del capítulo 3 ----------
  const PAINTS = [0x4f8c8a, 0x9a3b2a, 0xc9a33a, 0x5b6f8f, 0x6f8a4a];
  function camion(color, lightsOn = false) {
    return piece('camion', { s: 0.92 }, () => {
      const g = new THREE.Group(), m = mat(color || 0x4f8c8a, { roughness: 0.5 });
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.3), m); cab.position.set(0.9, 0.95, 0); g.add(cab);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.4), mat(0x9a7046)); bed.position.set(-0.9, 0.9, 0); g.add(bed);
      return shadow(g);
    });
  }
  function paintTruck(g, color) {   // cada camión de otro color: se clona el material de la pintura
    g.traverse(o => { if (o.isMesh && o.material && o.material.name === 'sk_camion_pintura') { o.material = o.material.clone(); o.material.color.set(color); } });
  }
  function crateMesh() { return piece('cajon', { s: 1.05 }, () => { const g = P.crate(0.75); return g; }); }
  function stonePile() {
    const g = new THREE.Group(), m = mat(0x8e8a80, { roughness: 0.9, flatShading: true });
    [[0, 0, 0.1], [0.12, 0.06, 0.07], [-0.1, 0.08, 0.06], [0.04, -0.1, 0.065]].forEach(([x, z, r]) => { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), m); st.position.set(x, r * 0.7, z); st.castShadow = true; g.add(st); });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 32), new THREE.MeshBasicMaterial({ color: 0xd8b25e, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
    return g;
  }
  // Haz de luz de un faro sobre una fila de puntos
  function beam(board, toW, LV, l, i) {
    const g = new THREE.Group(); board.add(g);
    const tex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,236,170,0.75)'); gr.addColorStop(1, 'rgba(255,236,170,0.08)');
      x.fillStyle = gr; x.fillRect(0, 0, 256, 64); const v = x.createLinearGradient(0, 0, 0, 64); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = v; x.fillRect(0, 0, 256, 64); return new THREE.CanvasTexture(cv); })();
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.15), m); plane.rotation.x = -Math.PI / 2; plane.position.y = 0.06; g.add(plane);
    const glowM = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.12, 1, 18, 1, true), glowM); g.add(cone);
    const [dx, dy] = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }[l.dir];
    const first = l.beam[0].split(',').map(Number);
    const src = toW(first[0] - dx * 0.95, first[1] - dy * 0.95);
    const spot = new THREE.SpotLight(0xffe6a8, 1.6, 9, 0.38, 0.6, 1.2); spot.position.set(src.x, 0.9, src.z); board.add(spot, spot.target);
    return {
      set(t, crates) {
        const on = !l.every || ((t + l.phase) % l.every + l.every) % l.every < l.on;
        let n = 0; for (const k of l.beam) { if ((crates || []).includes(k) || LV.cover.has(k)) break; n++; }
        g.visible = on && n > 0; spot.visible = on;
        if (!on || !n) return;
        const a = toW(first[0] - dx * 0.5, first[1] - dy * 0.5), last = l.beam[n - 1].split(',').map(Number), b = toW(last[0] + dx * 0.5, last[1] + dy * 0.5);
        const len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(-(b.z - a.z), b.x - a.x);
        plane.scale.set(len, 1, 1); plane.position.set((a.x + b.x) / 2, 0.06, (a.z + b.z) / 2); plane.rotation.z = ang;
        cone.scale.set(1, len, 1); cone.position.set((a.x + b.x) / 2, 0.55, (a.z + b.z) / 2);
        cone.rotation.set(0, 0, 0); cone.rotation.z = -Math.PI / 2; cone.rotation.y = ang; if (dx === 0) { cone.rotation.z = 0; cone.rotation.x = dy > 0 ? Math.PI / 2 : -Math.PI / 2; }
        spot.target.position.set(b.x, 0, b.z);
      },
    };
  }

  function buildPlaya(scene, board, toW, LV, LVD, box, add, api) {
    const [bx0, by0, bx1, by1] = box, W = (gx, gy) => toW(gx, gy);
    // piso de ripio con huellas de camiones
    const truck = (gx, gy, ry, color, lights) => { const t = add(camion(color), gx, gy, ry); const fix = () => paintTruck(t, color); fix(); api.tick.push(() => { if (!t.userData.painted && has('camion')) { fix(); t.userData.painted = true; } }); return t; };
    // faros de los niveles con "lights": un camión detrás de cada haz
    api.beams = (LVD.lights || []).map((l, i) => {
      const L = LV.lights[i], [x, y] = l.from, [dx, dy] = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }[l.dir];
      const ry = { E: 0, W: Math.PI, N: Math.PI / 2, S: -Math.PI / 2 }[l.dir];
      truck(x - dx * 1.75, y - dy * 1.75, ry, PAINTS[(i + 1) % PAINTS.length]);
      return beam(board, toW, LV, L, i);
    });
    const pila = (gx, gy, ry = 0) => add(piece('pila', { s: 1.0 }, () => P.crate(0.9)), gx, gy, ry);
    const tambor = (gx, gy, red) => add(piece(red ? 'tambor_rojo' : 'tambor_azul', { s: 0.8 }, () => P.barrel()), gx, gy, Math.random() * 3);
    const poste = (gx, gy) => add(piece('poste_luz', { s: 0.85 }, () => P.farol(true)), gx, gy);
    const pl = (gx, gy) => { const p = W(gx, gy), l = new THREE.PointLight(0xffc070, 0.9, 6, 2); l.position.set(p.x, 2.0, p.z); board.add(l); };
    if (scene === 'bascula') {
      add(piece('bascula', { s: 1.0 }, () => P.crate(1)), 2.2, by0 + 0.9);
      truck(4.2, by0 + 0.55, Math.PI, PAINTS[0]);
      add(piece('tranquera', { s: 0.9 }, null), bx0 + 0.3, 1.0, Math.PI / 2);
      truck(bx0 + 0.6, by1 - 0.45, 0.15, PAINTS[2]);
      pila(bx1 - 0.55, 1.0); pila(5.6, by1 - 0.4, 0.3); tambor(bx1 - 0.4, by0 + 0.4); tambor(bx1 - 0.7, by0 + 0.25, true);
      add(alamo(false, 3), bx0 + 0.3, by0 + 0.3); add(alamo(false, 2.7), 1.0, by0 + 0.25); poste(3.0, 1.5);
    }
    if (scene === 'cajones') {
      pila(bx0 + 0.45, by0 + 0.5); pila(1.0, by0 + 0.4, 0.4); pila(3.0, by0 + 0.45, -0.2); pila(bx1 - 0.5, 1.0); pila(bx1 - 0.45, by1 - 0.5, 0.5);
      truck(5.4, by0 + 0.5, Math.PI, PAINTS[1]);
      tambor(bx0 + 0.4, 1.5, true); tambor(bx0 + 0.35, 2.4); poste(2.5, 1.5); pl(2.5, 1.5);
    }
    if (scene === 'perros') {
      // corral: alambrado alrededor de la zona de los perros, cuchas y tambores
      LV.s0.en.filter(e => e.t === 'dog').forEach((d, i) => {
        const [x, y] = d.home.split(',').map(Number);
        add(piece('cucha', { s: 0.62 }, () => P.crate(0.5)), x - 0.5, y - 0.52, 0.6 + i * 0.5);
      });
      for (let gx = bx0 + 0.6; gx < bx1 - 0.4; gx += 1.0) add(piece('alambrado', { len: 2.0 }, null), gx + 0.5, by0 + 0.3);
      add(alamo(false, 3), bx1 - 0.4, by0 + 0.4); add(alamo(false, 2.6), bx0 + 0.3, by1 - 0.5);
      tambor(bx1 - 0.4, 2.0); tambor(bx1 - 0.5, 2.5, true); truck(bx0 + 0.55, by1 - 0.4, 0.2, PAINTS[3]); poste(2.5, 1.5);
    }
    if (scene === 'piedra') {
      truck(1.0, by0 + 0.5, Math.PI, PAINTS[2]); truck(3.6, by0 + 0.55, Math.PI, PAINTS[0]);
      truck(1.6, by1 - 0.45, 0, PAINTS[4]); truck(4.4, by1 - 0.5, 0.1, PAINTS[1]);
      add(piece('surtidor', { s: 0.9 }, null), bx1 - 0.45, 1.0); tambor(bx1 - 0.45, 1.6, true); tambor(bx0 + 0.4, 1.5); poste(bx0 + 0.4, 0.6);
    }
    if (scene === 'faros') {
      pila(3.0, by0 + 0.4); pila(bx1 - 0.6, by1 - 0.45, 0.4); tambor(bx1 - 0.6, by0 + 0.4, true); tambor(5.4, by0 + 0.3);
      poste(1.5, by1 - 0.4); pl(1.5, by1 - 0.4); add(alamo(true, 2.8), bx0 + 0.3, by0 + 0.3);
    }
    if (scene === 'galpon') {
      const g = add(piece('galpon_coop', { s: 1.0, keep: true }, () => P.station(8, 4.4, 2.4)), 3.0, by0 + 1.15);
      const sg = sign('Cooperativa La Vendimia', 2.8, 0.28); sg.position.set(0, 2.99, 2.38); g.add(sg);
      const l = new THREE.PointLight(0xffb060, 1.2, 7, 2); l.position.set(0, 1.4, 2.6); g.add(l);
      pila(bx0 + 0.5, 1.5); pila(bx0 + 0.45, 3.2, 0.4); tambor(bx1 - 0.4, 1.5, true); tambor(bx1 - 0.45, 2.2);
      poste(bx0 + 0.4, by1 - 0.4); pl(bx0 + 0.4, by1 - 0.4);
    }
    // luces cálidas para la noche
    if (LVD.sky === 'noche' || LVD.sky === 'anochecer') { pl(1.5, 1.5); pl(4.5, 2.0); }
  }

  return { loadKit, build, has, applyKit, kitClone, crateMesh, stonePile };
})();
