import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const tf = window.tf;
const faceLandmarksDetection = window.faceLandmarksDetection;

// ================= DOM =================
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");
const label = document.getElementById("faceLabel");

// ================= PRODUCT =================
const selectedModel =
  localStorage.getItem("selectedModel") || "../assets/models/glasses/g1.glb";

const productType = localStorage.getItem("productType") || "glasses";

// ================= THREE =================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
);
camera.position.z = 2;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Lighting (better realism)
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
dirLight.position.set(0, 1, 2);
scene.add(dirLight);

// ================= FACE ANCHOR =================
const faceAnchor = new THREE.Group();
scene.add(faceAnchor);

// ================= MODEL =================
let model,
  baseScale = 1;
const loader = new GLTFLoader();

loader.load(selectedModel, (gltf) => {
  model = gltf.scene;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  baseScale = 1 / size;

  model.scale.setScalar(baseScale);
  faceAnchor.add(model);
});

// ================= OCCLUDER =================
const occluder = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 32),
  new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
  }),
);
faceAnchor.add(occluder);

// ================= SMOOTHING =================
const smoothPos = new THREE.Vector3();
const smoothRot = new THREE.Euler();
let smoothScale = 1;

// adaptive smoothing (Snap-like)
function adaptiveLerp(current, target, factorFast = 0.6, factorSlow = 0.2) {
  const diff = current.distanceTo(target);
  const factor = diff > 0.05 ? factorFast : factorSlow;
  current.lerp(target, factor);
}

// ================= NORMALIZE =================
function norm(p, w, h) {
  return new THREE.Vector3(
    (p.x - w / 2) / (w / 2),
    -(p.y - h / 2) / (h / 2),
    -p.z * 0.7,
  );
}

// ================= USER SCALE (GESTURE) =================
let userScale = 1;

// pinch zoom mobile
let lastDist = null;
canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (lastDist) {
      userScale += (dist - lastDist) * 0.002;
      userScale = Math.max(0.5, Math.min(2.5, userScale));
    }
    lastDist = dist;
  }
});

// scroll zoom desktop
window.addEventListener("wheel", (e) => {
  userScale += e.deltaY * -0.001;
  userScale = Math.max(0.5, Math.min(2.5, userScale));
});

// ================= UPDATE =================
function update(lm, w, h) {
  if (!model || w === 0) return;

  const leftEye = norm(lm[33], w, h);
  const rightEye = norm(lm[263], w, h);
  const nose = norm(lm[1], w, h);
  const forehead = norm(lm[10], w, h);
  const leftEar = norm(lm[234], w, h);
  const rightEar = norm(lm[454], w, h);

  const faceWidth = leftEar.distanceTo(rightEar);

  // ===== POSITION =====
  const eyeCenter = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);
  const anchor = new THREE.Vector3()
    .addVectors(eyeCenter, nose)
    .multiplyScalar(0.5);
  anchor.z = nose.z;

  adaptiveLerp(smoothPos, anchor);
  faceAnchor.position.copy(smoothPos);

  // ===== ROTATION =====
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;

  const rotZ = Math.atan2(dy, dx);
  const rotY = (rightEye.z - leftEye.z) * 2;
  const rotX = (nose.y - forehead.y) * 2;

  smoothRot.x += (rotX - smoothRot.x) * 0.4;
  smoothRot.y += (rotY - smoothRot.y) * 0.4;
  smoothRot.z += (rotZ - smoothRot.z) * 0.4;

  faceAnchor.rotation.copy(smoothRot);

  // ===== SCALE =====
  const targetScale = baseScale * faceWidth * 2 * userScale;
  smoothScale += (targetScale - smoothScale) * 0.4;

  // ===== PRODUCTS =====
  if (productType === "glasses") {
    model.position.set(0, -0.02, 0.12);
    model.scale.setScalar(smoothScale * 1.15);
  }

  if (productType === "cap") {
    model.position.set(0, 0.5 + faceWidth * 0.2, -faceWidth * 0.4);
    model.scale.setScalar(smoothScale * 2.0);
  }

  if (productType === "wig") {
    model.position.set(0, 0.45 + faceWidth * 0.15, -faceWidth * 0.5);
    model.scale.setScalar(smoothScale * 2.5);
  }

  // 💍 Earrings (new)
  if (productType === "earring") {
    model.position.set(0, -0.2, 0);
    model.scale.setScalar(smoothScale * 0.8);

    // optional: duplicate for both ears (advanced can be added)
  }

  // occlusion
  occluder.scale.set(faceWidth * 1.3, faceWidth * 1.6, faceWidth);
}

// ================= CAMERA =================
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
  });

  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

// ================= AI =================
let detector;

async function initAI() {
  await tf.setBackend("webgl");

  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    {
      runtime: "tfjs",
      maxFaces: 1,
    },
  );
}

// ================= LOOP =================
async function detect() {
  if (!detector) {
    requestAnimationFrame(detect);
    return;
  }

  const faces = await detector.estimateFaces(video);

  if (faces.length > 0) {
    label.innerText = "🔥 FINAL BOSS TRACKING";
    update(faces[0].keypoints, video.videoWidth, video.videoHeight);
  } else {
    label.innerText = "❌ No face";
  }

  requestAnimationFrame(detect);
}

// ================= INIT =================
async function init() {
  await startCamera();
  await initAI();
  detect();
}
init();

// ================= RENDER =================
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// ================= RESIZE =================
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
