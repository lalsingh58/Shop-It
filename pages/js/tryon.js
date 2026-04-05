import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// DOM
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");
const faceLabel = document.getElementById("faceLabel");

// THREE
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

scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// MODEL
let model;
let loader = new GLTFLoader();
let currentModel = "";
let baseScale = 1;

// MODELS
const MODELS = {
  Round: "/assets/models/rect.glb",
  Square: "/assets/models/round.glb",
  Oval: "/assets/models/aviator.glb",
  Heart: "/assets/models/light.glb",
  Default: "/assets/models/glasses.glb",
};

// LOAD MODEL
function loadModel(path) {
  if (currentModel === path) return;

  if (model) scene.remove(model);

  loader.load(path, (gltf) => {
    model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();

    model.position.sub(center);
    model.scale.setScalar(1 / size);

    scene.add(model);
    currentModel = path;
  });
}

// POSITION
function getPos(p, w, h) {
  return new THREE.Vector3((p.x / w) * 2 - 1, 1 - (p.y / h) * 2, -p.z * 1.2);
}

// FACE SHAPE
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

// SMOOTH
let smoothPos = new THREE.Vector3();
let smoothRot = 0;

// UPDATE MODEL
function update(lm, w, h) {
  if (!model) return;

  const leftEye = getPos(lm[33], w, h);
  const rightEye = getPos(lm[263], w, h);
  const nose = getPos(lm[1], w, h);

  const center = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);
  center.z = nose.z - 0.08;

  smoothPos.lerp(center, 0.3);
  model.position.copy(smoothPos);

  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  smoothRot += (angle - smoothRot) * 0.3;
  model.rotation.set(0, 0, smoothRot);

  const faceWidth = getPos(lm[234], w, h).distanceTo(getPos(lm[454], w, h));
  const scale = faceWidth * 1.4 * baseScale;

  model.scale.set(scale, scale, scale);
}

// AI
let detector;

async function initAI() {
  if (tf.getBackend() !== "webgl") {
    await tf.setBackend("webgl");
  }

  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    { runtime: "tfjs", maxFaces: 1 },
  );
}

// CAMERA (FIXED 🔥)
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    faceLabel.innerText = "✅ Camera ready";
  } catch (err) {
    console.error(err);
    faceLabel.innerText = "❌ Camera blocked!";
  }
}

// LOOP (FIXED 🔥)
async function detect() {
  if (!detector || video.readyState !== 4) {
    requestAnimationFrame(detect);
    return;
  }

  const faces = await detector.estimateFaces(video);

  if (faces.length > 0) {
    const lm = faces[0].keypoints; // ✅ CORRECT FORMAT
    const w = video.videoWidth;
    const h = video.videoHeight;

    const shape = classify(lm, w, h);
    faceLabel.innerText = "👓 " + shape;

    loadModel(MODELS[shape] || MODELS.Default);
    update(lm, w, h);
  } else {
    faceLabel.innerText = "😶 Show your face";
  }

  requestAnimationFrame(detect);
}

// CONTROLS
document.getElementById("minusBtn").onclick = () => (baseScale -= 0.1);
document.getElementById("plusBtn").onclick = () => (baseScale += 0.1);

window.goBack = () => history.back();

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
  renderer.render(scene, camera3D);
}
animate();
