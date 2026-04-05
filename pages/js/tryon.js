// tryon.js – ES module version (works with the new HTML)
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
  console.warn("localStorage blocked by tracking prevention");
  showStatus(
    "⚠️ Storage access blocked. Please disable tracking prevention for this site.",
    true,
  );
}

if (!modelPath) {
  showStatus("⚠️ No product selected. Go back and choose one.", true);
} else {
  showStatus(`✨ Loading ${productType || "product"}...`, false);
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
const ambientLight = new THREE.AmbientLight(0x404060);
scene.add(ambientLight);
const mainLight = new THREE.DirectionalLight(0xffffff, 1);
mainLight.position.set(1, 2, 1);
scene.add(mainLight);
const fillLight = new THREE.DirectionalLight(0xffaa88, 0.5);
fillLight.position.set(-0.5, 1, 1.5);
scene.add(fillLight);

let model = null;
let userScale = 1;
let smooth = { x: 0, y: 0, z: -2, init: false };

// Load GLB model
if (modelPath) {
  const loader = new GLTFLoader(); // now works as a constructor
  loader.load(
    modelPath,
    (gltf) => {
      model = gltf.scene;
      // Auto-center and scale to fit face
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      model.position.sub(center);
      const scale = 1.8 / size;
      model.scale.set(scale, scale, scale);
      userScale = scale;
      scene.add(model);
      showStatus("✅ 3D model ready", false);
    },
    undefined,
    (error) => {
      console.error("GLB load error:", error);
      showStatus("❌ Failed to load 3D model. Check file path.", true);
    },
  );
}

function lerp(a, b, t = 0.25) {
  return a + (b - a) * t;
}

function updateModelFromFace(landmarks) {
  if (!model) return;

  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];

  let targetX = (nose.x - 0.5) * 2;
  let targetY = -(nose.y - 0.5) * 2;
  let eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  let targetZ = -2 + eyeDist * 1.8;

  if (!smooth.init) {
    smooth = { x: targetX, y: targetY, z: targetZ, init: true };
  } else {
    smooth.x = lerp(smooth.x, targetX);
    smooth.y = lerp(smooth.y, targetY);
    smooth.z = lerp(smooth.z, targetZ);
  }

  model.position.set(smooth.x, smooth.y, smooth.z);
  let roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  model.rotation.z = roll * 0.7;

  if (productType === "cap" || productType === "wig") model.position.y += 0.35;
  if (productType === "earring") {
    model.position.x += 0.2;
    model.position.y -= 0.15;
  }
  if (productType === "glasses") model.position.z += 0.05;
}

// ---------- MediaPipe FaceMesh ----------
let faceMesh = null;
let mediapipeCamera = null;

function initFaceTracking() {
  if (typeof FaceMesh === "undefined") {
    showStatus("⚠️ MediaPipe FaceMesh not loaded. Check internet.", true);
    return;
  }
  if (typeof Camera === "undefined") {
    showStatus("⚠️ MediaPipe CameraUtils not loaded.", true);
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
      updateModelFromFace(results.multiFaceLandmarks[0]);
    }
  });

  mediapipeCamera = new Camera(video, {
    onFrame: async () => {
      if (faceMesh) await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  mediapipeCamera
    .start()
    .then(() => {
      showStatus("📷 Camera active – look at the screen", false);
      video.style.transform = "scaleX(-1)";
    })
    .catch((err) => {
      console.error("Camera start error:", err);
      let msg =
        "Camera error: " + (err.message || "Permission denied or no camera");
      showStatus(msg, true);
      const btn = document.createElement("button");
      btn.textContent = "🔄 Retry Camera";
      btn.style.position = "fixed";
      btn.style.bottom = "130px";
      btn.style.left = "50%";
      btn.style.transform = "translateX(-50%)";
      btn.style.zIndex = "200";
      btn.style.padding = "10px 20px";
      btn.style.background = "#38bdf8";
      btn.style.border = "none";
      btn.style.borderRadius = "30px";
      btn.style.fontWeight = "bold";
      btn.onclick = () => window.location.reload();
      document.body.appendChild(btn);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFaceTracking);
} else {
  initFaceTracking();
}

// ---------- Animation loop ----------
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

window.changeSize = (delta) => {
  if (model) {
    userScale += delta;
    model.scale.set(userScale, userScale, userScale);
  }
};

window.goBack = () => {
  history.back();
};
