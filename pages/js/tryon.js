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
let currentModel = "";
let loader = new GLTFLoader();
let baseScale = 1;

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
function getPos(lm, w, h) {
  return new THREE.Vector3((lm.x / w) * 2 - 1, 1 - (lm.y / h) * 2, -lm.z * 1.2);
}

// AI FEATURES
function getFeatures(lm, w, h) {
  const left = getPos(lm[234], w, h);
  const right = getPos(lm[454], w, h);
  const chin = getPos(lm[152], w, h);
  const forehead = getPos(lm[10], w, h);

  return {
    ratio: forehead.distanceTo(chin) / left.distanceTo(right),
    width: left.distanceTo(right),
    height: forehead.distanceTo(chin),
  };
}

function classify(f) {
  if (f.ratio > 1.5) return "Oval";
  if (f.ratio < 1.2) return "Round";
  if (Math.abs(f.width - f.height) < 0.08) return "Square";
  return "Heart";
}

function getModel(shape) {
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

// SMOOTH
let smoothPos = new THREE.Vector3();
let smoothRot = 0;

function update(lm, w, h) {
  if (!model) return;

  const leftEye = getPos(lm[33], w, h);
  const rightEye = getPos(lm[263], w, h);
  const nose = getPos(lm[1], w, h);

  const center = new THREE.Vector3()
    .addVectors(leftEye, rightEye)
    .multiplyScalar(0.5);
  center.z = nose.z - 0.08;

  smoothPos.lerp(center, 0.25);
  model.position.copy(smoothPos);

  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  smoothRot += (angle - smoothRot) * 0.25;
  model.rotation.set(0, 0, smoothRot);

  const faceWidth = getPos(lm[234], w, h).distanceTo(getPos(lm[454], w, h));
  const scale = faceWidth * 1.3 * baseScale;

  model.scale.set(scale, scale, scale);
}

// AI
let detector;

async function initAI() {
  await tf.setBackend("webgl");
  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    { runtime: "tfjs" },
  );
}

// CAMERA
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();
}

// LOOP
async function detect() {
  if (!video.videoWidth) {
    requestAnimationFrame(detect);
    return;
  }

  const faces = await detector.estimateFaces(video);

  if (faces.length > 0) {
    const lm = faces[0].keypoints;
    const w = video.videoWidth;
    const h = video.videoHeight;

    const shape = classify(getFeatures(lm, w, h));
    faceLabel.innerText = "👓 " + shape;

    loadModel(getModel(shape));
    update(lm, w, h);
  }

  requestAnimationFrame(detect);
}

// CONTROLS
document.getElementById("minusBtn").onclick = () => (baseScale -= 0.1);
document.getElementById("plusBtn").onclick = () => (baseScale += 0.1);

window.goBack = () => history.back();

// START
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
