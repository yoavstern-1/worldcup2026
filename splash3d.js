// splash3d.js — WebGL intro: a realistic globe (atmosphere, clouds, ice caps,
// starfield) spins up, morphs into a metallic match ball, the ball is driven
// into a goal net, then the wordmark settles. Falls back to a flat SVG splash
// where WebGL or motion is unavailable.
import * as THREE from './three.module.min.js';

(function () {
  var host = document.getElementById('splashScreen');
  if (!host) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function finish(delay) {
    setTimeout(function () {
      host.classList.add('done');
      setTimeout(function () { host.style.display = 'none'; }, 600);
    }, delay);
  }

  // Deterministic PRNG so textures look identical every load
  function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }

  // ── Earth: albedo, with polar ice, layered land tones, subtle coastlines ──
  function earthTexture() {
    var c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
    var x = c.getContext('2d');
    // deep-ocean vertical gradient
    var g = x.createLinearGradient(0, 0, 0, 1024);
    g.addColorStop(0, '#0c2c4a'); g.addColorStop(.5, '#0f4c81'); g.addColorStop(1, '#0c2c4a');
    x.fillStyle = g; x.fillRect(0, 0, 2048, 1024);
    var r = rng(778291);
    // continents: clustered blobs, two green tones + arid edges
    function landmass(cx, cy, scale, tone) {
      var blobs = 26 + (r() * 30 | 0);
      for (var b = 0; b < blobs; b++) {
        var a = r() * 6.283, dist = r() * 150 * scale;
        var bx = cx + Math.cos(a) * dist, by = cy + Math.sin(a) * dist * .7, rad = (18 + r() * 46) * scale;
        x.fillStyle = tone; x.beginPath(); x.arc(bx, by, rad, 0, 6.283); x.fill();
      }
    }
    landmass(360, 430, 1.1, '#2c7a44');
    landmass(340, 560, 1.0, '#276b3c');
    landmass(1050, 470, 1.2, '#2f8048');
    landmass(1180, 640, 1.0, '#8a7a3c');   // arid band
    landmass(1520, 430, 1.0, '#2c7a44');
    landmass(1650, 700, .8, '#276b3c');
    landmass(760, 760, .7, '#5a7a3a');
    // sandy coastlines: lighter speckle over land clusters
    x.globalAlpha = .35; x.fillStyle = '#b8a05a';
    for (var i = 0; i < 1400; i++) { x.beginPath(); x.arc(r() * 2048, 120 + r() * 800, r() * 3, 0, 6.283); x.fill(); }
    x.globalAlpha = 1;
    // polar ice caps
    var top = x.createLinearGradient(0, 0, 0, 120); top.addColorStop(0, '#eef6ff'); top.addColorStop(1, 'rgba(238,246,255,0)');
    x.fillStyle = top; x.fillRect(0, 0, 2048, 120);
    var bot = x.createLinearGradient(0, 1024, 0, 904); bot.addColorStop(0, '#eef6ff'); bot.addColorStop(1, 'rgba(238,246,255,0)');
    x.fillStyle = bot; x.fillRect(0, 904, 2048, 120);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // roughness map: oceans glossy (dark = smooth), land matte (light = rough)
  function earthRough() {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    var x = c.getContext('2d');
    x.fillStyle = '#2a2a2a'; x.fillRect(0, 0, 1024, 512);           // smooth oceans
    var r = rng(4412);
    x.fillStyle = '#d8d8d8';
    for (var i = 0; i < 900; i++) { x.beginPath(); x.arc(r() * 1024, r() * 512, 6 + r() * 26, 0, 6.283); x.fill(); }
    return new THREE.CanvasTexture(c);
  }

  // wispy cloud layer (white on transparent)
  function cloudTexture() {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    var x = c.getContext('2d'); x.clearRect(0, 0, 1024, 512);
    var r = rng(90125);
    x.fillStyle = '#ffffff';
    for (var band = 0; band < 60; band++) {
      var cy = r() * 512, cx = r() * 1024, len = 60 + r() * 260;
      for (var p = 0; p < 40; p++) {
        x.globalAlpha = .015 + r() * .05;
        x.beginPath(); x.arc(cx + (r() - .5) * len, cy + (r() - .5) * 40, 10 + r() * 34, 0, 6.283); x.fill();
      }
    }
    x.globalAlpha = 1;
    return new THREE.CanvasTexture(c);
  }

  // ── Match ball ──
  // The old texture drew three wavy horizontal bands across an equirectangular
  // map. On a sphere those read as stitched seams around a core — a baseball.
  // A real modern match ball (the WC26 Trionda) is four curved panels meeting at
  // three-way junctions, and the panel edges have to be *spherical* to look
  // right, which no set of sine curves in UV space can be.
  //
  // So the panels are built where they actually live: on the sphere. Four seed
  // points at the vertices of a tetrahedron, and every texel is assigned to its
  // nearest seed — a spherical Voronoi diagram, whose four cells are exactly the
  // four curved triangular panels. The gap between the nearest and second
  // nearest seed gives distance-to-seam for free: near zero at a seam, largest
  // at a panel's centre. That single number drives the groove, the inset colour
  // triangle, and the bump map.
  function normalize3(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  var PANELS = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(normalize3);
  // Trionda's palette: a white ball with red, blue and green panels.
  var PANEL_COL = [[214, 25, 47], [17, 86, 176], [10, 140, 74], [252, 252, 252]];
  var WHITE = [246, 247, 248];

  function smooth(a, b, t) {
    t = (t - a) / (b - a);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
  }

  // -> { panel, gap } for a texel. gap = dot(nearest) - dot(second nearest).
  function panelAt(u, v) {
    var lon = u * 6.283185307 - 3.141592653;
    var lat = 1.570796327 - v * 3.141592653;
    var cl = Math.cos(lat);
    var dx = cl * Math.cos(lon), dy = Math.sin(lat), dz = cl * Math.sin(lon);
    var best = -2, second = -2, idx = 0;
    for (var i = 0; i < 4; i++) {
      var p = PANELS[i];
      var d = dx * p[0] + dy * p[1] + dz * p[2];
      if (d > best) { second = best; best = d; idx = i; }
      else if (d > second) { second = d; }
    }
    return { panel: idx, gap: best - second };
  }

  // gap runs 0 at a seam to 4/3 at a panel's centre (a tetrahedron's seeds are
  // 109.47° apart, so dot = -1/3 between neighbours).
  //
  // The ball has to stay WHITE-dominant. Colouring most of each panel is what
  // turns a football into a beach ball; the real thing is a white ball with one
  // curved colour wedge inset in each of three panels, and the fourth panel left
  // plain. So the colour only starts deep inside a cell, and the wide white
  // field either side of every seam is the ball, not a stripe.
  var SEAM  = 0.016;   // groove half-width, in gap units
  var INSET = 0.520;   // colour begins this far inside the panel
  var FADE  = 0.090;   // soft edge on the colour
  var RIM   = 0.045;   // thin gold rim tracing the colour wedge
  var GOLD  = [198, 162, 84];

  function ballTexture() {
    var W = 1024, H = 512;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var img = x.createImageData(W, H), d = img.data;
    var r = rng(20260619);

    for (var py = 0; py < H; py++) {
      for (var px = 0; px < W; px++) {
        var pa = panelAt(px / W, py / H);
        var col = PANEL_COL[pa.panel];

        var cr = WHITE[0], cg = WHITE[1], cb = WHITE[2];

        if (pa.panel < 3) {
          // a thin gold rim just outside the colour, then the colour itself
          var rim = smooth(INSET - RIM, INSET, pa.gap) * (1 - smooth(INSET, INSET + RIM, pa.gap));
          cr += (GOLD[0] - cr) * rim; cg += (GOLD[1] - cg) * rim; cb += (GOLD[2] - cb) * rim;

          var mix = smooth(INSET + RIM * 0.5, INSET + RIM * 0.5 + FADE, pa.gap);
          cr += (col[0] - cr) * mix; cg += (col[1] - cg) * mix; cb += (col[2] - cb) * mix;
        }

        // debossed groove along every seam: a narrow grey line, not a wide band
        var groove = 1 - smooth(0, SEAM, pa.gap);
        if (groove > 0) {
          var g = 0.55 * groove * groove;
          cr += (118 - cr) * g; cg += (126 - cg) * g; cb += (134 - cb) * g;
        }

        // faint grain so the surface is not a flat plastic fill
        var n = (r() - 0.5) * 6;
        var o = (py * W + px) * 4;
        d[o]     = cr + n;
        d[o + 1] = cg + n;
        d[o + 2] = cb + n;
        d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  // Bump map from the same distance-to-seam field: the seams sink, the panels
  // bulge very slightly. This is what stops the ball reading as a printed
  // sphere — the light catches the panel edges.
  function ballBump() {
    var W = 512, H = 256;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var img = x.createImageData(W, H), d = img.data;
    for (var py = 0; py < H; py++) {
      for (var px = 0; px < W; px++) {
        var pa = panelAt(px / W, py / H);
        var h = 150 + 105 * smooth(0, 0.10, pa.gap);   // dark in the groove, light on the panel
        var o = (py * W + px) * 4;
        d[o] = d[o + 1] = d[o + 2] = h;
        d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  }

  function netTexture() {
    var c = document.createElement('canvas'); c.width = 256; c.height = 256;
    var x = c.getContext('2d'); x.clearRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2;
    for (var i = -256; i < 256; i += 18) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke(); x.beginPath(); x.moveTo(i + 256, 0); x.lineTo(i, 256); x.stroke(); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
  }

  function svgFallback() {
    host.innerHTML = '<div id="splashTitle" class="in"><span id="splashLine1">WORLD CUP</span>' +
      '<span id="splashRule"></span><span id="splashLine2">2026</span></div>';
    finish(1200);
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  } catch (e) { svgFallback(); return; }
  if (!renderer || !renderer.getContext()) { svgFallback(); return; }
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  var title = document.createElement('div');
  title.id = 'splashTitle';
  title.innerHTML = '<span id="splashLine1">WORLD CUP</span><span id="splashRule"></span><span id="splashLine2">2026</span>';
  host.appendChild(title);

  var canvas = renderer.domElement; canvas.id = 'splashCanvas';
  host.insertBefore(canvas, title);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  // ── Starfield ──
  var starGeo = new THREE.BufferGeometry();
  var starN = 900, pos = new Float32Array(starN * 3), sr = rng(31337);
  for (var s = 0; s < starN; s++) {
    var th = sr() * 6.283, ph = Math.acos(2 * sr() - 1), rad = 30 + sr() * 30;
    pos[s * 3] = rad * Math.sin(ph) * Math.cos(th);
    pos[s * 3 + 1] = rad * Math.sin(ph) * Math.sin(th);
    pos[s * 3 + 2] = rad * Math.cos(ph);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbcd4ff, size: 0.14, sizeAttenuation: true, transparent: true, opacity: .9 }));
  scene.add(stars);

  // ── Lights: low ambient for drama, strong warm key, cool rim ──
  scene.add(new THREE.AmbientLight(0x39506b, 0.55));
  var key = new THREE.DirectionalLight(0xfff2df, 2.1); key.position.set(-3.5, 3, 5); scene.add(key);
  var rimL = new THREE.DirectionalLight(0x5aa0ff, 0.9); rimL.position.set(4, -1.5, -2); scene.add(rimL);
  var fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(2, 4, 3); scene.add(fill);

  var sphere = new THREE.SphereGeometry(1, 96, 96);

  // ── Earth + clouds + atmosphere ──
  var earthGroup = new THREE.Group(); scene.add(earthGroup);
  var earth = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({
    map: earthTexture(), roughnessMap: earthRough(), roughness: 1, metalness: 0
  }));
  earthGroup.add(earth);
  var clouds = new THREE.Mesh(new THREE.SphereGeometry(1.015, 64, 64),
    new THREE.MeshStandardMaterial({ map: cloudTexture(), transparent: true, opacity: .55, roughness: 1, metalness: 0, depthWrite: false }));
  earthGroup.add(clouds);
  // fresnel atmosphere halo
  var atmMat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(0x3f8bff) }, c: { value: 0.55 }, p: { value: 4.2 } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vP=mv.xyz; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 glowColor; uniform float c; uniform float p; varying vec3 vN; varying vec3 vP; void main(){ vec3 v=normalize(-vP); float rim=pow(clamp(c - dot(vN,v),0.0,1.0), p); gl_FragColor=vec4(glowColor, rim); }',
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  });
  var atm = new THREE.Mesh(new THREE.SphereGeometry(1.18, 48, 48), atmMat);
  earthGroup.add(atm);
  earth.rotation.z = clouds.rotation.z = 0.4;

  // ── Match ball ──
  // Coated leather, not chrome: almost no metalness, a fairly tight roughness so
  // the key light leaves one soft highlight, and the seams raised through the
  // bump map so the panel edges catch it.
  var ballMat = new THREE.MeshStandardMaterial({
    map: ballTexture(),
    bumpMap: ballBump(),
    bumpScale: 0.45,
    roughness: .38,
    metalness: .04
  });
  var ball = new THREE.Mesh(sphere, ballMat);
  ball.scale.setScalar(0.001);
  // tilt so a three-panel junction, not a flat panel face, is pointed at us
  ball.rotation.z = 0.35; ball.rotation.x = 0.25;
  scene.add(ball);

  var net = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2),
    new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, opacity: 0 }));
  net.position.z = -1.4; scene.add(net);

  function resize() {
    var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  var start = null, raf, spin = 0.5, ended = false;
  function e2(a, b, t) { return a + (b - a) * Math.min(Math.max(t, 0), 1); }

  function frame(ts) {
    if (start === null) start = ts;
    var e = ts - start;
    stars.rotation.y += 0.0004;

    if (e < 1500) spin = Math.min(spin * 1.012, 9);
    earth.rotation.y += spin * 0.016;
    clouds.rotation.y += spin * 0.018;
    ball.rotation.y += spin * 0.016;

    if (e >= 1500 && e < 1800) {
      var m = (e - 1500) / 300;
      earthGroup.scale.setScalar(e2(1, 0.001, m));
      ball.scale.setScalar(e2(0.001, 1, m));
    } else if (e >= 1800) { earthGroup.visible = false; ball.scale.setScalar(Math.max(ball.scale.x, 1)); }

    if (e >= 2050 && e < 2300) { var f = (e - 2050) / 250; ball.position.z = e2(0, 2.0, f); ball.scale.setScalar(e2(1, 1.5, f)); }
    if (e >= 2300 && e < 2700) {
      var g = (e - 2300) / 400;
      net.material.opacity = e2(0, 1, g * 2);
      ball.position.z = e2(2.0, -1.0, g);
      ball.scale.setScalar(e2(1.5, 0.8, g));
      camera.position.x = Math.sin(e) * 0.03 * (1 - g);
    }
    if (e >= 2900) { var d = Math.min((e - 2900) / 400, 1); canvas.style.opacity = String(1 - d); }
    if (e >= 2420 && !title.classList.contains('in')) title.classList.add('in');

    renderer.render(scene, camera);
    if (e < 3400) raf = requestAnimationFrame(frame);
    else if (!ended) {
      ended = true;
      renderer.dispose();
      ballMat.map.dispose(); ballMat.bumpMap.dispose();
      earth.material.map.dispose(); clouds.material.map.dispose(); net.material.map.dispose();
      window.removeEventListener('resize', resize); finish(0);
    }
  }

  if (reduce) {
    earthGroup.visible = false; ball.scale.setScalar(1); title.classList.add('in');
    renderer.render(scene, camera); finish(900);
  } else {
    raf = requestAnimationFrame(frame);
  }
})();
