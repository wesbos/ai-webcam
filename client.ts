const videoEl = document.querySelector<HTMLVideoElement>('video');
const canvasEl = document.querySelector<HTMLCanvasElement>('canvas');
const buttons = document.querySelectorAll<HTMLButtonElement>('.voice button');

const serverBaseUrl = 'http://localhost:3000';

console.log(buttons);
async function populateWebcam() {
  if (!videoEl) return;
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  videoEl.srcObject = stream;
  videoEl.play();
}

function drawWebcam() {
  const ctx = canvasEl?.getContext('2d');
  if (!videoEl || !canvasEl || !ctx) return '';
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  console.log(canvasEl.width, canvasEl.height);
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  const data = canvasEl.toDataURL('image/jpeg');
  return data;
}

async function handleButtonClick(e: MouseEvent) {
  const voiceEl = (e.target as HTMLButtonElement).closest<HTMLDivElement>('.voice');
  const audioEl = voiceEl.querySelector<HTMLAudioElement>('audio');
  const img = voiceEl.querySelector<HTMLImageElement>('img.shot');
  if (!voiceEl || !img || !audioEl) return;
  voiceEl.classList.add('loading');
  const imageData = drawWebcam();

  img.src = imageData;
  const result = await fetch(`${serverBaseUrl}/audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageData,
      voice: voiceEl.dataset.voice,
    }),
  });

  audioEl.src = URL.createObjectURL(await result.blob());
  audioEl.playbackRate = 1.15;
  audioEl.play();
  voiceEl.classList.remove('loading');
  console.log(result);
}

buttons.forEach((button) => button.addEventListener('click', handleButtonClick));

populateWebcam();
