import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ================= DOM =================
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");
const faceLabel = document.getElementById("faceLabel");

// ================= PRODUCT =================
let selectedModel = localStorage.getItem("selectedModel");
let productType = localStorage.getItem("productType");

if (!selectedModel) {
  selectedModel = "../assets/models/glasses/g1.glb";
  productType = "glasses";
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

// ================= LIGHT =================
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 1, 2);
scene.add(dirLight);

// ================= FACE ANCHOR =================
let faceAnchor = new THREE.Group();
scene.add(faceAnchor);

// ================= MODEL =================
let model = null;
let loader = new GLTFLoader();

// ================= OCCLUSION MESH =================
let occluder = null;

function createOccluder() {
  const geometry = new THREE.SphereGeometry(0.6, 32, 32);

  const material = new THREE.MeshBasicMaterial({
    colorWrite: false, // invisible but blocks
  });

  occluder = new THREE.Mesh(geometry, material);
  faceAnchor.add(occluder);
}

// ================= LOAD MODEL =================
function loadModel(path) {
  loader.load(path, (gltf) => {
    if (model) faceAnchor.remove(model);

    model = gltf.scene;

    // normalize model
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    model.scale.setScalar(1 / size);

    faceAnchor.add(model);

    createOccluder();

    console.log("✅ Model loaded");
  });
}

// ================= POSITION =================
function getPos(p, w, h) {
  return new THREE.Vector3((p.x / w) * 2 - 1, 1 - (p.y / h) * 2, -p.z * 1.5);
}

// ================= SMOOTH =================
let smoothPos = new THREE.Vector3();
let smoothRot = new THREE.Euler();

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

  // ===== HEAD CENTER =====
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

  // ===== PRODUCT OFFSET =====
  if (productType === "glasses") {
    model.position.set(0, -0.03, 0.15);
    model.scale.setScalar(faceWidth * 1.8);

    // occlusion fit
    occluder.scale.set(1, 1.2, 1);
  } else if (productType === "cap") {
    model.position.set(0, 0.4, -0.3);
    model.scale.setScalar(faceWidth * 2.8);

    occluder.scale.set(1.2, 1.4, 1.2);
  } else if (productType === "wig") {
    model.position.set(0, 0.3, -0.4);
    model.scale.setScalar(faceWidth * 3.2);

    occluder.scale.set(1.3, 1.5, 1.3);
  } else if (productType === "earring") {
    handleEarrings(leftEar, rightEar, faceWidth);
  }
}

// ================= EARRINGS =================
let leftEarring = null;
let rightEarring = null;

function handleEarrings(leftEar, rightEar, faceWidth) {
  if (!leftEarring) {
    leftEarring = model;
    rightEarring = model.clone();

    scene.add(leftEarring);
    scene.add(rightEarring);
  }

  const scale = faceWidth * 0.8;

  leftEarring.scale.setScalar(scale);
  rightEarring.scale.setScalar(scale);

  leftEarring.position.lerp(leftEar, 0.6);
  rightEarring.position.lerp(rightEar, 0.6);
}

// ================= AI =================
let detector = null;

async function initAI() {
  await tf.setBackend("webgl");

  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    { runtime: "tfjs", maxFaces: 1 },
  );

  console.log("✅ AI Ready");
}

// ================= CAMERA =================
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
  });

  video.srcObject = stream;
  await video.play();

  faceLabel.innerText = "✅ Ready";
}

// ================= LOOP =================
async function detect() {
  const faces = await detector.estimateFaces(video);

  if (faces.length > 0) {
    const lm = faces[0].keypoints;
    updateModel(lm, video.videoWidth, video.videoHeight);
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
  renderer.render(scene, camera3D);
}
animate();
