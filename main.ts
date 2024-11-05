// script.ts

import * as tf from 'npm:@tensorflow/tfjs-node';
import * as cocoSsd from 'npm:@tensorflow-models/coco-ssd';
import sharp from 'npm:sharp';

import { Buffer } from "node:buffer";

async function extractFrames(videoPath: string, outputDir: string) {
  // Create the output directory if it doesn't exist
  await Deno.mkdir(outputDir, { recursive: true });

  const cmd = new Deno.Command("ffmpeg", {
    args: ["-i", videoPath, "-vf", "fps=1/10", `${outputDir}/frame_%04d.png`],
    stderr: "piped",
    stdout: "piped",
  });
  const { code, stderr } = await cmd.output();

  if (code !== 0) {
    const errorString = new TextDecoder().decode(stderr);
    console.error("ffmpeg failed:", errorString);
    Deno.exit(code);
  }
}

async function processImage(imagePath: string, outputPath: string, model: cocoSsd.ObjectDetection) {
  const imageBuffer = await Deno.readFile(imagePath);
  const imageTensor = tf.node.decodeImage(imageBuffer, 3);

  const predictions = await model.detect(imageTensor);
  imageTensor.dispose(); // Dispose tensor to free memory

  // Load image with sharp
  let image = sharp(imageBuffer);

  // Get image metadata
  const metadata = await image.metadata();
  const { width, height } = metadata;

  // Create an SVG overlay for bounding boxes
  let svg = `<svg width="${width}" height="${height}">`;

  for (const prediction of predictions) {
    const [x, y, w, h] = prediction.bbox;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" style="stroke:red; fill: none; stroke-width: 2"/>`;
    svg += `<text x="${x}" y="${y - 5}" fill="red" font-size="16">${prediction.class} (${(prediction.score * 100).toFixed(1)}%)</text>`;
  }

  svg += `</svg>`;

  // Composite the SVG over the image
  // deno-lint-ignore no-node-globals
  image = image.composite([{ input: Buffer.from(svg), blend: 'over' }]);

  // Save the image
  await image.toFile(outputPath);
}

async function main() {
  const videoPath = 'test_video.mp4'; // Replace with your video file path
  const framesDir = 'frames';
  const outputDir = 'output';

  // Step 1: Extract frames from the video
  console.log('Extracting frames from the video...');
  await extractFrames(videoPath, framesDir);
  console.log('Frames extracted.');

  // Step 2: Load the object detection model
  console.log('Loading the object detection model...');
  const model = await cocoSsd.load();
  console.log('Model loaded.');

  // Step 3: Process each extracted frame
  console.log('Processing images...');
  await Deno.mkdir(outputDir, { recursive: true });

  for await (const entry of Deno.readDir(framesDir)) {
    if (entry.isFile && entry.name.endsWith('.png')) {
      const imagePath = `${framesDir}/${entry.name}`;
      const outputPath = `${outputDir}/${entry.name}`;
      console.log(`Processing ${entry.name}...`);
      await processImage(imagePath, outputPath, model);
    }
  }

  console.log('Processing complete. Check the output folder for results.');
}

await main();
