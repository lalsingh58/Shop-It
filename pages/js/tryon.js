import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ----- DOM -----
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");

// ----- Scene -----
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

// ----- Light -----
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// ----- Model -----
let model;
let loader = new GLTFLoader();
let currentModelPath = null;

// ----- Face Label UI -----
let faceLabel = document.createElement("div");
faceLabel.style.position = "fixed";
faceLabel.style.top = "20px";
faceLabel.style.left = "50%";
faceLabel.style.transform = "translateX(-50%)";
faceLabel.style.background = "rgba(0,0,0,0.7)";
faceLabel.style.color = "white";
faceLabel.style.padding = "10px 16px";
faceLabel.style.borderRadius = "20px";
faceLabel.style.zIndex = "999";
document.body.appendChild(faceLabel);

// ----- Load Model -----
function loadModel(path) {
  if (currentModelPath === path) return;

  if (model) scene.remove(model);

  loader.load(path, (gltf) => {
    model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();

    model.position.sub(center);
    model.scale.setScalar(1 / size);

    scene.add(model);
  });

  currentModelPath = path;
}

// ----- Convert -----
function getPos(lm) {
  return new THREE.Vector3((lm.x - 0.5) * 2, -(lm.y - 0.5) * 2, -lm.z * 1.2);
}

// ----- AI Face Shape -----
function detectFaceShapeAI(prediction) {
  const keypoints = prediction.keypoints;

  const get = (name) => {
    const p = keypoints.find((k) => k.name === name);
    return new THREE.Vector3(p.x, p.y, p.z || 0);
  };

  const left = get("leftCheek");
  const right = get("rightCheek");
  const chin = get("chin");
  const forehead = get("forehead");

  const width = left.distanceTo(right);
  const height = forehead.distanceTo(chin);

  const ratio = height / width;

  if (ratio > 1.5) return "Oval";
  if (ratio < 1.2) return "Round";
  if (Math.abs(width - height) < 20) return "Square";

  return "Heart";
}

// ----- Recommendation -----
function getModelByFace(shape) {
  switch (shape) {
    case "Round":
      return "/assets/models/rect.glb";
    case "Square":
      return "/assets/models/round.glb";
    case "Oval":
      return "/assets/models/aviator.glb";
    case "Heart":
      return "/assets/models/light.glb";
    default:
      return "/assets/models/glasses.glb";
  }
}

// ----- Update Model -----
function updateModel(landmarks) {
  if (!model) return;

  const leftEye = getPos(landmarks[33]);
  const rightEye = getPos(landmarks[263]);
  const nose = getPos(landmarks[168]);

  const center = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);
  center.z = nose.z - 0.1;

  model.position.lerp(center, 0.3);

  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const angle = Math.atan2(dy, dx);

  model.rotation.set(0, 0, angle);

  const leftEar = getPos(landmarks[234]);
  const rightEar = getPos(landmarks[454]);

  const width = leftEar.distanceTo(rightEar);
  const scale = width * 1.4;

  model.scale.set(scale, scale, scale);
}

// ----- AI Setup -----
let detector;

async function initAI() {
  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    { runtime: "tfjs" },
  );
}

// ----- Camera -----
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  video.onloadedmetadata = () => video.play();
}

// ----- Main Loop -----
async function detect() {
  const predictions = await detector.estimateFaces(video);

  if (predictions.length > 0) {
    const pred = predictions[0];

    const shape = detectFaceShapeAI(pred);
    faceLabel.innerText = `AI Face: ${shape}`;

    const modelPath = getModelByFace(shape);
    loadModel(modelPath);

    updateModel(pred.scaledMesh);
  }

  requestAnimationFrame(detect);
}

// ----- Start -----
async function init() {
  await startCamera();
  await initAI();
  detect();
}
init();

// ----- Render -----
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}
animate();
