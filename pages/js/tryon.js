import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// --- DOM Elements ---
const video = document.getElementById("video");
const canvas = document.getElementById("threeCanvas");
const faceLabel = document.getElementById("faceLabel");
const cameraOverlay = document.getElementById("cameraOverlay");
const startCameraBtn = document.getElementById("startCameraBtn");
const cameraErrorMsg = document.getElementById("cameraErrorMsg");

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = null;

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
let baseScale = 1.0;
const loader = new GLTFLoader();

function createFallbackGlasses(color = "#333333") {
  const group = new THREE.Group();
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

function loadModel(path) {
  if (currentModelPath === path && currentModel) return;
  if (currentModel) {
    scene.remove(currentModel);
    if (currentModel.geometry) currentModel.geometry.dispose();
    if (currentModel.material) currentModel.material.dispose();
  }

  loader.load(
    path,
    (gltf) => {
      if (currentModel) scene.remove(currentModel);
      currentModel = gltf.scene;
      const box = new THREE.Box3().setFromObject(currentModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      currentModel.position.sub(center);
      const desiredSize = 0.35;
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

function getNormalizedPos(lm, width, height) {
  const x = (lm.x / width) * 2 - 1;
  const y = 1 - (lm.y / height) * 2;
  const z = -lm.z * 1.5;
  return new THREE.Vector3(x, y, z);
}

function detectFaceShape(landmarks, width, height) {
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

function updateGlasses(landmarks, width, height) {
  if (!currentModel) return;
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const noseTip = landmarks[1];
  if (!leftEye || !rightEye || !noseTip) return;

  const leftEyePos = getNormalizedPos(leftEye, width, height);
  const rightEyePos = getNormalizedPos(rightEye, width, height);
  const nosePos = getNormalizedPos(noseTip, width, height);

  const centerEye = new THREE.Vector3()
    .addVectors(leftEyePos, rightEyePos)
    .multiplyScalar(0.5);
  centerEye.z = nosePos.z - 0.05;
  currentModel.position.lerp(centerEye, 0.4);

  const dx = rightEyePos.x - leftEyePos.x;
  const dy = rightEyePos.y - leftEyePos.y;
  const angleZ = Math.atan2(dy, dx);
  currentModel.rotation.set(0, 0, angleZ);

  const eyeDistance = leftEyePos.distanceTo(rightEyePos);
  let scaleVal = eyeDistance * 1.8 * baseScale;
  scaleVal = Math.min(0.9, Math.max(0.3, scaleVal));
  currentModel.scale.set(scaleVal, scaleVal, scaleVal);
}

// --- AI Detector ---
let detector = null;

async function initFaceDetector() {
  detector = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    { runtime: "tfjs", maxFaces: 1 },
  );
  console.log("Face detector ready");
}

// --- Camera startup with error handling ---
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
    cameraOverlay.style.display = "none";
    faceLabel.innerText = "🔍 Detecting face...";
    return true;
  } catch (err) {
    console.error("Camera error:", err);
    let errorMsg = "Could not access camera. ";
    if (err.name === "NotAllowedError") errorMsg += "Permission denied.";
    else if (err.name === "NotFoundError") errorMsg += "No camera found.";
    else if (err.name === "NotReadableError")
      errorMsg += "Camera already in use.";
    else errorMsg += "Please check camera permissions.";
    cameraErrorMsg.innerText = errorMsg;
    cameraOverlay.style.display = "flex";
    return false;
  }
}

// --- Manual start via button ---
startCameraBtn.addEventListener("click", async () => {
  cameraErrorMsg.innerText = "";
  const success = await startCamera();
  if (success && detector) {
    // Detection loop already running, just need video feed
    faceLabel.innerText = "🔍 Detecting face...";
  }
});

// --- Detection Loop ---
let lastShape = null;

async function detectLoop() {
  if (!detector || !video.videoWidth || video.readyState !== 4) {
    requestAnimationFrame(detectLoop);
    return;
  }

  try {
    const faces = await detector.estimateFaces(video);
    if (faces.length > 0) {
      const face = faces[0];
      const landmarks = face.keypoints;
      const width = video.videoWidth;
      const height = video.videoHeight;

      const shape = detectFaceShape(landmarks, width, height);
      faceLabel.innerText = `👓 AI Face: ${shape}`;

      if (shape !== lastShape) {
        lastShape = shape;
        const modelPath = getModelPathByShape(shape);
        loadModel(modelPath);
      }

      updateGlasses(landmarks, width, height);
    } else {
      faceLabel.innerText = "😶 No face detected";
    }
  } catch (err) {
    console.warn("Detection error:", err);
  }

  requestAnimationFrame(detectLoop);
}

// --- User Controls ---
function setupControls() {
  const minusBtn = document.getElementById("btnMinus");
  const plusBtn = document.getElementById("btnPlus");

  minusBtn.addEventListener("click", () => {
    baseScale = Math.max(0.5, baseScale - 0.05);
    showTempScale();
  });
  plusBtn.addEventListener("click", () => {
    baseScale = Math.min(1.8, baseScale + 0.05);
    showTempScale();
  });
}

function showTempScale() {
  if (!lastShape) return;
  faceLabel.innerText = `🔧 Scale: ${baseScale.toFixed(2)}`;
  setTimeout(() => {
    if (lastShape) faceLabel.innerText = `👓 AI Face: ${lastShape}`;
    else faceLabel.innerText = "🔍 Detecting face...";
  }, 800);
}

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}

window.addEventListener("resize", () => {
  camera3D.aspect = window.innerWidth / window.innerHeight;
  camera3D.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Initialization ---
async function init() {
  setupControls();
  animate();
  await initFaceDetector();

  // Try to auto-start camera, show overlay if fails
  const autoStarted = await startCamera();
  if (!autoStarted) {
    // Overlay already shown by startCamera error handling
    faceLabel.innerText = "📷 Click 'Enable Camera'";
  }

  detectLoop(); // detection will wait for video ready
}

init();
