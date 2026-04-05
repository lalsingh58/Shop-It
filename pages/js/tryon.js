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

// LIGHT
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 2);
scene.add(light);

// FACE ANCHOR
const faceAnchor = new THREE.Group();
scene.add(faceAnchor);

// MODEL
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

// SMOOTH
const smoothPos = new THREE.Vector3();
const smoothRot = new THREE.Euler();

// NORMALIZE
function norm(p, w, h) {
  return new THREE.Vector3(
    (p.x - w / 2) / (w / 2),
    -(p.y - h / 2) / (h / 2),
    -p.z * 0.8,
  );
}

// UPDATE
function update(lm, w, h) {
  if (!model || w === 0) return;

  const leftEye = norm(lm[33], w, h);
  const rightEye = norm(lm[263], w, h);
  const nose = norm(lm[1], w, h);
  const leftEar = norm(lm[234], w, h);
  const rightEar = norm(lm[454], w, h);

  const faceWidth = leftEar.distanceTo(rightEar);

  // POSITION
  const center = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);

  center.z = nose.z;

  smoothPos.lerp(center, 0.4);
  faceAnchor.position.copy(smoothPos);

  // ROTATION
  const rotZ = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const rotY = (rightEye.z - leftEye.z) * 2;

  smoothRot.y += (rotY - smoothRot.y) * 0.3;
  smoothRot.z += (rotZ - smoothRot.z) * 0.3;

  faceAnchor.rotation.copy(smoothRot);

  // SCALE
  const scale = baseScale * faceWidth * 2;

  // PRODUCT TYPES
  if (productType === "glasses") {
    model.position.set(0, -0.05, 0.15);
    model.scale.setScalar(scale * 1.2);
  }

  if (productType === "cap") {
    model.position.set(0, 0.35 + faceWidth * 0.2, -faceWidth * 0.5);
    model.scale.setScalar(scale * 2.2);
  }

  if (productType === "wig") {
    model.position.set(0, 0.4, -faceWidth * 0.6);
    model.scale.setScalar(scale * 2.8);
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
    { runtime: "tfjs", maxFaces: 1 },
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
    label.innerText = "✅ Face detected";
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

// RENDER
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
