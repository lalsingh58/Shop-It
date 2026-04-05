import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// --- DOM Elements ---
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");
const faceLabel = document.getElementById("faceLabel");

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = null; // transparent

const camera3D = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
);
camera3D.position.set(0, 0, 2);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(1, 2, 1);
scene.add(dirLight);
const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
backLight.position.set(0, 1, -1);
scene.add(backLight);

// --- Glasses Model ---
let currentModel = null;
let currentModelPath = null;
let currentFaceShape = null;
let baseScale = 1.0; // user adjustable
const loader = new GLTFLoader();

// Fallback: simple custom geometry (in case GLB files are missing)
function createFallbackGlasses(color = "#333333") {
  const group = new THREE.Group();

  // frames (two circles + bridge)
  const geometryLens = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.8,
    roughness: 0.2,
  });

  const leftLens = new THREE.Mesh(geometryLens, material);
  leftLens.position.set(-0.18, 0.02, 0);
  group.add(leftLens);

  const rightLens = new THREE.Mesh(geometryLens, material);
  rightLens.position.set(0.18, 0.02, 0);
  group.add(rightLens);

  const bridgeGeo = new THREE.BoxGeometry(0.12, 0.04, 0.03);
  const bridgeMat = new THREE.MeshStandardMaterial({ color: "#222" });
  const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 0.02, 0);
  group.add(bridge);

  // arms (simple)
  const armGeo = new THREE.BoxGeometry(0.05, 0.05, 0.2);
  const armMat = new THREE.MeshStandardMaterial({ color: "#222" });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.28, 0.01, -0.1);
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.28, 0.01, -0.1);
  group.add(rightArm);

  return group;
}

// Load 3D model (GLB) or fallback
function loadModel(path) {
  if (currentModelPath === path && currentModel) return;

  // Remove old model
  if (currentModel) {
    scene.remove(currentModel);
    if (currentModel.geometry) currentModel.geometry.dispose();
    if (currentModel.material) currentModel.material.dispose();
  }

  // Try loading GLB
  loader.load(
    path,
    (gltf) => {
      if (currentModel) scene.remove(currentModel);
      currentModel = gltf.scene;

      // Normalize model size
      const box = new THREE.Box3().setFromObject(currentModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      currentModel.position.sub(center);
      const desiredSize = 0.35; // approx face width
      const scaleFactor = desiredSize / size;
      currentModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
      baseScale = 1.0;

      scene.add(currentModel);
      currentModelPath = path;
    },
    undefined,
    (error) => {
      console.warn(`Failed to load ${path}, using fallback glasses.`, error);
      if (currentModel) scene.remove(currentModel);
      currentModel = createFallbackGlasses();
      scene.add(currentModel);
      currentModelPath = path;
    },
  );
}

// --- Helper: convert MediaPipe landmark (pixel coords) to normalized 3D position (-1..1 range, z in meters) ---
function getNormalizedPos(lm, width, height) {
  // x: from 0..width to -1..1
  const x = (lm.x / width) * 2 - 1;
  // y: invert because Y goes down in image coords
  const y = 1 - (lm.y / height) * 2;
  // z: MediaPipe gives approximate depth, scale to Three.js units
  const z = -lm.z * 1.5;
  return new THREE.Vector3(x, y, z);
}

// --- Face shape detection using landmark indices (MediaPipe 468 points) ---
function detectFaceShape(landmarks, width, height) {
  // Indices: left cheek (234), right cheek (454), chin (152), forehead (10)
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const chin = landmarks[152];
  const forehead = landmarks[10];

  if (!leftCheek || !rightCheek || !chin || !forehead) return "Oval";

  const leftPos = getNormalizedPos(leftCheek, width, height);
  const rightPos = getNormalizedPos(rightCheek, width, height);
  const chinPos = getNormalizedPos(chin, width, height);
  const foreheadPos = getNormalizedPos(forehead, width, height);

  const faceWidth = leftPos.distanceTo(rightPos);
  const faceHeight = foreheadPos.distanceTo(chinPos);
  const ratio = faceHeight / faceWidth;

  if (ratio > 1.45) return "Oval";
  if (ratio < 1.2) return "Round";
  if (Math.abs(faceWidth - faceHeight) < 0.12) return "Square";
  return "Heart";
}

// --- Map face shape to glasses model path ---
function getModelPathByShape(shape) {
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

// --- Update glasses position, rotation, scale based on face landmarks ---
function updateGlasses(landmarks, width, height) {
  if (!currentModel) return;

  // Get key points: eyes (33 left, 263 right), nose tip (1)
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const noseTip = landmarks[1];

  if (!leftEye || !rightEye || !noseTip) return;

  const leftEyePos = getNormalizedPos(leftEye, width, height);
  const rightEyePos = getNormalizedPos(rightEye, width, height);
  const nosePos = getNormalizedPos(noseTip, width, height);

  // Center between eyes
  const centerEye = new THREE.Vector3()
    .addVectors(leftEyePos, rightEyePos)
    .multiplyScalar(0.5);
  centerEye.z = nosePos.z - 0.05; // push slightly forward

  // Smooth movement
  currentModel.position.lerp(centerEye, 0.4);

  // Rotation based on eye line angle
  const dx = rightEyePos.x - leftEyePos.x;
  const dy = rightEyePos.y - leftEyePos.y;
  const angleZ = Math.atan2(dy, dx);
  currentModel.rotation.set(0, 0, angleZ);

  // Scale based on inter-eye distance + user control
  const eyeDistance = leftEyePos.distanceTo(rightEyePos);
  let scaleVal = eyeDistance * 1.8 * baseScale;
  scaleVal = Math.min(0.9, Math.max(0.3, scaleVal));
  currentModel.scale.set(scaleVal, scaleVal, scaleVal);
}

// --- AI Detector ---
let detector = null;

async function initFaceDetector() {
  // Use MediaPipeFaceMesh with TFJS backend
  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    { runtime: "tfjs", maxFaces: 1 },
  );
  console.log("Face detector ready");
}

// --- Camera Setup ---
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
  } catch (err) {
    console.error("Camera error:", err);
    faceLabel.innerText = "❌ Camera access denied";
  }
}

// --- Main Detection Loop ---
let lastShape = null;
let lastLoadTime = 0;

async function detectLoop() {
  if (!detector || !video.videoWidth) {
    requestAnimationFrame(detectLoop);
    return;
  }

  try {
    const faces = await detector.estimateFaces(video);
    if (faces.length > 0) {
      const face = faces[0];
      const landmarks = face.keypoints; // array of 468 {x,y,z}
      const width = video.videoWidth;
      const height = video.videoHeight;

      // 1. Determine face shape (only every 30 frames to avoid reload spam)
      const shape = detectFaceShape(landmarks, width, height);
      faceLabel.innerText = `👓 AI Face: ${shape}`;

      // 2. Load new model if shape changed (throttled)
      if (shape !== lastShape) {
        lastShape = shape;
        const modelPath = getModelPathByShape(shape);
        loadModel(modelPath);
      }

      // 3. Update glasses position/rotation/scale
      updateGlasses(landmarks, width, height);
    } else {
      faceLabel.innerText = "😶 No face detected";
    }
  } catch (err) {
    console.warn("Detection error:", err);
  }

  requestAnimationFrame(detectLoop);
}

// --- User Controls: change glasses size (+ / -) ---
function setupControls() {
  const minusBtn = document.getElementById("btnMinus");
  const plusBtn = document.getElementById("btnPlus");

  minusBtn.addEventListener("click", () => {
    baseScale = Math.max(0.5, baseScale - 0.05);
    updateScaleFromUser();
  });
  plusBtn.addEventListener("click", () => {
    baseScale = Math.min(1.8, baseScale + 0.05);
    updateScaleFromUser();
  });
}

function updateScaleFromUser() {
  if (!currentModel) return;
  // Scale will be applied in next updateGlasses call (which uses baseScale)
  // For immediate feedback, we can adjust current scale slightly but better to let the loop handle.
  // Just show a temporary label.
  faceLabel.innerText = faceLabel.innerText.replace(
    /👓.*/,
    `👓 Scale: ${baseScale.toFixed(2)}`,
  );
  setTimeout(() => {
    if (lastShape) faceLabel.innerText = `👓 AI Face: ${lastShape}`;
  }, 800);
}

// --- Animation Loop (Three.js render) ---
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}

// --- Resize handler ---
window.addEventListener("resize", onWindowResize, false);
function onWindowResize() {
  camera3D.aspect = window.innerWidth / window.innerHeight;
  camera3D.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Initialization ---
async function init() {
  await startCamera();
  await initFaceDetector();
  setupControls();
  animate();
  detectLoop();
}

init();
