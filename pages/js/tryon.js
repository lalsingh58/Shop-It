const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");

// Get selected product data
const modelPath = localStorage.getItem("selectedModel");
const productType = localStorage.getItem("productType");

// Show error but don't block camera if model is missing
if (!modelPath) {
  console.warn("No product selected – will still show camera but no 3D model.");
  // Optional: display a message on screen
  const warning = document.createElement("div");
  warning.textContent = "⚠️ No product selected. Go back and choose one.";
  warning.style.position = "fixed";
  warning.style.bottom = "80px";
  warning.style.left = "0";
  warning.style.right = "0";
  warning.style.background = "red";
  warning.style.color = "white";
  warning.style.textAlign = "center";
  warning.style.padding = "10px";
  warning.style.zIndex = "10";
  document.body.appendChild(warning);
}

// --- Three.js setup ---
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
renderer.setPixelRatio(window.devicePixelRatio);

// Lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 1, 2);
scene.add(dirLight);

let model = null;
let userScale = 1;
let smooth = { x: 0, y: 0, z: -2, init: false };

// Load the 3D model if a path exists
if (modelPath) {
  const loader = new THREE.GLTFLoader();
  loader.load(
    modelPath,
    (gltf) => {
      model = gltf.scene;
      // Auto-center and scale
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      model.position.sub(center);
      const scale = 1.5 / size;
      model.scale.set(scale, scale, scale);
      userScale = scale;
      scene.add(model);
    },
    undefined,
    (err) => {
      console.error("Model load error:", err);
      alert("Failed to load 3D model.");
    },
  );
}

function lerp(a, b, t = 0.2) {
  return a + (b - a) * t;
}

// Update model position/rotation based on face landmarks
function update3D(lm) {
  if (!model) return;

  const nose = lm[1];
  const left = lm[33];
  const right = lm[263];

  let x = (nose.x - 0.5) * 2;
  let y = -(nose.y - 0.5) * 2;
  let dist = Math.hypot(right.x - left.x, right.y - left.y);
  let z = -2 + dist * 1.5;

  if (!smooth.init) {
    smooth = { x, y, z, init: true };
  } else {
    smooth.x = lerp(smooth.x, x);
    smooth.y = lerp(smooth.y, y);
    smooth.z = lerp(smooth.z, z);
  }

  model.position.set(smooth.x, smooth.y, smooth.z);
  let angle = Math.atan2(right.y - left.y, right.x - left.x);
  model.rotation.z = angle;

  // Adjustments based on product type
  if (productType === "cap" || productType === "wig") {
    model.position.y += 0.4;
  }
  if (productType === "earring") {
    model.position.x += 0.25;
    model.position.y -= 0.2;
  }
}

// --- Mediapipe FaceMesh setup ---
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });
faceMesh.onResults((res) => {
  const lm = res.multiFaceLandmarks?.[0];
  if (lm) update3D(lm);
});

// --- Use Mediapipe Camera exclusively (handles permissions & stream) ---
const camera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480,
});

// Start camera – this will trigger the browser permission prompt
camera.start().catch((err) => {
  console.error("Camera error:", err);
  alert("Could not access camera. Please check permissions.");
});

// Mirror the video element for a natural selfie view
video.style.transform = "scaleX(-1)";

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();

// Handle window resize
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera3D.aspect = window.innerWidth / window.innerHeight;
  camera3D.updateProjectionMatrix();
});

// UI controls
window.changeSize = (delta) => {
  if (model) {
    userScale += delta;
    model.scale.set(userScale, userScale, userScale);
  }
};

window.goBack = () => {
  history.back();
};
