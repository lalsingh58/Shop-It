// tryon.js – Snapchat-like face tracking & perfect fitting
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ----- DOM elements -----
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");

// ----- UI messaging -----
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
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.backgroundColor = isError ? "rgba(200,0,0,0.8)" : "rgba(0,0,0,0.7)";
  setTimeout(() => (el.style.display = "none"), 4000);
  el.style.display = "block";
}

// ----- Get product from localStorage -----
let modelPath, productType;
try {
  modelPath = localStorage.getItem("selectedModel");
  productType = localStorage.getItem("productType");
} catch (e) {
  showStatus("⚠️ Storage access blocked. Disable tracking prevention.", true);
}

if (!modelPath) {
  showStatus("❌ No product selected. Go back.", true);
} else {
  showStatus(`✨ Loading ${productType || "product"}...`, false);
}

// ----- Three.js setup -----
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
const fillLight = new THREE.DirectionalLight(0xffaa88, 0.5);
fillLight.position.set(-0.5, 1, 1.5);
scene.add(fillLight);

// ----- Model variables -----
let model = null;
let baseScale = 1;
let userScale = 1;
let userOffset = { x: 0, y: 0, z: 0 };
let userRotZ = 0;

// Smoothing
let smoothPos = { x: 0, y: 0, z: 0, init: false };
let smoothRotZ = 0;

// ----- Face landmark indices (MediaPipe 468-point mesh) -----
const LANDMARKS = {
  NOSE_TIP: 1,
  NOSE_BRIDGE: 168,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  FOREHEAD_TOP: 10,
  LEFT_EAR: 234,
  RIGHT_EAR: 454,
  CHIN: 152,
  LIP_UPPER: 13,
};

// ----- Product anchors (normalized face coordinates, 0-1 range) -----
const ANCHORS = {
  glasses: {
    landmark: LANDMARKS.NOSE_BRIDGE,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0.02,
    scaleFactor: 1.2,
  },
  cap: {
    landmark: LANDMARKS.FOREHEAD_TOP,
    offsetX: 0,
    offsetY: -0.03,
    offsetZ: 0.05,
    scaleFactor: 1.0,
  },
  wig: {
    landmark: LANDMARKS.FOREHEAD_TOP,
    offsetX: 0,
    offsetY: -0.08,
    offsetZ: 0.05,
    scaleFactor: 1.1,
  },
  earring: {
    landmark: LANDMARKS.LEFT_EAR,
    offsetX: -0.1,
    offsetY: 0.02,
    offsetZ: 0.0,
    scaleFactor: 0.7,
  }, // left earring; right one is mirrored
  default: {
    landmark: LANDMARKS.NOSE_TIP,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    scaleFactor: 1.0,
  },
};

let anchor = ANCHORS[productType] || ANCHORS.default;

// For earrings, we need two instances (left and right). We'll handle separately.
let leftEarring = null;
let rightEarring = null;

// ----- Load 3D model -----
if (modelPath) {
  const loader = new GLTFLoader();
  loader.load(
    modelPath,
    (gltf) => {
      if (productType === "earring") {
        // For earrings, clone the model for both sides
        leftEarring = gltf.scene.clone();
        rightEarring = gltf.scene.clone();
        scene.add(leftEarring);
        scene.add(rightEarring);
        model = leftEarring; // just a reference for scaling UI
        // Auto-scale once based on model size
        const box = new THREE.Box3().setFromObject(leftEarring);
        const size = box.getSize(new THREE.Vector3()).length();
        baseScale = (0.15 / size) * (anchor.scaleFactor || 1);
        leftEarring.scale.set(baseScale, baseScale, baseScale);
        rightEarring.scale.set(baseScale, baseScale, baseScale);
        userScale = baseScale;
        showStatus("✅ Earrings loaded", false);
      } else {
        model = gltf.scene;
        // Auto-center and scale
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length();
        model.position.sub(center);
        baseScale = (1.8 / size) * (anchor.scaleFactor || 1);
        model.scale.set(baseScale, baseScale, baseScale);
        userScale = baseScale;
        scene.add(model);
        showStatus("✅ Model loaded", false);
      }
    },
    undefined,
    (err) => {
      console.error(err);
      showStatus("❌ Failed to load 3D model", true);
    },
  );
}

// ----- Helper: get 3D position of a landmark (converted to Three.js coordinates) -----
function getLandmarkPosition(landmark) {
  // MediaPipe gives x,y,z in normalized coordinates (0..1 for x,y; z is depth in meters)
  // Convert to Three.js space: x: -1..1, y: -1..1, z: -2..2 roughly
  const x = (landmark.x - 0.5) * 2;
  const y = -(landmark.y - 0.5) * 2;
  const z = -landmark.z * 2.5; // depth adjustment
  return new THREE.Vector3(x, y, z);
}

// ----- Update model(s) based on face landmarks -----
function updateModelsFromFace(landmarks) {
  if (!model && productType !== "earring") return;

  // Get the anchor landmark position
  const anchorLandmark = landmarks[anchor.landmark];
  if (!anchorLandmark) return;

  let targetPos = getLandmarkPosition(anchorLandmark);
  targetPos.x += anchor.offsetX;
  targetPos.y += anchor.offsetY;
  targetPos.z += anchor.offsetZ;

  // Add user offsets
  targetPos.x += userOffset.x;
  targetPos.y += userOffset.y;
  targetPos.z += userOffset.z;

  // Dynamic scale based on interocular distance (distance between outer eye corners)
  const leftEye = landmarks[LANDMARKS.LEFT_EYE_OUTER];
  const rightEye = landmarks[LANDMARKS.RIGHT_EYE_OUTER];
  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  // Scale factor: closer face = larger model
  const dynamicScale = 0.8 + eyeDist * 1.5;
  const finalScale = baseScale * userScale * dynamicScale;

  // Smooth position
  if (!smoothPos.init) {
    smoothPos = { x: targetPos.x, y: targetPos.y, z: targetPos.z, init: true };
  } else {
    smoothPos.x += (targetPos.x - smoothPos.x) * 0.3;
    smoothPos.y += (targetPos.y - smoothPos.y) * 0.3;
    smoothPos.z += (targetPos.z - smoothPos.z) * 0.3;
  }

  // Rotation: head roll (Z axis)
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  smoothRotZ += (roll * 0.6 + userRotZ - smoothRotZ) * 0.3;

  if (productType === "earring") {
    if (leftEarring && rightEarring) {
      // Left earring uses left ear landmark (234)
      const leftEarPos = getLandmarkPosition(landmarks[LANDMARKS.LEFT_EAR]);
      leftEarPos.x += userOffset.x - 0.12;
      leftEarPos.y += userOffset.y + 0.02;
      leftEarring.position.copy(leftEarPos);
      leftEarring.rotation.z = smoothRotZ;
      leftEarring.scale.set(finalScale, finalScale, finalScale);

      // Right earring uses right ear landmark (454)
      const rightEarPos = getLandmarkPosition(landmarks[LANDMARKS.RIGHT_EAR]);
      rightEarPos.x += userOffset.x + 0.12;
      rightEarPos.y += userOffset.y + 0.02;
      rightEarring.position.copy(rightEarPos);
      rightEarring.rotation.z = smoothRotZ;
      rightEarring.scale.set(finalScale, finalScale, finalScale);
    }
  } else if (model) {
    model.position.set(smoothPos.x, smoothPos.y, smoothPos.z);
    model.rotation.z = smoothRotZ;
    model.scale.set(finalScale, finalScale, finalScale);
  }
}

// ----- MediaPipe FaceMesh setup -----
let faceMesh, cameraHelper;

function initFaceTracking() {
  if (typeof FaceMesh === "undefined" || typeof Camera === "undefined") {
    showStatus("❌ MediaPipe not loaded. Check internet.", true);
    return;
  }
  faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      updateModelsFromFace(results.multiFaceLandmarks[0]);
    }
  });
  cameraHelper = new Camera(video, {
    onFrame: async () => faceMesh && (await faceMesh.send({ image: video })),
    width: 640,
    height: 480,
  });
  cameraHelper
    .start()
    .then(() => {
      showStatus("📷 Camera active – look at the screen", false);
      video.style.transform = "scaleX(-1)";
    })
    .catch((err) => showStatus("Camera error: " + err.message, true));
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initFaceTracking)
  : initFaceTracking();

// ----- Animation loop -----
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

// ----- Manual adjustment UI (sliders) -----
function createAdjustmentUI() {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.bottom = "80px";
  panel.style.right = "10px";
  panel.style.backgroundColor = "rgba(0,0,0,0.8)";
  panel.style.color = "white";
  panel.style.padding = "12px";
  panel.style.borderRadius = "12px";
  panel.style.zIndex = "200";
  panel.style.fontSize = "12px";
  panel.style.fontFamily = "sans-serif";
  panel.style.backdropFilter = "blur(4px)";
  panel.innerHTML = `
    <div style="margin-bottom:8px"><strong>🔧 Fine-tune fit</strong></div>
    X: <input type="range" id="adjX" min="-0.5" max="0.5" step="0.01" value="0">
    Y: <input type="range" id="adjY" min="-0.5" max="0.5" step="0.01" value="0"><br>
    Z: <input type="range" id="adjZ" min="-0.3" max="0.3" step="0.01" value="0">
    Scale: <input type="range" id="adjScale" min="0.5" max="2.0" step="0.01" value="1"><br>
    Rotate: <input type="range" id="adjRot" min="-0.8" max="0.8" step="0.01" value="0">
    <button id="resetAdj" style="margin-top:8px; background:#38bdf8; border:none; border-radius:20px; padding:5px 12px;">Reset</button>
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
    userScale = parseFloat(scaleSlider.value);
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
    userScale = 1;
    userRotZ = 0;
  };
}
createAdjustmentUI();

// ----- Legacy button functions -----
window.changeSize = (delta) => {
  if (model && productType !== "earring") {
    userScale += delta;
    userScale = Math.max(0.3, Math.min(2.5, userScale));
  }
};
window.goBack = () => history.back();
