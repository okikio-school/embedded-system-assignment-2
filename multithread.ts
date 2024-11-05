// adapt import to the targeted JS runtime
import {
  availableParallelism,
  FixedThreadPool,
  PoolEvents,
} from 'jsr:@poolifier/poolifier-web-worker'

// a fixed web worker pool
const pool = new FixedThreadPool(
  availableParallelism(),
  new URL('./workers/worker.ts', import.meta.url),
  {
    errorEventHandler: (e) => {
      console.error(e)
    },
    workerOptions: {
      type: "module",
      deno: {
        permissions: "inherit",
      },
    }
  },
);

pool.eventTarget?.addEventListener(
  PoolEvents.ready,
  () => console.info('Pool is ready'),
)
pool.eventTarget?.addEventListener(
  PoolEvents.busy,
  () => console.info('Pool is busy'),
)

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
  
async function main() {
  const videoPath = 'test_video.mp4'; // Replace with your video file path
  const framesDir = 'frames';
  const outputDir = 'output';

  // Step 1: Extract frames from the video
  console.log('Extracting frames from the video...');
  await extractFrames(videoPath, framesDir);
  console.log('Frames extracted.');

  // Step 3: Process each extracted frame
  console.log('Processing images...');
  await Deno.mkdir(outputDir, { recursive: true });

  const data = [];
  for await (const entry of Deno.readDir(framesDir)) {
    if (entry.isFile && entry.name.endsWith('.png')) {
      const imagePath = `${framesDir}/${entry.name}`;
      const outputPath = `${outputDir}/${entry.name}`;

      console.log(`Processing ${entry.name}...`);
      data.push({ imagePath, outputPath });
    }
  }

  await pool.mapExecute(data);

  console.log('Processing complete. Check the output folder for results.');
}

await main();

await pool.destroy()

  