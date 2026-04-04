const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Start Camera
navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;
});

// Setup FaceMesh
const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  },
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

// Load glasses image from localStorage
const glasses = new Image();
glasses.src = localStorage.getItem("selectedProduct");

// Optional fallback (if nothing selected)
if (!glasses.src) {
  glasses.src = "assets/glasses/g1.png";
}

// Smooth movement variables
let prevX = 0;
let prevY = 0;

// Face detection result
faceMesh.onResults((results) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    const x1 = leftEye.x * canvas.width;
    const y1 = leftEye.y * canvas.height;

    const x2 = rightEye.x * canvas.width;
    const y2 = rightEye.y * canvas.height;

    // 🎯 Distance between eyes
    const eyeDistance = Math.abs(x2 - x1);

    // 🎯 PERFECT SETTINGS (tuned)
    const scale = 1.1;
    const heightRatio = 0.35;
    const yOffset = 2.6;

    const glassesWidth = eyeDistance * scale;
    const glassesHeight = glassesWidth * heightRatio;

    let centerX = (x1 + x2) / 2;
    let centerY = (y1 + y2) / 2;

    // 🎯 Smooth movement (reduces shaking)
    centerX = prevX * 0.7 + centerX * 0.3;
    centerY = prevY * 0.7 + centerY * 0.3;

    prevX = centerX;
    prevY = centerY;

    // 🎯 Rotation (head tilt support)
    const angle = Math.atan2(y2 - y1, x2 - x1);

    if (!glasses.complete) return;

    // 🔥 Draw with rotation
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
  }
});

// Connect camera
const camera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480,
});

camera.start();
