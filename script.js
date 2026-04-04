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

// Load glasses image
const glasses = new Image();
glasses.src = "./glasses/image1.png";

faceMesh.onResults((results) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    // Get eye points
    const leftEye = landmarks[33]; // left eye
    const rightEye = landmarks[263]; // right eye

    // Convert to canvas coordinates
    const x1 = leftEye.x * canvas.width;
    const y1 = leftEye.y * canvas.height;

    const x2 = rightEye.x * canvas.width;
    const y2 = rightEye.y * canvas.height;

    // Calculate width of glasses
    const glassesWidth = Math.abs(x2 - x1) * 2;

    // Position
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    const glassesHeight = glassesWidth * 0.5;

    // Draw glasses
    ctx.drawImage(
      glasses,
      centerX - glassesWidth / 2,
      centerY - glassesHeight / 2,
      glassesWidth,
      glassesHeight,
    );
  }
});

// Connect camera to FaceMesh
const camera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480,
});

camera.start();
