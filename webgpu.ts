import type { VideoFrame } from 'npm:libavjs-webcodecs-polyfill';
import type { CanvasImageSource } from 'jsr:@gfx/canvas-wasm';
import { load as loadWebCodecsPolyfill, VideoDecoder, EncodedVideoChunk } from 'npm:libavjs-webcodecs-polyfill';
import LibAV from 'npm:@libav.js/variant-webcodecs';
import { createCanvas } from 'jsr:@gfx/canvas-wasm';

/**
 * Extracts frames from a video at 1 frame every 10 seconds.
 *
 * @param videoPath - Path to the video file.
 * @param outputDir - Directory to save extracted frames.
 */
async function extractFrames(videoPath: string, outputDir: string) {
  // Ensure the output directory exists
  await Deno.mkdir(outputDir, { recursive: true });

  // Load WebCodecs polyfill with libav
  await loadWebCodecsPolyfill({
    LibAV: LibAV,
  });

  // Read video data into memory
  const videoData = await Deno.readFile(videoPath);
  const videoBuffer = new Uint8Array(videoData);

  // Initialize libav instance and demuxer
  const libav = await LibAV.LibAV();

  await libav.writeFile('input.webm', new Uint8Array(videoData));
  const [fmt_ctx, streams] = await libav.ff_init_demuxer_file('input.mp4');
  
  const videoStreamIndex = streams.findIndex(s => s.codec_type === libav.AVMEDIA_TYPE_VIDEO);
  if (videoStreamIndex === -1) throw new Error('No video stream found');

  const videoStream = streams[videoStreamIndex];
  const [codecContext, pkt, frame] = await libav.ff_init_decoder(videoStream.codec_id, videoStream.codecpar);


  // await libav.writeFile("input.webm", videoBuffer);
  // const [fmt_ctx, [stream]] = await libav.ff_init_demuxer_file("input.webm");

  // // Set up libav decoder for VP8
  // const [, codec_ctx, pkt, frame] = await libav.ff_init_decoder(stream.codec_id, stream.codecpar);

  // Initialize variables for tracking frame extraction interval
  let frameCount = 0;
  const frameInterval = 10 * 1000; // 10 seconds in milliseconds

  // Define function to process and save each extracted frame
  const outputHandler = async (videoFrame: VideoFrame) => {
    // Create a canvas matching the frame dimensions
    const canvas = createCanvas(videoFrame.displayWidth, videoFrame.displayHeight);
    const context = canvas.getContext("2d");

    // Draw the current frame to the canvas
    context.drawImage(videoFrame as unknown as CanvasImageSource, 0, 0);

    // Save frame as PNG
    const outputPath = `${outputDir}/frame_${String(frameCount).padStart(4, "0")}.png`;
    const pngData = canvas.toBuffer("image/png");
    await Deno.writeFile(outputPath, new Uint8Array(pngData));

    frameCount++;
    videoFrame.close(); // Free resources
  };

  // Configure the WebCodecs VideoDecoder with VP8 codec
  const decoder = new VideoDecoder({
    output: outputHandler,
    error: (error: any) => console.error("Decoding error:", error),
  });
  decoder.configure({ codec: "vp8" });

  try {
    let [res, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);
    const entries = Object.entries(packets);
    console.log({
      packets
    })
    // while (res === 0 && entries.length > 0) {
    //   for (const [index, packet] of entries) {
    //     const chunk = new EncodedVideoChunk({
    //       type: packet.flags & libav.AV_PKT_FLAG_KEY ? 'key' : 'delta',
    //       timestamp: packet.pts,
    //       data: packet.data,
    //     });
    //     decoder.decode(chunk);
    //   }
    //   [res, packets] = await libav.ff_read_multi(fmt_ctx, pkt, {
    //     count: 1,
    //     stream_index: videoStreamIndex,
    //   });
    // }

    await libav.avformat_close_input(fmt_ctx);
    await libav.av_frame_free(frame);
    await libav.av_packet_free(pkt);
  } catch (error) {
    console.error("Error processing video:", error);
  }

}


/**
 * Extracts frames from a video at 1 frame every 10 seconds.
 *
 * @param videoPath - Path to the video file.
 * @param outputDir - Directory to save extracted frames.
 */
// async function extractFrames(videoPath: string, outputDir: string) {
//   // Create the output directory if it doesn't exist
//   await Deno.mkdir(outputDir, { recursive: true });

//   await loadWebCodecsPolyfill({
//     LibAV: LibAV,
//   });

//   // Load the video data as ArrayBuffer
//   const videoData = await Deno.readFile(videoPath);

//   // Initialize variables for tracking frame interval
//   let frameCount = 0;
//   const frameInterval = 10000; // 10 seconds in milliseconds

//   const outputHandler = async (frame: VideoFrame) => {
//     // Create a canvas matching the frame dimensions
//     const canvas = createCanvas(frame.displayWidth, frame.displayHeight);
//     const context = canvas.getContext("2d");

//     // Draw the current frame to the canvas
//     context.drawImage(frame as unknown as CanvasImageSource, 0, 0);

//     // Save frame as PNG
//     const outputPath = `${outputDir}/frame_${String(frameCount).padStart(4, "0")}.png`;
//     const pngData = canvas.toBuffer("image/png");
//     await Deno.writeFile(outputPath, new Uint8Array(pngData));

//     frameCount++;
//     frame.close(); // Free resources
//   };

//   // Configure the decoder with appropriate codec (adjust as per video codec)
//   const decoder = new VideoDecoder({
//     output: outputHandler,
//     error: (error: any) => console.error("Decoding error:", error),
//   });

//   // Assume codec for demonstration; should match video format
//   decoder.configure({ codec: "vp8" });

//   try {
//     // Create and decode chunks at frameInterval (e.g., every 10 seconds)
//     const bufferSource = new Uint8Array(videoData);
//     let timestamp = 0;

//     while (timestamp < bufferSource.byteLength) {
//       const chunk = new EncodedVideoChunk({
//         type: "key",
//         timestamp,
//         data: bufferSource.slice(timestamp, timestamp + frameInterval),
//       });
//       decoder.decode(chunk);
//       timestamp += frameInterval;
//     }
//   } catch (error) {
//     console.error("Error processing video:", error);
//   }
// }


// import type { Packet } from 'npm:@libav.js/variant-webcodecs'
// import { extname } from "jsr:@std/path/posix";

/**
 * Extracts frames from a video using ff_decode_filter_multi with ImageData output.
 *
 * @param videoPath - Path to the video file.
 * @param outputDir - Directory to save extracted frames.
 */
// async function extractFrames(videoPath: string, outputDir: string) {
//   // Initialize LibAV and load video file into virtual filesystem
//   const libav = await LibAV.LibAV();
//   const ext = extname(videoPath)
//   const videoData = await Deno.readFile(videoPath);

//   const tempFilePath = `tmp${ext}`
//   await libav.writeFile(tempFilePath, videoData);

//   const fileSize = await libav.readFile(tempFilePath);
//   console.log({
//     tempFilePath,
//     fileSize
//   })

//   // Initialize the demuxer and decoder
//   const [fmt_ctx, [stream]] = await libav.ff_init_demuxer_file(tempFilePath);
//   const [, codecCtx, pkt, frame] = await libav.ff_init_decoder(stream.codec_id, stream.codecpar);

//   // Configure the filter graph to extract frames at intervals (e.g., fps=1/10 for every 10 seconds)
//   const filterDesc = "fps=1/10";
//   const [filterGraph, buffersrc_ctx, buffersink_ctx] = await libav.ff_init_filter_graph(filterDesc, {}, {});

//   // Ensure output directory exists
//   await Deno.mkdir(outputDir, { recursive: true });

//   // Read, decode, and filter frames
//   let frameCount = 0;
//   while (true) {
//     const [ret, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);
//     if (ret === LibAV.AVERROR_EOF) break; // End of file
//     if (ret < 0) throw new Error(`Error reading packets: ${ret}`);

//     // Decode and filter frames as ImageData
//     const frames = await libav.ff_decode_filter_multi(codecCtx, buffersrc_ctx, buffersink_ctx, pkt, frame, packets[stream.index], {
//       copyoutFrame: "ImageData"
//     });

//     for (const imgData of frames) {
//       // Create a canvas and render the ImageData directly
//       const canvas = createCanvas(imgData.width, imgData.height);
//       const context = canvas.getContext("2d");
//       context.putImageData(imgData, 0, 0);

//       // Save frame as PNG
//       const outputPath = `${outputDir}/frame_${String(frameCount).padStart(4, "0")}.png`;
//       const pngData = canvas.toBuffer("image/png");
//       await Deno.writeFile(outputPath, new Uint8Array(pngData));

//       frameCount++;
//     }
//   }

//   console.log(`Extracted ${frameCount} frames.`);
// }

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

  // const data = [];
  // for await (const entry of Deno.readDir(framesDir)) {
  //   if (entry.isFile && entry.name.endsWith('.png')) {
  //     const imagePath = `${framesDir}/${entry.name}`;
  //     const outputPath = `${outputDir}/${entry.name}`;

  //     console.log(`Processing ${entry.name}...`);
  //     data.push({ imagePath, outputPath });
  //   }
  // }

  // await pool.mapExecute(data, 'processImage');

  console.log('Processing complete. Check the output folder for results.');
}

await main();

await pool.destroy()
