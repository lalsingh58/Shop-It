// tryon.js – Perfect face fitting with manual adjustments
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");

// ---------- UI messaging ----------
function showStatus(msg, isError = false) {
  let el = document.getElementById("statusMsg");
  if (!el) {
    el = document.createElement("div");
    el.id = "statusMsg";
    el.style.position = "fixed";
    el.style.bottom = "70px";
    el.style.left = "10px";
    el.style.right = "10px";
    el.style.backgroundColor = "rgba(0,0,0,0.7)";
    el.style.color = "white";
    el.style.padding = "8px";
    el.style.borderRadius = "8px";
    el.style.textAlign = "center";
    el.style.fontSize = "14px";
    el.style.zIndex = "100";
    el.style.fontFamily = "sans-serif";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.backgroundColor = isError ? "rgba(200,0,0,0.8)" : "rgba(0,0,0,0.7)";
  setTimeout(() => {
    if (el && el.parentNode) el.style.display = "none";
  }, 4000);
  el.style.display = "block";
}

// ---------- Get product from localStorage ----------
let modelPath, productType;
try {
  modelPath = localStorage.getItem("selectedModel");
  productType = localStorage.getItem("productType");
} catch (e) {
  console.warn("localStorage blocked");
  showStatus(
    "Storage access blocked. Please disable tracking prevention.",
    true,
  );
}

if (!modelPath) {
  showStatus("No product selected. Go back and choose one.", true);
} else {
  showStatus(`Loading ${productType || "product"}...`, false);
}

// ---------- Three.js setup ----------
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
scene.add(new THREE.AmbientLight(0x404060));
const mainLight = new THREE.DirectionalLight(0xffffff, 1);
mainLight.position.set(1, 2, 1);
scene.add(mainLight);
scene.add(new THREE.DirectionalLight(0xffaa88, 0.5).position.set(-0.5, 1, 1.5));

let model = null;
let userScale = 1;
let userOffset = { x: 0, y: 0, z: 0 }; // manual fine-tuning
let userRotZ = 0;

// Smoothing
let smoothPos = { x: 0, y: 0, z: 0, init: false };
let smoothRotZ = 0;

// Landmark indices
const NOSE = 1;
const LEFT_EYE = 33;
const RIGHT_EYE = 263;
const FOREHEAD = 10; // between eyebrows
const CHIN = 152;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;

// Product anchor points (normalized face coordinates, 0-1 range)
const ANCHORS = {
  glasses: { x: 0.5, y: 0.45, z: 0.02 }, // bridge of nose
  cap: { x: 0.5, y: 0.25, z: 0.05 }, // top forehead
  wig: { x: 0.5, y: 0.2, z: 0.05 }, // top of head
  earring: { x: 0.5, y: 0.55, z: 0.03 }, // earlobe level
  default: { x: 0.5, y: 0.5, z: 0.0 },
};

let anchor = ANCHORS[productType] || ANCHORS.default;

// Load GLB
if (modelPath) {
  const loader = new GLTFLoader();
  loader.load(
    modelPath,
    (gltf) => {
      model = gltf.scene;
      // Center and initial scale based on model size
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      model.position.sub(center);
      let baseScale = 1.8 / size;
      // Adjust for product type
      if (productType === "earring") baseScale *= 0.6;
      if (productType === "glasses") baseScale *= 1.2;
      model.scale.set(baseScale, baseScale, baseScale);
      userScale = baseScale;
      scene.add(model);
      showStatus("Model ready", false);
    },
    undefined,
    (err) => {
      console.error(err);
      showStatus("Failed to load 3D model", true);
    },
  );
}

// Helper: get face bounding box and key points
function getFaceMetrics(landmarks) {
  const xs = landmarks.map((l) => l.x);
  const ys = landmarks.map((l) => l.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  // Estimate depth from face width
  const depth = -2 + width * 2.5;
  return { centerX, centerY, width, height, depth };
}

// Update model position based on face and anchor
function updateModelFromFace(landmarks) {
  if (!model) return;

  // Get the specific anchor point from landmarks
  let targetX, targetY;
  if (productType === "glasses") {
    // Use nose bridge
    targetX = landmarks[NOSE].x;
    targetY = landmarks[NOSE].y;
  } else if (productType === "cap" || productType === "wig") {
    // Use forehead (midpoint between eyes and top of head)
    const eyeY = (landmarks[LEFT_EYE].y + landmarks[RIGHT_EYE].y) / 2;
    const topY = Math.min(...landmarks.map((l) => l.y));
    targetY = (eyeY + topY) / 2;
    targetX = landmarks[NOSE].x;
  } else if (productType === "earring") {
    // Use earlobe area (around landmark 234 for left ear, but we average)
    targetX = landmarks[LEFT_EAR].x;
    targetY = landmarks[LEFT_EAR].y + 0.02;
  } else {
    targetX = landmarks[NOSE].x;
    targetY = landmarks[NOSE].y;
  }

  // Convert to Three.js coordinates (-1..1 for X, -1..1 for Y)
  let targetPosX = (targetX - 0.5) * 2;
  let targetPosY = -(targetY - 0.5) * 2;

  // Depth based on face width
  const faceWidth = Math.hypot(
    landmarks[RIGHT_EYE].x - landmarks[LEFT_EYE].x,
    landmarks[RIGHT_EYE].y - landmarks[LEFT_EYE].y,
  );
  let targetPosZ = -2 + faceWidth * 2.2;

  // Apply anchor offsets (in normalized space)
  targetPosX += (anchor.x - 0.5) * 0.5;
  targetPosY += (anchor.y - 0.5) * 0.8;
  targetPosZ += anchor.z;

  // Add manual user offsets
  targetPosX += userOffset.x;
  targetPosY += userOffset.y;
  targetPosZ += userOffset.z;

  // Smooth movement
  if (!smoothPos.init) {
    smoothPos = { x: targetPosX, y: targetPosY, z: targetPosZ, init: true };
  } else {
    smoothPos.x += (targetPosX - smoothPos.x) * 0.3;
    smoothPos.y += (targetPosY - smoothPos.y) * 0.3;
    smoothPos.z += (targetPosZ - smoothPos.z) * 0.3;
  }
  model.position.set(smoothPos.x, smoothPos.y, smoothPos.z);

  // Rotation: only Z (roll) for now, plus manual
  let roll = Math.atan2(
    landmarks[RIGHT_EYE].y - landmarks[LEFT_EYE].y,
    landmarks[RIGHT_EYE].x - landmarks[LEFT_EYE].x,
  );
  smoothRotZ += (roll * 0.5 + userRotZ - smoothRotZ) * 0.3;
  model.rotation.z = smoothRotZ;
}

// ---------- MediaPipe FaceMesh ----------
let faceMesh, mediapipeCamera;

function initFaceTracking() {
  if (typeof FaceMesh === "undefined" || typeof Camera === "undefined") {
    showStatus("MediaPipe not loaded. Check internet.", true);
    return;
  }
  faceMesh = new FaceMesh({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
  });
  faceMesh.onResults((res) => {
    if (res.multiFaceLandmarks?.length)
      updateModelFromFace(res.multiFaceLandmarks[0]);
  });
  mediapipeCamera = new Camera(video, {
    onFrame: async () => faceMesh && (await faceMesh.send({ image: video })),
    width: 640,
    height: 480,
  });
  mediapipeCamera
    .start()
    .then(() => {
      showStatus("Camera active", false);
      video.style.transform = "scaleX(-1)";
    })
    .catch((err) => showStatus("Camera error: " + err.message, true));
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initFaceTracking)
  : initFaceTracking();

// Animation
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera3D.aspect = window.innerWidth / window.innerHeight;
  camera3D.updateProjectionMatrix();
});

// Manual adjustment panel
function createAdjustmentUI() {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.bottom = "80px";
  panel.style.right = "10px";
  panel.style.backgroundColor = "rgba(0,0,0,0.7)";
  panel.style.color = "white";
  panel.style.padding = "10px";
  panel.style.borderRadius = "8px";
  panel.style.zIndex = "200";
  panel.style.fontSize = "12px";
  panel.style.fontFamily = "sans-serif";
  panel.innerHTML = `
    <div style="margin-bottom:5px"><strong>Adjust Fit</strong></div>
    X: <input type="range" id="adjX" min="-0.5" max="0.5" step="0.01" value="0"> 
    Y: <input type="range" id="adjY" min="-0.5" max="0.5" step="0.01" value="0"><br>
    Z: <input type="range" id="adjZ" min="-0.3" max="0.3" step="0.01" value="0">
    Scale: <input type="range" id="adjScale" min="0.5" max="2.0" step="0.01" value="1"><br>
    Rotate: <input type="range" id="adjRot" min="-0.5" max="0.5" step="0.01" value="0">
    <button id="resetAdj" style="margin-top:5px; background:#38bdf8">Reset</button>
  `;
  document.body.appendChild(panel);

  const xSlider = document.getElementById("adjX");
  const ySlider = document.getElementById("adjY");
  const zSlider = document.getElementById("adjZ");
  const scaleSlider = document.getElementById("adjScale");
  const rotSlider = document.getElementById("adjRot");
  const resetBtn = document.getElementById("resetAdj");

  xSlider.oninput = () => {
    userOffset.x = parseFloat(xSlider.value);
  };
  ySlider.oninput = () => {
    userOffset.y = parseFloat(ySlider.value);
  };
  zSlider.oninput = () => {
    userOffset.z = parseFloat(zSlider.value);
  };
  scaleSlider.oninput = () => {
    if (model)
      model.scale.set(
        userScale * parseFloat(scaleSlider.value),
        userScale * parseFloat(scaleSlider.value),
        userScale * parseFloat(scaleSlider.value),
      );
  };
  rotSlider.oninput = () => {
    userRotZ = parseFloat(rotSlider.value);
  };
  resetBtn.onclick = () => {
    xSlider.value = "0";
    ySlider.value = "0";
    zSlider.value = "0";
    scaleSlider.value = "1";
    rotSlider.value = "0";
    userOffset = { x: 0, y: 0, z: 0 };
    userRotZ = 0;
    if (model) model.scale.set(userScale, userScale, userScale);
  };
}
createAdjustmentUI();

// Legacy buttons
window.changeSize = (delta) => {
  if (model) {
    userScale += delta;
    model.scale.set(userScale, userScale, userScale);
  }
};
window.goBack = () => history.back();
