import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ================= DOM =================
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");

// ================= PRODUCT =================
const selectedModel =
  localStorage.getItem("selectedModel") || "../assets/models/glasses/g1.glb";

const productType = localStorage.getItem("productType") || "glasses";

// ================= THREE =================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  70,
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

// ================= LIGHT =================
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 2);
scene.add(light);

// ================= FACE ANCHOR =================
const faceAnchor = new THREE.Group();
scene.add(faceAnchor);

// ================= MODEL =================
let model = null;
const loader = new GLTFLoader();

// ================= OCCLUDER =================
const occluder = new THREE.Mesh(
  new THREE.SphereGeometry(0.6, 32, 32),
  new THREE.MeshBasicMaterial({ colorWrite: false }),
);
faceAnchor.add(occluder);

// ================= LOAD MODEL =================
function loadModel(path) {
  loader.load(path, (gltf) => {
    if (model) faceAnchor.remove(model);

    model = gltf.scene;

    // normalize
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    model.scale.setScalar(1 / size);

    faceAnchor.add(model);
  });
}

// ================= POSITION =================
function getPos(p, w, h) {
  return new THREE.Vector3((p.x / w) * 2 - 1, 1 - (p.y / h) * 2, -p.z * 1.5);
}

// ================= SMOOTH =================
const smoothPos = new THREE.Vector3();
const smoothRot = new THREE.Euler();

// ================= UPDATE =================
function updateModel(lm, w, h) {
  if (!model) return;

  const leftEye = getPos(lm[33], w, h);
  const rightEye = getPos(lm[263], w, h);
  const nose = getPos(lm[1], w, h);
  const forehead = getPos(lm[10], w, h);
  const leftEar = getPos(lm[234], w, h);
  const rightEar = getPos(lm[454], w, h);

  const faceWidth = leftEar.distanceTo(rightEar);

  // ===== HEAD POSITION =====
  const center = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);

  center.z = nose.z - 0.5;

  smoothPos.lerp(center, 0.6);
  faceAnchor.position.copy(smoothPos);

  // ===== ROTATION =====
  const rotZ = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  const rotY = (rightEye.z - leftEye.z) * 3;
  const rotX = (nose.y - forehead.y) * 2;

  smoothRot.x += (rotX - smoothRot.x) * 0.5;
  smoothRot.y += (rotY - smoothRot.y) * 0.5;
  smoothRot.z += (rotZ - smoothRot.z) * 0.5;

  faceAnchor.rotation.copy(smoothRot);

  const baseScale = faceWidth;

  // ===== PRODUCT ALIGNMENT =====
  if (productType === "glasses") {
    model.position.set(0, -0.03, 0.15);
    model.scale.setScalar(baseScale * 1.8);
    occluder.scale.set(1, 1.2, 1);
  } else if (productType === "cap") {
    model.position.set(0, 0.45, -0.4);
    model.scale.setScalar(baseScale * 3.2);
    occluder.scale.set(1.3, 1.5, 1.3);
  } else if (productType === "wig") {
    model.position.set(0, 0.35, -0.5);
    model.scale.setScalar(baseScale * 3.5);
    occluder.scale.set(1.4, 1.6, 1.4);
  } else if (productType === "earring") {
    updateEarrings(leftEar, rightEar, baseScale);
  }
}

// ================= EARRINGS =================
let leftEarring = null;
let rightEarring = null;

function updateEarrings(leftEar, rightEar, scaleBase) {
  if (!leftEarring) {
    leftEarring = model;
    rightEarring = model.clone();

    scene.add(leftEarring);
    scene.add(rightEarring);
  }

  const scale = scaleBase * 0.8;

  leftEarring.scale.setScalar(scale);
  rightEarring.scale.setScalar(scale);

  leftEarring.position.lerp(leftEar, 0.6);
  rightEarring.position.lerp(rightEar, 0.6);
}

// ================= AI =================
let detector;

async function initAI() {
  await tf.setBackend("webgl");

  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    { runtime: "tfjs", maxFaces: 1 },
  );
}

// ================= CAMERA =================
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
  });

  video.srcObject = stream;
  await video.play();
}

// ================= LOOP =================
async function detect() {
  const faces = await detector.estimateFaces(video);

  if (faces.length > 0) {
    updateModel(faces[0].keypoints, video.videoWidth, video.videoHeight);
  }

  requestAnimationFrame(detect);
}

// ================= INIT =================
async function init() {
  await startCamera();
  await initAI();

  loadModel(selectedModel);
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
