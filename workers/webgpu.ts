// adapt import to the targeted JS runtime

import { ThreadWorker } from 'jsr:@poolifier/poolifier-web-worker';

import * as tf from 'npm:@tensorflow/tfjs';
import * as cocoSsd from 'npm:@tensorflow-models/coco-ssd';
import 'npm:@tensorflow/tfjs-backend-webgpu';

import { load as loadWebCodecsPolyfill } from 'npm:libavjs-webcodecs-polyfill';
import { createCanvas, loadImage } from 'jsr:@gfx/canvas-wasm';

const { resolve, promise } = Promise.withResolvers<[cocoSsd.ObjectDetection]>();
(async () => {
  // Step 1: Set the backend to WebAssembly
  await tf?.setBackend?.('webgpu');
  await tf?.ready?.();

  // Step 2: Load the object detection model
  console.log('Loading the object detection model...');
  const model = await cocoSsd.load();
  console.log('Model loaded.');

  // Step 3: Load the WebCodecs polyfill
  await loadWebCodecsPolyfill();

  // Create a Skia Canvas
  resolve([model]);
})();

async function extractFrames(data?: { imagePath: string, outputPath: string }) {
  const [model] = await promise;

  const { imagePath, outputPath } = data ?? {};
  if (!imagePath || !outputPath) {
    return { ok: 0, error: 'imagePath and outputPath are required' }
  }
  
  console.log('Loading frame:', imagePath);

  // Load the image using Skia Canvas
  const img = await loadImage(imagePath);
  const width = img.width();
  const height = img.height();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw the image onto the canvas
  ctx.drawImage(img, 0, 0, width, height);

  // Prepare image data for TensorFlow.js
  const imageData = ctx.getImageData(0, 0, width, height);
  const imageTensor = tf.browser.fromPixels({ data: new Uint8Array(imageData.data), width, height, channels: 3 });

  // Run object detection
  const predictions = await model.detect(imageTensor);
  imageTensor.dispose(); // Dispose tensor to free memory

  // Draw bounding boxes and labels
  ctx.font = '16px Arial';
  ctx.fillStyle = 'red';
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;

  for (const prediction of predictions) {
    const [x, y, w, h] = prediction.bbox;
    const label = `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`;

    // Draw bounding box
    ctx.strokeRect(x, y, w, h);

    // Draw label text
    ctx.fillText(label, x, y - 5); // Offset text slightly above the box
  }

  // Save the annotated image
  await Deno.writeFile(outputPath, canvas.toBuffer());

  console.log("Writing frame:", outputPath);
  return { ok: 1 }
}


async function processImage(data?: { imagePath: string, outputPath: string }) {
  const [model] = await promise;

  const { imagePath, outputPath } = data ?? {};
  if (!imagePath || !outputPath) {
    return { ok: 0, error: 'imagePath and outputPath are required' }
  }
  
  console.log('Loading frame:', imagePath);

  // Load the image using Skia Canvas
  const img = await loadImage(imagePath);
  const width = img.width();
  const height = img.height();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw the image onto the canvas
  ctx.drawImage(img, 0, 0, width, height);

  // Prepare image data for TensorFlow.js
  const imageData = ctx.getImageData(0, 0, width, height);
  const imageTensor = tf.browser.fromPixels({ data: new Uint8Array(imageData.data), width, height, channels: 3 });

  // Run object detection
  const predictions = await model.detect(imageTensor);
  imageTensor.dispose(); // Dispose tensor to free memory

  // Draw bounding boxes and labels
  ctx.font = '16px Arial';
  ctx.fillStyle = 'red';
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;

  for (const prediction of predictions) {
    const [x, y, w, h] = prediction.bbox;
    const label = `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`;

    // Draw bounding box
    ctx.strokeRect(x, y, w, h);

    // Draw label text
    ctx.fillText(label, x, y - 5); // Offset text slightly above the box
  }

  // Save the annotated image
  await Deno.writeFile(outputPath, canvas.toBuffer());
  canvas.dispose();

  console.log("Writing frame:", outputPath);
  return { ok: 1 }
}

export default new ThreadWorker({
  processImage,
  extractFrames,
}, {
  maxInactiveTime: 60000,
})
