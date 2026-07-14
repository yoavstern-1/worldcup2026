// trophy3d.js — the trophy at the head of the bracket, as real geometry rather than a
// flat SVG cup with a gradient on it.
//
// The FIFA trophy is not a cup. It is two figures spiralling up out of a base and
// holding a globe: the silhouette pinches at the waist and flares at both ends. A
// LatheGeometry over that profile gets the body; the globe is a sphere with meridians
// sunk into it. Gold is metalness ~1 / low roughness, which is black without something
// to reflect — so the scene carries an environment, not just lights.
//
// Falls back to the existing SVG whenever WebGL is missing, and holds a still frame
// (no spin) under prefers-reduced-motion. Same contract as splash3d.js.

import * as THREE from './three.module.min.js';

var GOLD = 0xd9a441;
var GOLD_HI = 0xffe9a8;

// Half-silhouette of the trophy, in the x>=0 plane, bottom to top. Lathe revolves it.
function profile() {
  var p = [];
  function at(x, y) { p.push(new THREE.Vector2(x, y)); }

  // Malachite base: two stacked discs.
  at(0.00, 0.00); at(1.00, 0.00); at(1.00, 0.16); at(0.96, 0.20);
  at(0.96, 0.34); at(0.90, 0.38);

  // The stem sweeps in to a narrow waist...
  at(0.62, 0.52); at(0.40, 0.78); at(0.30, 1.06); at(0.26, 1.34);

  // ...then flares out as the figures' shoulders open up to carry the globe.
  at(0.30, 1.62); at(0.40, 1.88); at(0.52, 2.08); at(0.60, 2.20);

  // Shoulder ring the globe rests in.
  at(0.66, 2.30); at(0.62, 2.36); at(0.50, 2.40); at(0.30, 2.42);
  at(0.00, 2.42);
  return p;
}

function buildTrophy() {
  var g = new THREE.Group();

  var gold = new THREE.MeshStandardMaterial({
    color: GOLD, metalness: 1.0, roughness: 0.26,
    emissive: 0x2a1c05, emissiveIntensity: 0.35
  });

  var body = new THREE.Mesh(new THREE.LatheGeometry(profile(), 96), gold);
  g.add(body);

  // The globe the figures hold. Slightly rougher, so it separates from the body
  // instead of melting into one gold blob.
  var globeMat = new THREE.MeshStandardMaterial({
    color: GOLD_HI, metalness: 1.0, roughness: 0.38
  });
  var globe = new THREE.Mesh(new THREE.SphereGeometry(0.60, 48, 36), globeMat);
  globe.position.y = 2.88;
  g.add(globe);

  // Meridians + equator, cut as thin rings. This is what makes it read as a globe
  // and not a ball bearing.
  var lineMat = new THREE.MeshStandardMaterial({ color: 0x6b4a12, metalness: 0.9, roughness: 0.5 });
  var eq = new THREE.Mesh(new THREE.TorusGeometry(0.601, 0.016, 8, 64), lineMat);
  eq.rotation.x = Math.PI / 2;
  eq.position.y = 2.88;
  g.add(eq);
  for (var i = 0; i < 3; i++) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(0.601, 0.014, 8, 64), lineMat);
    m.position.y = 2.88;
    m.rotation.y = (i / 3) * Math.PI;
    g.add(m);
  }

  // The spiral seam of the two figures, wound up the waist.
  var curve = new THREE.Curve();
  curve.getPoint = function (t) {
    var y = 0.42 + t * 1.86;
    var r = 0.30 + 0.30 * Math.pow(Math.abs(t - 0.52) * 2, 1.7);
    var a = t * Math.PI * 1.9;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  };
  var seamMat = new THREE.MeshStandardMaterial({ color: 0x8a6520, metalness: 1.0, roughness: 0.45 });
  var seam = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.035, 8, false), seamMat);
  g.add(seam);
  var seam2 = seam.clone();
  seam2.rotation.y = Math.PI;
  g.add(seam2);

  // Dark banding on the base, standing in for the malachite rings.
  var band = new THREE.Mesh(
    new THREE.CylinderGeometry(1.005, 1.005, 0.11, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x123a2a, metalness: 0.35, roughness: 0.65, side: THREE.DoubleSide })
  );
  band.position.y = 0.08;
  g.add(band);

  g.position.y = -1.35;   // sit the mass on the camera's centre line
  return g;
}

// Gold with nothing to reflect renders black. A tiny gradient cube map gives the metal
// a sky to pick up, which is what makes it look like metal rather than mustard plastic.
function environment(renderer) {
  var c = document.createElement('canvas');
  c.width = c.height = 128;
  var x = c.getContext('2d');
  var grd = x.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#fff6dd');
  grd.addColorStop(0.45, '#7d6a3a');
  grd.addColorStop(0.55, '#22402f');
  grd.addColorStop(1, '#050d09');
  x.fillStyle = grd;
  x.fillRect(0, 0, 128, 128);

  var tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;

  if (typeof THREE.PMREMGenerator === 'function') {
    var pmrem = new THREE.PMREMGenerator(renderer);
    var rt = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();
    return rt.texture;
  }
  return tex;
}

// Public: mount a spinning trophy into `host`. Returns false if it could not, so the
// caller can leave its SVG in place.
window.mountTrophy3D = function (host, size) {
  if (!host) return false;
  size = size || 76;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { return false; }
  if (!renderer || !renderer.getContext()) return false;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(size, size * 1.28, false);
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if ('toneMapping' in renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  }

  var canvas = renderer.domElement;
  canvas.style.width = size + 'px';
  canvas.style.height = (size * 1.28) + 'px';
  canvas.style.display = 'block';
  canvas.setAttribute('aria-hidden', 'true');

  var scene = new THREE.Scene();
  var env = environment(renderer);
  scene.environment = env;

  var camera = new THREE.PerspectiveCamera(28, 1 / 1.28, 0.1, 100);
  camera.position.set(0, 0.15, 8.2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  var key = new THREE.DirectionalLight(0xfff0cf, 2.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x9fe8c0, 1.3);   // emerald rim, ties it to the page
  rim.position.set(-4, 1.5, -3);
  scene.add(rim);

  var trophy = buildTrophy();
  scene.add(trophy);

  host.innerHTML = '';
  host.appendChild(canvas);

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // One still frame, held at a three-quarter angle. No rAF loop at all.
    trophy.rotation.y = -0.5;
    renderer.render(scene, camera);
    return true;
  }

  var raf = 0;
  var running = true;

  // Stop the loop when the bracket is off screen. A 60fps render behind a scrolled-away
  // section is pure battery burn on a phone.
  var io = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(function (entries) {
      running = entries[0].isIntersecting;
      if (running && !raf) raf = requestAnimationFrame(tick);
    }, { threshold: 0 });
    io.observe(host);
  }

  var t0 = performance.now();
  function tick(now) {
    raf = 0;
    if (!running) return;
    var t = (now - t0) / 1000;
    trophy.rotation.y = t * 0.42;
    trophy.position.y = -1.35 + Math.sin(t * 1.1) * 0.045;   // a slow breath, not a bounce
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return true;
};
