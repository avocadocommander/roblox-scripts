const SoundService = game.GetService("SoundService");

const theme = new Instance("Sound");
theme.SoundId = "rbxassetid://95791474631382"; // Replace with your ID
theme.Name = "TavernTheme";
theme.Looped = true;
theme.Volume = 1;
theme.Playing = true;
theme.Parent = SoundService;
