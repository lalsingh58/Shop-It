const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");

const modelPath = localStorage.getItem("selectedModel");
const productType = localStorage.getItem("productType");

let userScale = 1;

// THREE SETUP
const scene = new THREE.Scene();

const camera3D = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
);
camera3D.position.z = 2;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);

// 🔥 LIGHTING (REALISTIC)
const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
scene.add(light);

// MODEL
let model;
const loader = new THREE.GLTFLoader();

loader.load(
  modelPath,
  (gltf) => {
    model = gltf.scene;

    let baseScale = 0.5;

    if (productType === "glasses") baseScale = 0.6;
    if (productType === "cap") baseScale = 1.3;
    if (productType === "wig") baseScale = 1.5;
    if (productType === "earring") baseScale = 0.3;

    model.scale.set(baseScale, baseScale, baseScale);
    userScale = baseScale;

    scene.add(model);
  },
  undefined,
  (err) => alert("❌ Model load error"),
);

// SMOOTHING
let smooth = { x: 0, y: 0, z: -2, init: false };

function lerp(a, b, t = 0.2) {
  return a + (b - a) * t;
}

// UPDATE
function update3D(lm) {
  if (!model) return;

  const nose = lm[1];
  const left = lm[33];
  const right = lm[263];

  let x = (nose.x - 0.5) * 2;
  let y = -(nose.y - 0.5) * 2;

  let dist = Math.hypot(right.x - left.x, right.y - left.y);
  let z = -2 + dist * 1.5;

  if (!smooth.init) smooth = { x, y, z, init: true };
  else {
    smooth.x = lerp(smooth.x, x);
    smooth.y = lerp(smooth.y, y);
    smooth.z = lerp(smooth.z, z);
  }

  model.position.set(smooth.x, smooth.y, smooth.z);

  let angle = Math.atan2(right.y - left.y, right.x - left.x);
  model.rotation.z = angle;

  // 🎯 TYPE BASED POSITION
  if (productType === "cap" || productType === "wig") {
    model.position.y += 0.4;
  }

  if (productType === "earring") {
    model.position.x += 0.25;
    model.position.y -= 0.2;
  }
}

// MEDIAPIPE
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
});

faceMesh.onResults((res) => {
  const lm = res.multiFaceLandmarks?.[0];
  if (!lm) return;
  update3D(lm);
});

// CAMERA
const camera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
});

// START
navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;
  video.play();
  camera.start();
});

// RENDER
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();

// RESIZE
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera3D.aspect = window.innerWidth / window.innerHeight;
  camera3D.updateProjectionMatrix();
});

// UI
window.changeSize = (d) => {
  userScale += d;
  if (model) model.scale.set(userScale, userScale, userScale);
};

window.goBack = () => history.back();
