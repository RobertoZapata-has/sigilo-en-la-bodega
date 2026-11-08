// ===== ESCENARIOS: maquetas hechas en código =====
// Todas las posiciones están en casilleros del tablero (gx, gy); toW las pasa al mundo 3D.
const DECOR = (() => {
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9 }, o || {}));
  const noise = (x, y, z) => Math.sin(x * 3.1 + z * 1.7) * 0.5 + Math.sin(z * 4.3 - y * 2.1 + x * 0.7) * 0.3 + Math.sin(x * 7.7 + y * 5.3 + z * 6.1) * 0.2;
  const shadow = (m, cast = true, recv = true) => { m.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = recv; } }); return m; };

  // Bloque de piedra flotante con bordes irregulares
  function rockBlock(w, d, depth) {
    const g = new THREE.BoxGeometry(w, depth, d, 34, 7, 30);
    const pos = g.attributes.position, col = [], c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = noise(x * 0.8, y * 1.4, z * 0.8);
      if (y < depth / 2 - 1e-3) {
        const t = (depth / 2 - y) / depth;
        const amt = 0.16 + 0.22 * t;
        if (Math.abs(Math.abs(x) - w / 2) < 1e-3) x += Math.sign(x) * (n * amt - t * 0.45);
        if (Math.abs(Math.abs(z) - d / 2) < 1e-3) z += Math.sign(z) * (n * amt - t * 0.45);
        y += noise(x * 1.3, 0, z * 1.3) * 0.07;
      }
      pos.setXYZ(i, x, y, z);
      const v = 0.82 + n * 0.16;
      c.setRGB(0.36 * v, 0.42 * v, 0.53 * v);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(0xffffff, { vertexColors: true, roughness: 0.95 }));
    m.position.y = -depth / 2;
    m.receiveShadow = true;
    return m;
  }

  // Piso de tierra y ripio con manchas
  function ground(w, d) {
    const g = new THREE.PlaneGeometry(w - 0.1, d - 0.1, 60, 50);
    const pos = g.attributes.position, col = [], c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const n = noise(x * 0.9, 0.3, y * 0.9) * 0.5 + noise(x * 4.1, 1.7, y * 3.7) * 0.5;
      const v = 0.86 + n * 0.12;
      c.setRGB(0.47 * v, 0.43 * v, 0.36 * v);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, mat(0xffffff, { vertexColors: true }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.receiveShadow = true;
    return m;
  }

  // Barrica de roble con zunchos
  const barrelGeo = new THREE.LatheGeometry([[0, -0.3], [0.21, -0.3], [0.25, -0.16], [0.268, 0], [0.25, 0.16], [0.21, 0.3], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  const hoopGeo = new THREE.TorusGeometry(1, 0.016, 6, 22);
  const wood = mat(0x7b4a2a, { roughness: 0.8 }), hoopM = mat(0x2b2724, { roughness: 0.5, metalness: 0.5 });
  function barrel() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(barrelGeo, wood));
    [[-0.25, 0.228], [-0.12, 0.262], [0.12, 0.262], [0.25, 0.228]].forEach(([y, r]) => {
      const h = new THREE.Mesh(hoopGeo, hoopM); h.scale.set(r, r, r); h.rotation.x = Math.PI / 2; h.position.y = y; g.add(h);
    });
    return shadow(g);
  }

  // Chapa acanalada oxidada para el techo
  function tinTexture() {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    for (let i = 0; i < 128; i++) {
      const s = 0.5 + 0.5 * Math.sin(i / 128 * Math.PI * 2 * 8);
      x.fillStyle = `rgb(${Math.round(92 + s * 50)},${Math.round(84 + s * 34)},${Math.round(82 + s * 30)})`;
      x.fillRect(i, 0, 1, 128);
    }
    for (let k = 0; k < 90; k++) {
      x.fillStyle = `rgba(${140 + Math.random() * 40},${70 + Math.random() * 20},40,${0.15 + Math.random() * 0.25})`;
      x.fillRect(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 14, 2 + Math.random() * 10);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
  }

  // Galpón de adobe con techo de chapa a dos aguas y puerta abierta
  function galpon(W, D, H, rise) {
    const g = new THREE.Group();
    const adobe = mat(0xb98d58), dark = mat(0x3b2f25), t = 0.18;
    const box = (w, h, d, x, y, z, m = adobe) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
    box(W, H, t, 0, H / 2, -D / 2 + t / 2);
    box(t, H, D, -W / 2 + t / 2, H / 2, 0);
    box(t, H, D, W / 2 - t / 2, H / 2, 0);
    const doorW = 1.5, doorX = W * 0.12;
    const a = doorX - doorW / 2 + W / 2;
    box(a, H, t, -W / 2 + a / 2, H / 2, D / 2 - t / 2);
    const b = W / 2 - (doorX + doorW / 2);
    box(b, H, t, W / 2 - b / 2, H / 2, D / 2 - t / 2);
    box(doorW, 0.32, t, doorX, H - 0.16, D / 2 - t / 2);
    box(W - 2 * t, 0.03, D - 2 * t, 0, 0.015, 0, dark);
    // portones de madera abiertos
    const door = mat(0x5e4130);
    const d1 = box(0.72, H - 0.36, 0.06, doorX - doorW / 2 - 0.3, (H - 0.36) / 2, D / 2 + 0.28, door); d1.rotation.y = -1.2;
    const d2 = box(0.72, H - 0.36, 0.06, doorX + doorW / 2 + 0.3, (H - 0.36) / 2, D / 2 + 0.28, door); d2.rotation.y = 1.2;
    // hastiales
    const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.lineTo(-D / 2, 0);
    [-1, 1].forEach(s => {
      const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat(0xb98d58, { side: THREE.DoubleSide }));
      m.rotation.y = Math.PI / 2; m.position.set(s * (W / 2 - t / 2), H, 0); g.add(m);
    });
    // techo
    const tin = mat(0xffffff, { map: tinTexture(), roughness: 0.6, metalness: 0.35 });
    const ang = Math.atan2(rise, D / 2), L = Math.hypot(D / 2, rise) + 0.35;
    [-1, 1].forEach(s => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(W + 0.45, 0.06, L), tin);
      r.rotation.x = s * ang; r.position.set(0, H + rise / 2 + 0.02, s * (D / 4 + 0.08)); g.add(r);
    });
    // barricas adentro y luz cálida
    [[-0.7, -0.55], [-0.15, -0.6], [0.4, -0.55], [-0.45, -0.05]].forEach(([x, z]) => { const br = barrel(); br.position.set(doorX + x, 0.3, z); g.add(br); });
    const light = new THREE.PointLight(0xffa64d, 1.5, 6.5, 2); light.position.set(doorX, 1.05, 0.1); g.add(light);
    return shadow(g);
  }

  // Bloque de piletas de cemento con pasarela de madera en cruz y escaleras
  function pools(S, H, reach) {
    const g = new THREE.Group();
    const conc = mat(0x8a929a), pit = mat(0x232b33, { roughness: 0.4 }), plank = mat(0x7a5634, { roughness: 0.85 }), t = 0.16;
    const tanks = new THREE.Group(); g.add(tanks);
    const box = (w, h, d, x, y, z, m = conc, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); parent.add(b); return b; };
    box(S, H, t, 0, H / 2, -S / 2 + t / 2, conc, tanks); box(S, H, t, 0, H / 2, S / 2 - t / 2, conc, tanks);
    box(t, H, S, -S / 2 + t / 2, H / 2, 0, conc, tanks); box(t, H, S, S / 2 - t / 2, H / 2, 0, conc, tanks);
    box(S - t, H, t, 0, H / 2, 0, conc, tanks); box(t, H, S - t, 0, H / 2, 0, conc, tanks);
    box(S - 2 * t, 0.04, S - 2 * t, 0, 0.12, 0, pit, tanks);
    slot(tanks, () => {
      const q = new THREE.Group(), w = S / 2 - 0.04;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], i) => {
        const p = prop('pileta', { w, d: w, h: H }); p.position.set(a * S / 4, 0, b * S / 4); p.rotation.y = i * Math.PI / 2; q.add(p);
      });
      return q;
    });
    // pasarela
    const top = H + 0.04;
    box(S + 0.12, 0.06, 0.6, 0, top, 0, plank);
    box(0.6, 0.06, S + 0.12, 0, top, 0, plank);
    // barandas en los cuatro brazos
    const post = new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), rail = mat(0x5e4130);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
      [-1, 1].forEach(side => {
        const ox = dz !== 0 ? side * 0.3 : 0, oz = dx !== 0 ? side * 0.3 : 0;
        for (let k = 0; k < 3; k++) {
          const f = 0.45 + k * 0.38;
          const p = new THREE.Mesh(post, rail); p.position.set(dx * f + ox, top + 0.24, dz * f + oz); g.add(p);
        }
        const len = 0.8, mid = 0.45 + 0.38;
        const r = new THREE.Mesh(new THREE.BoxGeometry(dx !== 0 ? len : 0.035, 0.035, dz !== 0 ? len : 0.035), rail);
        r.position.set(dx * mid + ox, top + 0.44, dz * mid + oz); g.add(r);
      });
      // escalera desde el borde hasta el punto del camino
      const run = reach - S / 2, Ld = Math.hypot(run, top);
      const lad = new THREE.Group();
      [-0.2, 0.2].forEach(s => { const rr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, Ld), plank); rr.position.x = s; lad.add(rr); });
      for (let k = 1; k < 5; k++) { const rung = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.07), plank); rung.position.z = -Ld / 2 + (k / 5) * Ld; lad.add(rung); }
      lad.position.set(dx * (S / 2 + run / 2), top / 2, dz * (S / 2 + run / 2));
      lad.rotation.order = 'YXZ';
      lad.rotation.y = Math.atan2(dx, dz);
      lad.rotation.x = Math.atan2(top, run);
      g.add(lad);
      slot(lad, () => { const e = prop('escalera', { h: Ld, w: 0.5 }); e.rotation.x = Math.PI / 2; e.position.z = -Ld / 2; return e; });
    });
    return shadow(g);
  }

  // Hileras de viña: postes, alambres y hojas (con instancias para que sea liviano)
  function vineyard(rows) {
    const g = new THREE.Group();
    const postT = [], leafT = [], leafC = [];
    const wire = mat(0x6b6a66, { metalness: 0.4 });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [a, b] of rows) {
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), n = Math.max(2, Math.round(L / 0.62));
      for (let i = 0; i <= n; i++) postT.push(m4.clone().makeTranslation(a.x + dx * i / n, 0.31, a.z + dz * i / n));
      [0.26, 0.5].forEach(h => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, L), wire);
        w.position.set((a.x + b.x) / 2, h, (a.z + b.z) / 2); w.rotation.y = Math.atan2(dx, dz); g.add(w);
      });
      const k = Math.round(L / 0.16);
      for (let i = 0; i <= k; i++) {
        const u = i / k;
        p.set(a.x + dx * u + (rnd() - 0.5) * 0.12, 0.3 + rnd() * 0.24, a.z + dz * u + (rnd() - 0.5) * 0.12);
        const s = 0.09 + rnd() * 0.07; sc.set(s, s * 0.9, s);
        q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0));
        leafT.push(new THREE.Matrix4().compose(p.clone(), q.clone(), sc.clone()));
        const v = 0.75 + rnd() * 0.35; leafC.push(new THREE.Color(0.2 * v, 0.33 * v, 0.17 * v));
      }
    }
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.62, 6), mat(0x6e4c32), postT.length);
    postT.forEach((m, i) => posts.setMatrixAt(i, m));
    const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, { flatShading: true }), leafT.length);
    leafT.forEach((m, i) => { leaves.setMatrixAt(i, m); leaves.setColorAt(i, leafC[i]); });
    posts.castShadow = true; leaves.castShadow = true; leaves.receiveShadow = true;
    g.add(posts, leaves);
    return g;
  }

  function farol(withLight) {
    const g = new THREE.Group(), iron = mat(0x2b2622, { metalness: 0.4, roughness: 0.5 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 8), iron); post.position.y = 0.5; g.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 4), iron); cap.position.y = 1.15; cap.rotation.y = Math.PI / 4; g.add(cap);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.11), new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffb04a, emissiveIntensity: 1.3 }));
    glass.position.y = 1.05; g.add(glass);
    if (withLight) { const l = new THREE.PointLight(0xffb45a, 1.0, 4.2, 2); l.position.y = 1.05; g.add(l); }
    post.castShadow = true;
    return g;
  }

  function deadTree() {
    const g = new THREE.Group(), bark = mat(0x5a4c44);
    const limb = (parent, len, r, depth) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, len, 6), bark);
      m.position.y = len / 2; parent.add(m); m.castShadow = true;
      if (depth === 0) return;
      const tip = new THREE.Group(); tip.position.y = len; parent.add(tip);
      [[0.6, 0.2], [-0.5, 2.3], [0.45, 4.2]].slice(0, depth + 1).forEach(([tilt, yaw]) => {
        const j = new THREE.Group(); j.rotation.set(0, yaw, tilt); tip.add(j);
        limb(j, len * 0.62, r * 0.6, depth - 1);
      });
    };
    limb(g, 0.75, 0.07, 2);
    return g;
  }

  function bush(s = 1) {
    const g = new THREE.Group();
    const leaf = mat(0x34502c, { flatShading: true });
    [[0, 0.14, 0, 0.2], [0.16, 0.1, 0.05, 0.15], [-0.14, 0.1, -0.04, 0.16], [0.02, 0.24, -0.06, 0.13]].forEach(([x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf); m.position.set(x, y, z); g.add(m);
    });
    g.scale.setScalar(s);
    return shadow(g);
  }


  // ---------- Piezas 3D hechas en Blender (assets/modelos/escenario) ----------
  // Se cargan aparte; mientras tanto se ve la versión de formas simples. Cada "hueco" (slot) guarda
  // la versión simple y una función que arma la pieza nueva cuando ya está cargada.
  const PROPS = {};
  let slots = [];
  function slot(group, make) { slots.push({ group, make }); return group; }
  function prop(name, fit) {
    const P = PROPS[name]; const g = new THREE.Group(); if (!P) return g;
    const m = new THREE.Mesh(P.geo, P.mat); m.castShadow = true; m.receiveShadow = true;
    const sz = P.size;
    let sx, sy, sz_;
    if (fit.h && fit.w && fit.d) { sx = fit.w / sz.x; sy = fit.h / sz.y; sz_ = fit.d / sz.z; }
    else if (fit.h) { sx = sy = sz_ = fit.h / sz.y; }
    else { sx = sy = sz_ = fit.w / Math.max(sz.x, sz.z); }
    m.scale.set(sx, sy, sz_);
    g.add(m); return g;
  }
  function applyProps() {
    slots = slots.filter(sl => {
      let o = sl.group; while (o.parent) o = o.parent;
      if (!o.isScene) return false;             // ya no está en pantalla
      if (sl.done) return true;
      const n = sl.make(); if (!n || !n.children.length) return true;
      sl.group.children.slice().forEach(c => sl.group.remove(c));
      sl.group.add(n); sl.done = true; return true;
    });
  }
  function loadProps(url, done) {
    if (!THREE.GLTFLoader) return;
    const s = document.createElement('script'); s.src = url; s.async = true;
    s.onload = () => {
      const all = window.PROPS_B64 || {}; delete window.PROPS_B64;
      const names = Object.keys(all); let left = names.length;
      names.forEach(n => {
        const bin = atob(all[n]), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        new THREE.GLTFLoader().parse(buf.buffer, '', g => {
          let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
          if (mesh) {
            mesh.updateWorldMatrix(true, false);
            const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
            geo.computeBoundingBox(); const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3());
            geo.translate(-c.x, -bb.min.y, -c.z); geo.computeBoundingBox(); geo.userData.keep = true;
            const mt = mesh.material;
            if (mt.map) { mt.emissiveMap = mt.map; mt.emissive = new THREE.Color(n === 'galpon' || n === 'pila' ? 0x8a847c : 0x6a6460); }
            mt.roughness = 0.85; mt.metalness = 0; mt.metalnessMap = null;
            const boost = { pila: 1.9, galpon: 1.25 }[n]; if (boost) mt.color.setScalar(boost);
            PROPS[n] = { geo, mat: mt, size: geo.boundingBox.getSize(new THREE.Vector3()) };
          }
          if (--left === 0) { applyProps(); if (done) done(); }
        }, () => { if (--left === 0) { applyProps(); if (done) done(); } });
      });
    };
    document.head.appendChild(s);
  }
  // Hileras de viña con la pieza "vina" repetida (instancias: una sola llamada de dibujo)
  function vineRows(rows) {
    const P = PROPS.vina; const g = new THREE.Group(); if (!P) return g;
    const h = 0.7, k = h / P.size.y, seg = P.size.x * k;
    const mats = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Yax = new THREE.Vector3(0, 1, 0);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [a, b] of rows) {
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), n = Math.max(1, Math.round(L / seg));
      const sx = (L / n) / P.size.x;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, flip = rnd() < 0.5 ? Math.PI : 0;
        q.setFromAxisAngle(Yax, -Math.atan2(dz, dx) + flip);
        mats.push(m4.clone().compose(new THREE.Vector3(a.x + dx * u, 0, a.z + dz * u), q.clone(), new THREE.Vector3(sx, k, k)));
      }
    }
    const im = new THREE.InstancedMesh(P.geo, P.mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true; im.receiveShadow = true; g.add(im);
    return g;
  }


  // Barricas alrededor de un punto que sirve de escondite (dos en las diagonales de atrás)
  function coverSpot(board, p, style) {
    if (style === 'tren') {   // en la estación: un banco y valijas apiladas
      const b = bench(); b.position.set(p.x - 0.55, 0, p.z - 0.6); b.rotation.y = 0.1; board.add(b);
      const v1 = suitcase(0x7b4a2a, 0.46, 0.32, 0.2); v1.position.set(p.x + 0.62, 0, p.z - 0.5); v1.rotation.y = 0.5; board.add(v1);
      const v2 = suitcase(0x3b5a6b, 0.38, 0.26, 0.18); v2.position.set(p.x + 0.6, 0.32, p.z - 0.48); v2.rotation.y = 0.2; board.add(v2);
      const v3 = suitcase(0x8a2f2f, 0.42, 0.3, 0.18); v3.position.set(p.x - 0.62, 0, p.z + 0.62); v3.rotation.y = 1.1; board.add(v3);
      const c = crate(0.42); c.position.set(p.x + 0.66, 0, p.z + 0.6); c.rotation.y = 0.3; board.add(c);
      return;
    }
    [[-0.62, -0.62, 0.3], [0.62, -0.62, -0.4], [-0.62, 0.62, 1.1]].forEach(([dx, dz, r]) => {
      const g = new THREE.Group(); g.add(barrel()); g.children[0].position.y = 0.3;
      g.position.set(p.x + dx, 0, p.z + dz); g.rotation.y = r; board.add(g);
      slot(g, () => prop('barrica', { h: 0.62 }));
    });
    applyProps();
  }


  // ---------- Capítulo 1: la finca (niveles 1 a 5) ----------
  // Decorado automático: viña en todo el espacio libre, faroles al lado del camino, arbustos y
  // un detalle propio de cada nivel (tapial, acequia, galpón). LV = nivel ya leído, box = borde en casilleros.
  function finca(board, toW, SP, LV, box, extra) {
    const nodes = [...LV.nodes.values()];
    const segs = [];
    for (const [a, ns] of LV.adj) for (const b of ns) if (a < b) { const A = LV.nodes.get(a), B = LV.nodes.get(b); segs.push([A.x, A.y, B.x, B.y]); }
    const dSeg = (x, y, [ax, ay, bx, by]) => {
      const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
      return Math.hypot(x - ax - vx * t, y - ay - vy * t);
    };
    const clear = (x, y, m = 0.42) => nodes.every(n => Math.hypot(x - n.x, y - n.y) > m + 0.12) && segs.every(sg => dSeg(x, y, sg) > m);
    const add = (o, gx, gy, y = 0, ry = 0) => { const p = toW(gx, gy); o.position.set(p.x, y, p.z); o.rotation.y = ry; board.add(o); return o; };
    const hole = (fallback, make) => { const g = new THREE.Group(); g.add(fallback); return slot(g, make); };
    const [gx0, gy0, gx1, gy1] = box;
    const taken = [];   // lugares ocupados por piezas grandes, en casilleros
    const free = (x, y, r) => clear(x, y, r) && taken.every(([tx, ty, tr]) => Math.hypot(x - tx, y - ty) > r + tr);
    // detalle propio del nivel
    if (extra === 'tapial') {
      const adobe = mat(0xc9a77e), wall = new THREE.Mesh(new THREE.BoxGeometry((gx1 - gx0) * SP - 0.4, 0.9, 0.28), adobe);
      const p = toW((gx0 + gx1) / 2, gy0 + 0.12); wall.position.set(p.x, 0.45, p.z); wall.castShadow = wall.receiveShadow = true; board.add(wall);
      const cap = new THREE.Mesh(new THREE.BoxGeometry((gx1 - gx0) * SP - 0.3, 0.08, 0.36), mat(0x8a6a4a)); cap.position.set(p.x, 0.94, p.z); board.add(cap);
      taken.push([(gx0 + gx1) / 2, gy0, 0.45]);
    }
    if (extra === 'acequia') {
      // acequia que cruza el nivel por el espacio libre más largo entre dos filas de puntos
      const ys = [...new Set(nodes.map(n => n.y))].sort((a, b) => a - b);
      const y = ys.length > 1 ? (ys[0] + ys[1]) / 2 : gy1 - 0.4;
      const w = (gx1 - gx0) * SP, pz = toW(0, y).z;
      const bank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.62), mat(0x6b5038)); bank.position.set(0, 0.02, pz); bank.receiveShadow = true; board.add(bank);
      const water = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.4), mat(0x3d6f86, { roughness: 0.15, metalness: 0.1, emissive: 0x0d2533 })); water.position.set(0, 0.05, pz); board.add(water);
      // tablones donde el camino cruza el agua
      for (const sg of segs) if (sg[0] === sg[2] && Math.min(sg[1], sg[3]) < y && Math.max(sg[1], sg[3]) > y) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.9), mat(0x7a5634)); const q = toW(sg[0], y); pl.position.set(q.x, 0.09, q.z); pl.castShadow = true; board.add(pl);
      }
      taken.push(...Array.from({ length: Math.ceil(gx1 - gx0) + 1 }, (_, i) => [gx0 + i, y, 0.25]));
    }
    if (extra === 'galpon') {
      const spots = [[gx1 - 1.1, gy0 + 0.95], [(gx0 + gx1) / 2, gy0 + 0.95], [gx0 + 1.1, gy0 + 0.95]];
      const sp = spots.find(([x, y]) => clear(x, y, 0.75));
      if (sp) { add(hole(new THREE.Group(), () => prop('galpon', { h: 2.3 })), sp[0], sp[1]); taken.push([sp[0], sp[1], 1.0]); }
    }
    // faroles: en las esquinas libres al lado de algunos puntos
    let nf = 0;
    for (const n of nodes) {
      if (nf >= 3 || (n.x + n.y) % 3) continue;
      for (const [dx, dy] of [[0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
        if (free(n.x + dx, n.y + dy, 0.3)) { add(farol(nf === 0), n.x + dx, n.y + dy); taken.push([n.x + dx, n.y + dy, 0.25]); nf++; break; }
      }
    }
    // barricas y prensa sueltas
    const loose = [['barrica', 0.62], ['barrica', 0.62], ['prensa', 0.8]];
    let li = 0;
    for (let gy = gy0 + 0.6; gy <= gy1 - 0.4 && li < loose.length; gy += 0.9)
      for (let gx = gx1 - 0.5; gx >= gx0 + 0.5 && li < loose.length; gx -= 0.7)
        if (free(gx, gy, 0.45) && ((gx * 7 + gy * 3) | 0) % 4 === 0) {
          const [name, h] = loose[li++];
          add(hole(name === 'barrica' ? barrel() : new THREE.Group(), () => prop(name, { h })), gx, gy, 0, gx * 1.7);
          if (name === 'barrica') { const g = board.children[board.children.length - 1]; g.children[0] && (g.children[0].position.y = 0.3); }
          taken.push([gx, gy, 0.4]);
        }
    // viña: hileras paralelas en todo lo libre que queda
    const rows = [], horiz = (gx1 - gx0) >= (gy1 - gy0);
    const step = 0.42, W = (x, y) => toW(x, y);
    if (horiz) {
      for (let y = gy0 + 0.3; y <= gy1 - 0.25; y += step) {
        let a = null;
        for (let x = gx0 + 0.25; x <= gx1 - 0.2; x += 0.1) {
          const ok = free(x, y, 0.38);
          if (ok && a === null) a = x;
          if ((!ok || x + 0.1 > gx1 - 0.2) && a !== null) { if (x - a > 0.9) rows.push([W(a, y), W(x - 0.1, y)]); a = null; }
        }
      }
    } else {
      for (let x = gx0 + 0.3; x <= gx1 - 0.25; x += step) {
        let a = null;
        for (let y = gy0 + 0.25; y <= gy1 - 0.2; y += 0.1) {
          const ok = free(x, y, 0.38);
          if (ok && a === null) a = y;
          if ((!ok || y + 0.1 > gy1 - 0.2) && a !== null) { if (y - a > 0.9) rows.push([W(x, a), W(x, y - 0.1)]); a = null; }
        }
      }
    }
    const vines = new THREE.Group(); vines.add(vineyard(rows)); board.add(vines);
    slot(vines, () => vineRows(rows));
    // arbustos de jarilla en huecos chicos
    let nb = 0;
    for (const n of nodes) for (const [dx, dy] of [[-0.5, -0.5], [0.5, 0.5]]) {
      if (nb < 6 && (n.x * 3 + n.y + dx > 2) && free(n.x + dx, n.y + dy, 0.2)) { add(bush(0.8 + ((n.x + n.y) % 3) * 0.12), n.x + dx, n.y + dy); nb++; }
    }
    applyProps();
  }

  // ---------- Capítulo 1: la bodega ----------
  function bodega(board, toW, SP, hBridge) {
    slots = [];
    const add = (o, gx, gy, y = 0, ry = 0) => { const p = toW(gx, gy); o.position.set(p.x, y, p.z); o.rotation.y = ry; board.add(o); return o; };
    const hole = (fallback, make) => { const g = new THREE.Group(); g.add(fallback); return slot(g, make); };
    add(hole(galpon(4.6, 2.3, 1.45, 0.75), () => {
      const q = new THREE.Group(); const p = prop('galpon', { h: 2.5 }); q.add(p);
      const light = new THREE.PointLight(0xffa64d, 1.2, 5.5, 2); light.position.set(0, 1.0, 1.6); q.add(light);
      return q;
    }), 0.75, -1.38);
    // barricas apiladas en pirámide
    const stack = new THREE.Group();
    [[3, 0], [2, 1], [1, 2]].forEach(([n, row]) => {
      for (let i = 0; i < n; i++) {
        const b = barrel(); b.rotation.x = Math.PI / 2;
        b.position.set((i - (n - 1) / 2) * 0.55, 0.27 + row * 0.47, 0); stack.add(b);
      }
    });
    // la pila se arma con seis barricas (la pieza "pila" de Hunyuan3D salió con la textura rota)
    add(hole(stack, () => {
      const q = new THREE.Group(); if (!PROPS.barrica) return q;
      const h = 0.5, w = PROPS.barrica.size.z * (h / PROPS.barrica.size.y) * 0.98, dy = h * 0.8;
      [[3, 0], [2, 1], [1, 2]].forEach(([n, row]) => {
        for (let i = 0; i < n; i++) {
          const b = prop('barrica', { h }); b.rotation.y = Math.PI / 2 + (i - row) * 0.06;
          b.position.set((i - (n - 1) / 2) * w, row * dy, 0); q.add(b);
        }
      });
      return q;
    }), -0.95, -0.42, 0, 0.5);
    [[2.75, -1.45, 0.4], [3.25, -1.5, 2.1], [2.95, -1.0, 1.2], [3.45, -1.05, -0.6]].forEach(([x, y, r]) =>
      add(hole(barrel(), () => prop('barrica', { h: 0.62 })), x, y, 0, r));
    // el barril suelto de la versión simple está parado y a 0.3 de altura: la pieza nueva va en el piso
    slots.slice(-4).forEach(sl => { sl.group.children[0].position.y = 0.3; const mk = sl.make; sl.make = () => { sl.group.position.y = 0; return mk(); }; });
    add(pools(2.6, 0.56, SP), 3, 2);
    add(hole(new THREE.Group(), () => prop('prensa', { h: 0.85 })), 4.55, 0.4, 0, -0.5);
    // viñedos
    const W = (gx, gy) => toW(gx, gy);
    const rows = [];
    [-1.35, -0.95, -0.55].forEach(x => rows.push([W(x, 0.35), W(x, 2.3)]));
    [2.7, 3.15, 3.6, 4.05].forEach(y => rows.push([W(-1.45, y), W(1.55, y)]));
    [5.0, 5.45, 5.9, 6.35].forEach(x => rows.push([W(x, -1.85), W(x, 2.35)]));
    [5.85, 6.35].forEach(x => rows.push([W(x, 2.85), W(x, 4.75)]));
    const vines = new THREE.Group(); vines.add(vineyard(rows)); board.add(vines);
    slot(vines, () => vineRows(rows));
    add(deadTree(), 4.2, -1.25, 0, 0.6);
    add(bush(1.1), 3.75, -0.35); add(bush(0.9), 2.45, 0.45); add(bush(1), 3.0, 3.5); add(bush(0.85), 4.0, 3.5); add(bush(1), 1.45, 0.6);
    add(farol(true), 1.85, -0.55);
    add(farol(false), 1.5, 1.5);
    add(farol(false), 4.45, 2.6);
    add(farol(false), 3.65, -0.6);
    add(farol(true), 5.45, 3.55);
    applyProps();
  }


  // ---------- Capítulo 2: el andén del Trasandino ----------
  function signTexture(text, bg, fg, w = 512, h = 96) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.strokeStyle = fg; x.lineWidth = 4; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = fg; x.font = `700 ${Math.round(h * 0.46)}px Georgia, serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  }

  function station(W, D, H) {
    const g = new THREE.Group();
    const wall = mat(0xd9c9a1), base = mat(0x8c4a35), trim = mat(0x3b4a3c), glassM = new THREE.MeshStandardMaterial({ color: 0xffd68f, emissive: 0xffa94d, emissiveIntensity: 0.9 });
    const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
    box(W, H, D, 0, H / 2, 0, wall);
    box(W + 0.04, 0.32, D + 0.04, 0, 0.16, 0, base);
    // ventanas y puerta en la fachada
    const n = Math.floor(W / 1.25);
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (i + 0.5) * (W / n);
      if (i === Math.floor(n / 2)) { box(0.8, 1.25, 0.06, x, 0.62, D / 2 + 0.02, glassM); box(0.95, 0.08, 0.08, x, 1.3, D / 2 + 0.04, trim); continue; }
      box(0.5, 0.65, 0.05, x, 0.95, D / 2 + 0.02, glassM);
      box(0.62, 0.07, 0.08, x, 1.32, D / 2 + 0.04, trim);
      box(0.62, 0.06, 0.1, x, 0.6, D / 2 + 0.05, trim);
    }
    // techo de tejas a cuatro aguas (pirámide estirada)
    const roofGeo = new THREE.ConeGeometry(1, 1, 4, 1); roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, mat(0x7b3b2c, { roughness: 0.8 }));
    roof.scale.set((W + 0.5) / Math.SQRT2, 0.9, (D + 0.5) / Math.SQRT2);
    roof.position.y = H + 0.45; g.add(roof);
    // alero sobre el andén con columnas de hierro
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.06, 1.3), mat(0x5a2f27));
    canopy.position.set(0, H - 0.15, D / 2 + 0.62); canopy.rotation.x = 0.1; g.add(canopy);
    const iron = mat(0x2c3a32, { metalness: 0.4, roughness: 0.6 });
    for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, H - 0.2, 8), iron); p.position.set(-W / 2 + 0.6 + i * (W - 1.2) / 4, (H - 0.2) / 2, D / 2 + 1.2); g.add(p); }
    // cartel y reloj
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.48), new THREE.MeshStandardMaterial({ map: signTexture('TRASANDINO', '#2f4a3a', '#f0e2b8'), roughness: 0.7 }));
    sign.position.set(0, H + 0.05, D / 2 + 0.03); g.add(sign);
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), mat(0xf2ead2, { emissive: 0x6b6450 }));
    clock.rotation.x = Math.PI / 2; clock.position.set(W / 2 - 0.8, H - 0.45, D / 2 + 0.04); g.add(clock);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.01), mat(0x111111)); hand.position.set(W / 2 - 0.8, H - 0.4, D / 2 + 0.075); g.add(hand);
    const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.01), mat(0x111111)); hand2.position.set(W / 2 - 0.75, H - 0.45, D / 2 + 0.075); g.add(hand2);
    const light = new THREE.PointLight(0xffb060, 1.2, 5.5, 2); light.position.set(0, 1.0, D / 2 + 0.8); g.add(light);
    return shadow(g);
  }

  function bench() {
    const g = new THREE.Group(), wood = mat(0x6e4a30), iron = mat(0x23262a, { metalness: 0.4 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.3), wood); seat.position.y = 0.3; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.04), wood); back.position.set(0, 0.48, -0.14); g.add(back);
    [-0.42, 0.42].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.3), iron); l.position.set(x, 0.15, 0); g.add(l); });
    return shadow(g);
  }

  function suitcase(c, w = 0.42, h = 0.3, d = 0.16) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); b.position.y = h / 2; g.add(b);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.03, d + 0.01), mat(0x3a2a1c)); strap.position.y = h * 0.62; g.add(strap);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10, Math.PI), mat(0x3a2a1c)); handle.position.y = h; g.add(handle);
    return shadow(g);
  }

  function crate(s = 0.5) {
    const g = new THREE.Group(), w = mat(0x9a7448);
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), w); b.position.y = s / 2; g.add(b);
    const dark = mat(0x6b4f30);
    [[s + 0.01, 0.05, s + 0.01, s * 0.2], [s + 0.01, 0.05, s + 0.01, s * 0.8]].forEach(([a, h, c, y]) => { const t = new THREE.Mesh(new THREE.BoxGeometry(a, h, c), dark); t.position.y = y; g.add(t); });
    return shadow(g);
  }

  function rails(x0, x1, z) {
    const g = new THREE.Group(), L = x1 - x0, cx = (x0 + x1) / 2;
    const ballast = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, 1.7), mat(0x55504a, { roughness: 1 })); ballast.position.set(cx, 0.03, z); ballast.receiveShadow = true; g.add(ballast);
    const n = Math.floor(L / 0.48), m4 = new THREE.Matrix4();
    const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.06, 1.35), mat(0x4a3726), n);
    for (let i = 0; i < n; i++) sleepers.setMatrixAt(i, m4.makeTranslation(x0 + 0.24 + i * 0.48, 0.09, z));
    sleepers.receiveShadow = true; g.add(sleepers);
    const steel = mat(0x8e9298, { metalness: 0.8, roughness: 0.35 });
    [-0.42, 0.42].forEach(o => { const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.06), steel); r.position.set(cx, 0.155, z + o); g.add(r); });
    return g;
  }

  function wheelSet(g, x, z, r, color) {
    const wm = mat(color, { metalness: 0.3, roughness: 0.6 });
    [-0.46, 0.46].forEach(o => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 18), wm);
      w.rotation.x = Math.PI / 2; w.position.set(x, r + 0.12, z + o); g.add(w);
    });
  }

  function ladder(h) {
    const g = new THREE.Group(), iron = mat(0x2a2d31, { metalness: 0.5, roughness: 0.5 });
    [-0.14, 0.14].forEach(x => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.03), iron); r.position.set(x, h / 2, 0); g.add(r); });
    for (let y = 0.15; y < h; y += 0.16) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.022, 0.03), iron); s.position.y = y; g.add(s); }
    return g;
  }

  // Vagón de pasajeros: x0..x1 en el mundo, centrado en z. Escaleras en las posiciones dadas.
  function wagon(len, ladders) {
    const g = new THREE.Group(), D = 1.5;
    const body = mat(0x2c4a3a), cream = mat(0xe3d3a8), dark = mat(0x1d1f22, { metalness: 0.3 });
    const win = new THREE.MeshStandardMaterial({ color: 0xffd994, emissive: 0xffaa55, emissiveIntensity: 0.8 });
    const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
    box(len, 0.12, D - 0.2, 0, 0.42, 0, dark);
    box(len, 0.6, D, 0, 0.78, 0, body);
    box(len + 0.01, 0.07, D + 0.01, 0, 0.92, 0, cream);
    const n = Math.max(2, Math.floor(len / 0.7));
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + (i + 0.5) * (len / n);
      [1, -1].forEach(s => box(0.36, 0.22, 0.02, x, 0.8, s * (D / 2 + 0.005), win));
    }
    box(len + 0.12, 0.08, D + 0.12, 0, 1.11, 0, mat(0x55585e, { roughness: 0.6 }));
    box(len - 0.3, 0.035, 0.38, 0, 1.165, 0, mat(0x7a5634));
    // dos bogies
    [-len / 2 + 0.7, len / 2 - 0.7].forEach(bx => { wheelSet(g, bx - 0.28, 0, 0.17, 0x2a2a2e); wheelSet(g, bx + 0.28, 0, 0.17, 0x2a2a2e); });
    for (const [lx, side] of ladders) { const l = ladder(1.12); l.position.set(lx, 0, side * (D / 2 + 0.04)); g.add(l); }
    return shadow(g);
  }

  // Locomotora a vapor con humo animado. Mira hacia +x.
  function locomotive() {
    const g = new THREE.Group(), black = mat(0x1d1e22, { metalness: 0.4, roughness: 0.5 }), brass = mat(0xc9a24a, { metalness: 0.7, roughness: 0.3 }), red = mat(0x8a2a24);
    const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
    box(3.5, 0.14, 1.3, 0, 0.42, 0, red);
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.2, 22), black); boiler.rotation.z = Math.PI / 2; boiler.position.set(0.45, 0.98, 0); g.add(boiler);
    [-0.2, 0.5, 1.2].forEach(x => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 22), brass); b.rotation.z = Math.PI / 2; b.position.set(x, 0.98, 0); g.add(b); });
    const front = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 22), black); front.rotation.z = Math.PI / 2; front.position.set(1.58, 0.98, 0); g.add(front);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.55, 14), black); chimney.position.set(1.25, 1.62, 0); g.add(chimney);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), brass); dome.position.set(0.55, 1.45, 0); g.add(dome);
    box(1.1, 1.25, 1.35, -1.15, 1.08, 0, mat(0x2c4a3a));
    box(1.3, 0.08, 1.55, -1.15, 1.75, 0, black);
    [1, -1].forEach(s => box(0.5, 0.4, 0.02, -1.15, 1.25, s * 0.68, new THREE.MeshStandardMaterial({ color: 0xffd994, emissive: 0xff9a40, emissiveIntensity: 0.9 })));
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 14), new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffe08a, emissiveIntensity: 1.6 }));
    lamp.rotation.z = Math.PI / 2; lamp.position.set(1.7, 1.25, 0); g.add(lamp);
    const head = new THREE.SpotLight(0xffe2a0, 1.6, 7, 0.5, 0.5, 1.5); head.position.set(1.75, 1.25, 0); head.target.position.set(4, 0, 0); g.add(head, head.target);
    const cow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 4), red); cow.rotation.set(0, Math.PI / 4, -Math.PI / 2); cow.scale.set(1, 1, 0.5); cow.position.set(1.85, 0.42, 0); g.add(cow);
    [-0.5, 0.25, 1.0].forEach(x => wheelSet(g, x, 0, 0.3, 0x8a2a24));
    wheelSet(g, -1.15, 0, 0.2, 0x2a2a2e);
    shadow(g);
    // humo
    const puffs = [], smokeM = new THREE.MeshStandardMaterial({ color: 0xd8d8de, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
    for (let i = 0; i < 7; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), smokeM.clone()); p.castShadow = false; g.add(p); puffs.push(p); }
    const update = t => {
      puffs.forEach((p, i) => {
        const u = ((t * 0.35 + i / puffs.length) % 1);
        p.position.set(1.25 - u * 1.6, 1.85 + u * 1.3, Math.sin(i * 2.1 + t) * 0.15 * u);
        const s = 0.6 + u * 1.8; p.scale.setScalar(s);
        p.material.opacity = 0.55 * (1 - u);
      });
    };
    return { g, update };
  }

  function anden(board, toW, SP, ROOF) {
    const add = (o, gx, gy, y = 0, ry = 0) => { const p = toW(gx, gy); o.position.set(p.x, y, p.z); o.rotation.y = ry; board.add(o); return o; };
    const W = (gx, gy) => toW(gx, gy);
    // andén de baldosas con línea amarilla de seguridad
    const a = W(-1.2, -0.75), b = W(7.6, 1.5);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(b.x - a.x, 0.03, b.z - a.z), mat(0x9c958a, { roughness: 0.95 }));
    plat.position.set((a.x + b.x) / 2, 0.015, (a.z + b.z) / 2); plat.receiveShadow = true; board.add(plat);
    const yl = new THREE.Mesh(new THREE.BoxGeometry(b.x - a.x, 0.035, 0.1), mat(0xd9b23e, { emissive: 0x3a2c00 }));
    yl.position.set((a.x + b.x) / 2, 0.02, b.z - 0.12); board.add(yl);
    add(station(10.5, 1.8, 1.75), 2.2, -1.4);
    add(bench(), 1.0, -0.42); add(bench(), 3.0, -0.42);
    add(crate(0.5), 5.6, -0.1); add(crate(0.38), 6.05, -0.25, 0, 0.4); add(crate(0.5), 5.75, 0.35, 0, 0.2);
    add(suitcase(0x7b4a2a), 6.3, 0.4, 0, 0.3); add(suitcase(0x3b5a6b, 0.36, 0.26), 6.55, 0.15, 0, -0.2);
    add(suitcase(0x8a2f2f, 0.4, 0.28), -0.75, 0.5, 0, 0.5);
    add(farol(true), 2.5, 1.38); add(farol(false), 5.55, 1.38); add(farol(false), -0.7, 1.2);
    // vías y tren
    const rz = W(0, 2).z;
    board.add(rails(W(-1.6, 0).x, W(7.6, 0).x, rz));
    const w1x0 = W(0.55, 0).x, w1x1 = W(2.45, 0).x, w2x0 = W(2.6, 0).x, w2x1 = W(5.45, 0).x;
    const lad = (gx, side, cx) => [W(gx, 0).x - cx, side];
    const c1 = (w1x0 + w1x1) / 2, c2 = (w2x0 + w2x1) / 2;
    const v1 = wagon(w1x1 - w1x0, [lad(1, -1, c1), lad(2, 1, c1)]); v1.position.set(c1, 0, rz); board.add(v1);
    const v2 = wagon(w2x1 - w2x0, [lad(4, -1, c2), lad(5, 1, c2)]); v2.position.set(c2, 0, rz); board.add(v2);
    const loco = locomotive(); loco.g.position.set(W(6.55, 0).x, 0, rz); board.add(loco.g);
    const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.12), mat(0x1d1e22)); coupler.position.set((w1x1 + w2x0) / 2, 0.45, rz); board.add(coupler);
    // del otro lado de las vías
    add(bush(1), 0.5, 3.6); add(bush(0.8), 3.4, 3.65); add(bush(0.9), 6.6, 3.7);
    add(crate(0.45), -0.85, 3.3, 0, 0.3);
    return { update: loco.update };
  }

  const parts = { mat, shadow, barrel, bench, suitcase, crate, rails, farol, bush, deadTree, station, wagon, locomotive, ladder, signTexture };
  return { rockBlock, ground, bodega, finca, coverSpot, loadProps, applyProps, anden, parts };
})();
