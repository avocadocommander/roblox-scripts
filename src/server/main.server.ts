import { Lighting } from "@rbxts/services";
import "shared/player-state"; // Ensure DataStore listeners are registered at server start
import "./bootstrap"; // Load and initialize server bootstrap (spawns all NPCs before players are allowed in)

const time = 20.45;
Lighting.ClockTime = time;
