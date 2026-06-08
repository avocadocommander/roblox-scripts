import { Lighting } from "@rbxts/services";
import { LIGHTING_CONFIG } from "shared/config/lighting";
import "shared/player-state"; // Ensure DataStore listeners are registered at server start
import "./bootstrap"; // Load and initialize server bootstrap (spawns all NPCs before players are allowed in)

// Apply world lighting from the single-source-of-truth config.
// NOTE: `Lighting.Technology` is read-only at runtime and is pinned to
// `Future` via default.project.json so the place file always boots with the
// correct rendering tech (Studio's preview can differ from the saved value).
Lighting.GlobalShadows = LIGHTING_CONFIG.globalShadows;
Lighting.ClockTime = LIGHTING_CONFIG.clockTime;
Lighting.Brightness = LIGHTING_CONFIG.brightness;
Lighting.Ambient = LIGHTING_CONFIG.ambient;
Lighting.OutdoorAmbient = LIGHTING_CONFIG.outdoorAmbient;
Lighting.EnvironmentDiffuseScale = LIGHTING_CONFIG.environmentDiffuseScale;
Lighting.EnvironmentSpecularScale = LIGHTING_CONFIG.environmentSpecularScale;
