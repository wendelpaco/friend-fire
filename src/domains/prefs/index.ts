export type { CameraDefault, GraphicsQuality } from "./types";
export {
  FOG_ENABLED_KEY,
  getFogEnabled,
  setFogEnabled,
} from "./fog";
export {
  CAMERA_DEFAULT_KEY,
  DEFAULT_CAMERA,
  getCameraDefault,
  setCameraDefault,
} from "./camera";
export {
  DEFAULT_GRAPHICS_QUALITY,
  GRAPHICS_QUALITY_KEY,
  SHOW_FPS_KEY,
  getGraphicsQuality,
  getShowFps,
  parseGraphicsQuality,
  resolveQualityConfig,
  setGraphicsQuality,
  setShowFps,
  type GraphicsQualityConfig,
} from "./quality";
