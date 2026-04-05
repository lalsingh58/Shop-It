const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

/* ===== START CAMERA (HD + FRONT CAMERA) ===== */
navigator.mediaDevices
  .getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  })
  .then((stream) => {
    video.srcObject = stream;
  })
  .catch((err) => {
    alert("Camera access denied ❌");
    console.error(err);
  });

/* ===== RESIZE CANVAS ===== */
function resizeCanvas() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

video.addEventListener("loadedmetadata", resizeCanvas);
window.addEventListener("resize", resizeCanvas);

/* ===== SETUP FACEMESH ===== */
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});

/* ===== LOAD SELECTED PRODUCT ===== */
const productImg = new Image();
const selected = localStorage.getItem("selectedProduct");
const productType = localStorage.getItem("productType");

productImg.src = selected || "../assets/glasses/g1.png";

/* ===== SMOOTH MOVEMENT ===== */
let prevX = 0;
let prevY = 0;

/* ===== FACEMESH RESULTS ===== */
faceMesh.onResults((results) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiFaceLandmarks?.length) return;

  const landmarks = results.multiFaceLandmarks[0];

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];

  const x1 = leftEye.x * canvas.width;
  const y1 = leftEye.y * canvas.height;

  const x2 = rightEye.x * canvas.width;
  const y2 = rightEye.y * canvas.height;

  /* ===== DISTANCE ===== */
  const eyeDistance = Math.hypot(x2 - x1, y2 - y1);

  /* ===== DYNAMIC SETTINGS BASED ON PRODUCT ===== */
  let scale = 1.8;
  let heightRatio = 0.55;
  let yOffset = 2.0;

  if (productType === "cap") {
    scale = 2.5;
    heightRatio = 0.9;
    yOffset = 1.3;
  }

  if (productType === "earring") {
    scale = 0.9;
    heightRatio = 1.2;
    yOffset = 1.8;
  }

  /* ===== SIZE ===== */
  const width = eyeDistance * scale;
  const height = width * heightRatio;

  let centerX = (x1 + x2) / 2;
  let centerY = (y1 + y2) / 2;

  /* ===== SMOOTHING ===== */
  centerX = prevX * 0.6 + centerX * 0.4;
  centerY = prevY * 0.6 + centerY * 0.4;

  prevX = centerX;
  prevY = centerY;

  /* ===== ROTATION ===== */
  const angle = Math.atan2(y2 - y1, x2 - x1);

  if (!productImg.complete) return;

  /* ===== DRAW ===== */
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);

  ctx.drawImage(productImg, -width / 2, -height / yOffset, width, height);

  ctx.restore();
});

/* ===== CONNECT CAMERA ===== */
const camera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
});

camera.start();
