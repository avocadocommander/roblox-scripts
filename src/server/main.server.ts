import { Lighting } from "@rbxts/services";
import "shared/player-state"; // Ensure DataStore listeners are registered at server start
import "./bootstrap"; // Load and initialize server bootstrap (spawns all NPCs before players are allowed in)

const time = 20.45;
Lighting.ClockTime = time;

// Darken the scene without shifting the time-of-day mood.
Lighting.Brightness = 1;
Lighting.Ambient = Color3.fromRGB(20, 20, 25);
Lighting.OutdoorAmbient = Color3.fromRGB(30, 30, 40);
