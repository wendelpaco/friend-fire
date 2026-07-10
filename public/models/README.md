# Soldier GLTF

Place a **rigged humanoid** at `soldier.glb` (served as `/models/soldier.glb`).

## Current file

`soldier.glb` ships the Khronos **CesiumMan** sample (glTF sample models) as a pipeline stand-in:

- Validates load → clone → `AnimationMixer` → team tint → weapon socket  
- Swap for a CC0 military low-poly (Quaternius / Kenney family) when ready  
- Target &lt; 1 MB; at least one walk/run clip preferred  

## Fallback

If the file is missing or fails to load, Friend Fire keeps the **procedural** box soldier (silhouette pass A). No crash.

## Facing

Humanoid glTFs usually face **−Z**. The client applies `MODEL_YAW_OFFSET_GLTF_NEG_Z` (`Math.PI`) so locomotion yaw stays correct.
