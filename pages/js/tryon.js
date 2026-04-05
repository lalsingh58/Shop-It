const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

/* ===== START CAMERA ===== */
navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((stream) => {
    video.srcObject = stream;
  })
  .catch((err) => {
    alert("Camera access denied ❌");
    console.error(err);
  });

/* ===== RESIZE CANVAS (IMPORTANT FIX) ===== */
function resizeCanvas() {
  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
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

/* ===== LOAD PRODUCT IMAGE ===== */
const glasses = new Image();
const selected = localStorage.getItem("selectedProduct");

glasses.src = selected || "../assets/glasses/g1.png";

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

  /* ===== CALCULATIONS ===== */
  const eyeDistance = Math.abs(x2 - x1);

  const scale = 1.1;
  const heightRatio = 0.35;
  const yOffset = 2.6;

  const glassesWidth = eyeDistance * scale;
  const glassesHeight = glassesWidth * heightRatio;

  let centerX = (x1 + x2) / 2;
  let centerY = (y1 + y2) / 2;

  /* ===== SMOOTHING ===== */
  centerX = prevX * 0.7 + centerX * 0.3;
  centerY = prevY * 0.7 + centerY * 0.3;

  prevX = centerX;
  prevY = centerY;

  /* ===== ROTATION ===== */
  const angle = Math.atan2(y2 - y1, x2 - x1);

  if (!glasses.complete) return;

  /* ===== DRAW ===== */
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);

  ctx.drawImage(
    glasses,
    -glassesWidth / 2,
    -glassesHeight / yOffset,
    glassesWidth,
    glassesHeight,
  );

  ctx.restore();
});

/* ===== CONNECT CAMERA TO FACEMESH ===== */
const camera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480,
});

camera.start();
