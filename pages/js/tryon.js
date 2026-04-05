import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ================= DOM =================
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");

// Mirror fix
video.style.transform = "scaleX(-1)";
canvas.style.transform = "scaleX(-1)";

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

// ================= LIGHT =================
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 1, 2);
scene.add(dirLight);

// ================= FACE ANCHOR =================
const faceAnchor = new THREE.Group();
scene.add(faceAnchor);

// ================= MODEL =================
let model = null;
let baseScale = 1;

const loader = new GLTFLoader();

function loadModel(path) {
  loader.load(path, (gltf) => {
    if (model) faceAnchor.remove(model);

    model = gltf.scene;

    // Normalize model size
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();

    baseScale = 1 / size;
    model.scale.setScalar(baseScale);

    faceAnchor.add(model);
  });
}

// ================= OCCLUDER =================
const occluder = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 32),
  new THREE.MeshBasicMaterial({ colorWrite: false }),
);
faceAnchor.add(occluder);

// ================= UTILS =================
function getNormalized(p, w, h) {
  return new THREE.Vector3(
    (p.x - w / 2) / (w / 2),
    -(p.y - h / 2) / (h / 2),
    -p.z * 1.5,
  );
}

// ================= SMOOTH =================
const smoothPos = new THREE.Vector3();
const smoothRot = new THREE.Euler();

// ================= UPDATE =================
function updateModel(lm, w, h) {
  if (!model) return;

  const leftEye = getNormalized(lm[33], w, h);
  const rightEye = getNormalized(lm[263], w, h);
  const nose = getNormalized(lm[1], w, h);
  const forehead = getNormalized(lm[10], w, h);
  const leftEar = getNormalized(lm[234], w, h);
  const rightEar = getNormalized(lm[454], w, h);

  const faceWidth = leftEar.distanceTo(rightEar);

  // ===== POSITION =====
  const center = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);

  center.z = nose.z * 1.5;

  smoothPos.lerp(center, 0.5);
  faceAnchor.position.copy(smoothPos);

  // ===== ROTATION =====
  const rotZ = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  const rotY = (rightEye.z - leftEye.z) * 2;
  const rotX = (nose.y - forehead.y) * 2;

  smoothRot.x += (rotX - smoothRot.x) * 0.4;
  smoothRot.y += (rotY - smoothRot.y) * 0.4;
  smoothRot.z += (rotZ - smoothRot.z) * 0.4;

  faceAnchor.rotation.copy(smoothRot);

  // ===== SCALE =====
  const finalScale = baseScale * faceWidth * 2;

  // ===== PRODUCT TYPES =====
  if (productType === "glasses") {
    model.position.set(0, -0.03, 0.15);
    model.scale.setScalar(finalScale * 1.2);
    occluder.scale.set(faceWidth * 1.2, faceWidth * 1.4, faceWidth);
  } else if (productType === "cap") {
    model.position.set(0, 0.5, -0.4);
    model.scale.setScalar(finalScale * 2.5);
    occluder.scale.set(faceWidth * 1.3, faceWidth * 1.6, faceWidth);
  } else if (productType === "wig") {
    model.position.set(0, 0.4, -0.5);
    model.scale.setScalar(finalScale * 3);
    occluder.scale.set(faceWidth * 1.4, faceWidth * 1.7, faceWidth);
  }
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
