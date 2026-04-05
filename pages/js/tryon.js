import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ================= DOM =================
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");
const faceLabel = document.getElementById("faceLabel");

// ================= GET SELECTED PRODUCT =================
let selectedModel = localStorage.getItem("selectedModel");
let productType = localStorage.getItem("productType");

// fallback safety
if (!selectedModel) {
  selectedModel = "../assets/models/glasses/g1.glb";
}

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

// 🔥 Better lighting
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 1, 2);
scene.add(dirLight);

// ================= MODEL =================
let model = null;
let currentModelPath = "";
let loader = new GLTFLoader();
let baseScale = 1;

// ================= FALLBACK =================
function createFallbackGlasses() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000 });

  const left = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), mat);
  left.position.set(-0.2, 0, 0);

  const right = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), mat);
  right.position.set(0.2, 0, 0);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), mat);

  group.add(left, right, bridge);
  return group;
}

// ================= LOAD MODEL =================
function loadModel(path) {
  if (!path || currentModelPath === path) return;

  if (model) {
    scene.remove(model);
    model = null;
  }

  loader.load(
    path,
    (gltf) => {
      model = gltf.scene;

      // center model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      // 🔥 auto scale normalize
      const size = box.getSize(new THREE.Vector3()).length();
      const scaleFactor = 1.5 / size;
      model.scale.setScalar(scaleFactor);

      // ensure visible
      model.traverse((child) => {
        if (child.isMesh) {
          child.material.side = THREE.DoubleSide;
        }
      });

      scene.add(model);
      currentModelPath = path;

      console.log("✅ Model loaded:", path);
    },
    undefined,
    (err) => {
      console.warn("❌ Model failed → fallback used");

      model = createFallbackGlasses();
      scene.add(model);
    },
  );
}

// ================= POSITION =================
function getPos(p, w, h) {
  return new THREE.Vector3((p.x / w) * 2 - 1, 1 - (p.y / h) * 2, -p.z * 1.2);
}

// ================= FACE SHAPE =================
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
  const forehead = getPos(lm[10], w, h);
  const chin = getPos(lm[152], w, h);
  const leftEar = getPos(lm[234], w, h);
  const rightEar = getPos(lm[454], w, h);

  let center = new THREE.Vector3();

  // ================= 🎯 PRODUCT BASED POSITION =================

  if (productType === "glasses") {
    // 👓 Eyes center
    center.addVectors(leftEye, rightEye).multiplyScalar(0.5);
    center.z = nose.z - 0.35;
  } else if (productType === "cap") {
    // 🧢 Top of head
    center.copy(forehead);
    center.y += 0.25;
    center.z = nose.z - 0.6;
  } else if (productType === "wig") {
    // 💇 Full head coverage
    center.copy(forehead);
    center.y += 0.15;
    center.z = nose.z - 0.7;
  } else if (productType === "earring") {
    // 💍 Place between ears (we'll duplicate visually)
    center.addVectors(leftEar, rightEar).multiplyScalar(0.5);
    center.y -= 0.1;
    center.z = nose.z - 0.2;
  }

  // ================= 🎯 SMOOTH =================
  smoothPos.lerp(center, 0.35);
  model.position.copy(smoothPos);

  // ================= 🎯 ROTATION =================
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  smoothRot += (angle - smoothRot) * 0.35;
  model.rotation.set(0, 0, smoothRot);

  // ================= 🎯 SCALE =================
  const faceWidth = leftEar.distanceTo(rightEar);
  const faceHeight = forehead.distanceTo(chin);

  let scale;

  if (productType === "glasses") {
    scale = faceWidth * 2.2 * baseScale;
  } else if (productType === "cap") {
    scale = faceWidth * 3.2 * baseScale;
  } else if (productType === "wig") {
    scale = faceWidth * 3.8 * baseScale;
  } else if (productType === "earring") {
    scale = faceWidth * 0.8 * baseScale;
  }

  model.scale.set(scale, scale, scale);
}

// ================= AI =================
let detector = null;

async function initAI() {
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

  console.log("✅ AI Ready");
}

// ================= CAMERA =================
async function startCamera() {
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
  } catch (err) {
    console.error("❌ Camera error:", err);
    faceLabel.innerText = "❌ Camera blocked!";
    alert(err.message);
  }
}

// ================= LOOP =================
let lastLoadedModel = "";

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
      faceLabel.innerText = `👓 ${shape}`;

      // ✅ load only once
      if (selectedModel && lastLoadedModel !== selectedModel) {
        loadModel(selectedModel);
        lastLoadedModel = selectedModel;
      }

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
  await startCamera();
  await initAI();

  // 🔥 load selected model initially
  loadModel(selectedModel);

  detect();
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
