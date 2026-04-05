import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ================= DOM =================
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");
const faceLabel = document.getElementById("faceLabel");

// ================= THREE =================
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

scene.add(new THREE.AmbientLight(0xffffff, 0.9));

// ================= MODEL =================
let model = null;
let currentModelPath = "";
let loader = new GLTFLoader();
let baseScale = 1;

// fallback models
const MODELS = {
  Round: "/assets/models/rect.glb",
  Square: "/assets/models/round.glb",
  Oval: "/assets/models/aviator.glb",
  Heart: "/assets/models/light.glb",
  Default: "/assets/models/glasses.glb",
};

// ================= LOAD MODEL =================
function loadModel(path) {
  if (!path) return;

  if (currentModelPath === path) return;

  if (model) {
    scene.remove(model);
    model = null;
  }

  loader.load(
    path,
    (gltf) => {
      model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();

      model.position.sub(center);
      model.scale.setScalar(1 / size);

      scene.add(model);
      currentModelPath = path;

      console.log("Model loaded:", path);
    },
    undefined,
    (err) => {
      console.error("Model load failed:", err);
    },
  );
}

// ================= POSITION =================
function getPos(p, w, h) {
  return new THREE.Vector3((p.x / w) * 2 - 1, 1 - (p.y / h) * 2, -p.z * 1.2);
}

// ================= FACE CLASSIFICATION =================
function classify(lm, w, h) {
  const left = getPos(lm[234], w, h);
  const right = getPos(lm[454], w, h);
  const chin = getPos(lm[152], w, h);
  const forehead = getPos(lm[10], w, h);

  const ratio = forehead.distanceTo(chin) / left.distanceTo(right);

  if (ratio > 1.5) return "Oval";
  if (ratio < 1.2) return "Round";
  if (Math.abs(left.distanceTo(right) - forehead.distanceTo(chin)) < 0.08)
    return "Square";

  return "Heart";
}

// ================= SMOOTH =================
let smoothPos = new THREE.Vector3();
let smoothRot = 0;

// ================= UPDATE MODEL =================
function updateModel(lm, w, h) {
  if (!model) return;

  const leftEye = getPos(lm[33], w, h);
  const rightEye = getPos(lm[263], w, h);
  const nose = getPos(lm[1], w, h);

  const center = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);

  center.z = nose.z - 0.08;

  // smooth movement
  smoothPos.lerp(center, 0.3);
  model.position.copy(smoothPos);

  // rotation
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  smoothRot += (angle - smoothRot) * 0.3;
  model.rotation.set(0, 0, smoothRot);

  // scale
  const faceWidth = getPos(lm[234], w, h).distanceTo(getPos(lm[454], w, h));
  const scale = faceWidth * 1.4 * baseScale;

  model.scale.set(scale, scale, scale);
}

// ================= AI =================
let detector = null;

async function initAI() {
  console.log("Initializing AI...");

  if (tf.getBackend() !== "webgl") {
    await tf.setBackend("webgl");
  }

  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    {
      runtime: "tfjs",
      maxFaces: 1,
    },
  );

  console.log("AI Ready");
}

// ================= CAMERA =================
async function startCamera() {
  console.log("Starting camera...");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    faceLabel.innerText = "✅ Camera Ready";
    console.log("Camera started");
  } catch (err) {
    console.error("Camera error:", err);
    faceLabel.innerText = "❌ Camera Blocked!";
    alert("Camera error: " + err.message);
  }
}

// ================= DETECTION LOOP =================
async function detect() {
  if (!detector || video.readyState !== 4) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    const faces = await detector.estimateFaces(video);

    if (faces.length > 0) {
      const lm = faces[0].keypoints;
      const w = video.videoWidth;
      const h = video.videoHeight;

      const shape = classify(lm, w, h);
      faceLabel.innerText = "👓 " + shape;

      const modelPath = MODELS[shape] || MODELS.Default;
      loadModel(modelPath);

      updateModel(lm, w, h);
    } else {
      faceLabel.innerText = "😶 Show your face";
    }
  } catch (err) {
    console.warn("Detection error:", err);
  }

  requestAnimationFrame(detect);
}

// ================= CONTROLS =================
document.getElementById("minusBtn").onclick = () => {
  baseScale = Math.max(0.6, baseScale - 0.1);
};

document.getElementById("plusBtn").onclick = () => {
  baseScale = Math.min(1.8, baseScale + 0.1);
};

window.goBack = () => history.back();

// ================= INIT =================
async function init() {
  await startCamera(); // 🔥 FIRST
  await initAI(); // 🔥 THEN AI
  detect(); // 🔥 LOOP
}
init();

// ================= RENDER =================
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();

// ================= RESIZE =================
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera3D.aspect = window.innerWidth / window.innerHeight;
  camera3D.updateProjectionMatrix();
});
