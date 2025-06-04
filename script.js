const videoElement = document.getElementById("input-video");
const canvasElement = document.getElementById("output-canvas");
const canvasCtx = canvasElement.getContext("2d");

const options = {
    powerButton: document.getElementById("power-button"),
    background: document.getElementById("background-options"),
    mask: document.getElementById("filter-options"),
};

const filters = {
    none: null,
    batman: new Image(),
    terrorist: new Image(),
};

// Initialize filters
filters.batman.src = "masks/batman.png";
filters.terrorist.src = "masks/terrorist.png";

let camera = null;
let backgroundMode = "original"; // "original" || "removebg"
let currentFilter = "none";

let latestSegmentationResult = null;
let latestFaceMeshResult = null;

// Face mesh landmarks
const FACE_LANDMARKS = {
    jaw: [152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234],
    leftEyebrow: [70, 63, 105, 66, 107],
    rightEyebrow: [336, 296, 334, 293, 300],
    nose: [168, 6, 197, 195, 5, 4],
    leftEye: [33, 160, 158, 133, 153, 144],
    rightEye: [263, 387, 385, 362, 380, 373],
    lipsOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
    lipsInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
};

// Initialize the SelfieSegmentation model
const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
});

selfieSegmentation.setOptions({
    modelSelection: 1,
});

// Initialize the FaceMesh model
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});

const render = () => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (latestSegmentationResult) {
        if (backgroundMode === "original") {
            canvasCtx.drawImage(latestSegmentationResult.image, 0, 0, canvasElement.width, canvasElement.height);
        } else {
            canvasCtx.drawImage(latestSegmentationResult.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);

            canvasCtx.globalCompositeOperation = "source-in";
            canvasCtx.drawImage(latestSegmentationResult.image, 0, 0, canvasElement.width, canvasElement.height);

            // Jika ingin menggunakan background custom
            // canvasCtx.globalCompositeOperation = "destination-over";
            // let backgroundImg = new Image();
            // backgroundImg.src = "https://images.unsplash.com/photo-1506744038136-46273834b3fb";
            // if (backgroundImg.complete) {
            //     canvasCtx.drawImage(backgroundImg, 0, 0, canvasElement.width, canvasElement.height);
            // } else {
            //     canvasCtx.fillStyle = "#333";
            //     canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
            // }
        }
    }

    if (latestFaceMeshResult && latestFaceMeshResult.multiFaceLandmarks?.length > 0) {
        const landmarks = latestFaceMeshResult.multiFaceLandmarks[0];
        if (currentFilter !== "none") {
            const filterImg = filters[currentFilter];
            if (filterImg.complete) {
                const chin = landmarks[152];
                const forehead = landmarks[10];
                const leftCheek = landmarks[234];
                const rightCheek = landmarks[454];

                // Hitung sudut rotasi wajah berdasarkan pipi
                const dx = (rightCheek.x - leftCheek.x) * canvasElement.width;
                const dy = (rightCheek.y - leftCheek.y) * canvasElement.height;
                const angle = Math.atan2(dy, dx);

                // Hitung center dari wajah
                const centerX = ((leftCheek.x + rightCheek.x) / 2) * canvasElement.width;
                const centerY = ((forehead.y + chin.y) / 2) * canvasElement.height;

                // Hitung skala topeng berdasarkan tinggi dan lebar wajah
                const faceWidth = Math.hypot(dx, dy) * 1.6;
                const faceHeight = (chin.y - forehead.y) * canvasElement.height * 1.8;

                canvasCtx.save();
                canvasCtx.translate(centerX, centerY);
                canvasCtx.rotate(angle);
                canvasCtx.drawImage(filterImg, -faceWidth / 2, -faceHeight / 2, faceWidth, faceHeight);
                canvasCtx.restore();
            } else {
                // Gambar landmarks jika filter belum siap
                for (const point of landmarks) {
                    const x = point.x * canvasElement.width;
                    const y = point.y * canvasElement.height;
                    canvasCtx.beginPath();
                    canvasCtx.arc(x, y, 1.5, 0, 2 * Math.PI);
                    canvasCtx.fillStyle = "red";
                    canvasCtx.fill();
                }
            }
        }
    }

    canvasCtx.restore();
};

selfieSegmentation.onResults((results) => {
    latestSegmentationResult = results;
    render();
});

faceMesh.onResults((results) => {
    latestFaceMeshResult = results;
    render();
});

options.powerButton.addEventListener("click", async () => {
    if (!camera) {
        camera = new Camera(videoElement, {
            onFrame: async () => {
                const image = videoElement;
                await selfieSegmentation.send({ image });
                await faceMesh.send({ image });
            },
            width: 640,
            height: 480,
        });

        camera.start();

        options.powerButton.textContent = "Stop Camera";

        canvasElement.style.display = "block";
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    } else {
        camera.stop();
        camera = null;
        options.powerButton.textContent = "Start Camera";
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasElement.style.display = "none";
    }
});

options.background.addEventListener("change", () => {
    backgroundMode = options.background.value;
});

options.mask.addEventListener("change", () => {
    currentFilter = options.mask.value;
});
