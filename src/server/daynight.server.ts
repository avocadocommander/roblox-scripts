import { Lighting, RunService } from "@rbxts/services";

let time = 17;
const desiredDayLengthInMinutes = 20; // 5 minutes real time
const daySpeed = 24 / (desiredDayLengthInMinutes * 60);

RunService.Heartbeat.Connect((deltaTime) => {
	time += deltaTime * daySpeed;
	if (deltaTime >= 24) {
		time = 0;
	}
	Lighting.ClockTime = time;
});
