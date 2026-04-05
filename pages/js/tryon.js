import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const tf = window.tf;
const faceLandmarksDetection = window.faceLandmarksDetection;

// DOM
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");
const label = document.getElementById("faceLabel");

// PRODUCT
const selectedModel =
  localStorage.getItem("selectedModel") || "../assets/models/glasses/g1.glb";

const productType = localStorage.getItem("productType") || "glasses";

// THREE
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

// LIGHT (better realism)
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(0, 1, 2);
scene.add(light);

// FACE ANCHOR
const faceAnchor = new THREE.Group();
scene.add(faceAnchor);

// MODEL
let model,
  baseScale = 1;
const loader = new GLTFLoader();

loader.load(
  selectedModel,
  (gltf) => {
    model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    baseScale = 1 / size;

    model.scale.setScalar(baseScale);
    faceAnchor.add(model);
  },
  undefined,
  (err) => console.error("Model load error:", err),
);

// ===== OCCLUDER (basic AR realism) =====
const occluder = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 32),
  new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
  }),
);
faceAnchor.add(occluder);

// ===== SMOOTH FILTER (Snap-style) =====
const smoothPos = new THREE.Vector3();
const smoothRot = new THREE.Euler();
let smoothScale = 1;

// NORMALIZE
function norm(p, w, h) {
  return new THREE.Vector3(
    (p.x - w / 2) / (w / 2),
    -(p.y - h / 2) / (h / 2),
    -p.z * 0.7,
  );
}

// UPDATE MODEL
function update(lm, w, h) {
  if (!model || w === 0) return;

  // landmarks
  const leftEye = norm(lm[33], w, h);
  const rightEye = norm(lm[263], w, h);
  const nose = norm(lm[1], w, h);
  const forehead = norm(lm[10], w, h);
  const leftEar = norm(lm[234], w, h);
  const rightEar = norm(lm[454], w, h);

  const faceWidth = leftEar.distanceTo(rightEar);

  // ===== POSITION (stable anchor) =====
  const eyeCenter = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);

  const anchor = new THREE.Vector3()
    .addVectors(eyeCenter, nose)
    .multiplyScalar(0.5);

  anchor.z = nose.z;

  smoothPos.lerp(anchor, 0.65);
  faceAnchor.position.copy(smoothPos);

  // ===== ROTATION (stable 3-axis) =====
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
  const targetScale = baseScale * faceWidth * 2;
  smoothScale += (targetScale - smoothScale) * 0.4;

  // ===== PRODUCT TYPES =====
  if (productType === "glasses") {
    model.position.set(0, -0.02, 0.12);
    model.scale.setScalar(smoothScale * 1.15);

    occluder.scale.set(faceWidth * 1.1, faceWidth * 1.3, faceWidth);
  }

  if (productType === "cap") {
    model.position.set(0, 0.5 + faceWidth * 0.2, -faceWidth * 0.4);
    model.scale.setScalar(smoothScale * 2.0);

    occluder.scale.set(faceWidth * 1.3, faceWidth * 1.6, faceWidth);
  }

  if (productType === "wig") {
    model.position.set(0, 0.45 + faceWidth * 0.15, -faceWidth * 0.5);
    model.scale.setScalar(smoothScale * 2.5);

    occluder.scale.set(faceWidth * 1.4, faceWidth * 1.7, faceWidth);
  }
}

// CAMERA
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

// AI
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

// LOOP
async function detect() {
  if (!detector) {
    requestAnimationFrame(detect);
    return;
  }

  const faces = await detector.estimateFaces(video);

  if (faces.length > 0) {
    label.innerText = "✅ Tracking";
    update(faces[0].keypoints, video.videoWidth, video.videoHeight);
  } else {
    label.innerText = "❌ No face";
  }

  requestAnimationFrame(detect);
}

// INIT
async function init() {
  await startCamera();
  await initAI();
  detect();
}
init();

// RENDER LOOP
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// RESIZE
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
