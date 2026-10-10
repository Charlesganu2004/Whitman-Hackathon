import { Config } from '@remotion/cli/config';

// JPEG frames keep a 4K render inside a small disk budget; the film has no transparency.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
