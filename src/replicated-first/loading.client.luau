--!strict
--
-- Loading screen -- pure Luau LocalScript living in ReplicatedFirst.
--
-- WHY PURE LUAU AND NOT ROBLOX-TS:
--   Every roblox-ts compiled script starts with
--     local TS = require(ReplicatedStorage:WaitForChild("rbxts_include"):WaitForChild("RuntimeLib"))
--   In ReplicatedFirst that WaitForChild races with replication: the script
--   wakes up before ReplicatedStorage has finished populating, so the loading
--   UI never gets a chance to render in time. Writing this file as raw Luau
--   bypasses the TS runtime entirely and lets the UI paint instantly.
--
-- WHAT TO EDIT:
--   Tips and background image IDs are inline below. Add to those arrays --
--   no other file touches the loading screen.
--
-- LIFETIME:
--   The screen stays up until ALL of the following are true:
--     (a) game:IsLoaded() -- world assets have replicated
--     (b) LocalPlayer:GetAttribute("ClientInitialized") == true -- our own
--         client bootstrap finished (set by src/client/modules/client-init.ts)
--     (c) LOADING_MIN_DURATION_SECONDS have elapsed since the UI is visible
--

local Players = game:GetService("Players")
local ReplicatedFirst = game:GetService("ReplicatedFirst")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

print("[LOADING] Loading screen script started")

-- ── Tunables ─────────────────────────────────────────────────────────────────

local LOADING_MIN_DURATION_SECONDS = 10
local LOADING_FADE_OUT_SECONDS = 0.6

-- ── Background images ───────────────────────────────────────────────────────
-- Add rbxassetid:// strings here. One is picked at random per load.
-- Leave empty (`{}`) to fall back to a solid dark backdrop.

local LOADING_BACKGROUND_IMAGES: { string } = {
	"rbxassetid://104232259629852",
	"rbxassetid://76895568410938",
	"rbxassetid://139394395620434",
}

-- ── Tip lines ────────────────────────────────────────────────────────────────
-- Short hints shown at the bottom. One is picked at random per load.
-- Keep ASCII only -- Luau crashes on \uXXXX escapes and emoji in
-- concatenated strings.

local LOADING_TIPS: { string } = {
	"Assassinate the mark on your Board scroll to collect the bounty.",
	"Kill an NPC without a scroll on them and you become Wanted. Other players can hunt you.",
	"Wanted players drop their Board scrolls when killed. Hunt them well.",
	"Coat your blade with poison for stranger, more lucrative kills.",
	"Elixirs grant a temporary edge -- save them for the hardest marks.",
	"The Codex remembers every soul you have taken. Fill its pages.",
	"Nobles and Royals pay the highest gold -- if you can reach them.",
	"Being seen mid-kill alerts witnesses. Approach from the shadows.",
	"Press F to open your inventory.",
	"Press V to open the Codex.",
	"Press Q to assassinate a mark when you are in range.",
	"Travelling merchants visit ports with fresh stock. Watch for the cart.",
	"Bring full scrolls to the right Guild leader to claim your reward.",
	"Higher tiers wear richer cloth: grey serfs, green commoners, blue merchants, purple nobility, gold royalty.",
	"Some blades stab. Some blades crush. Pick the right tool for the right mark.",
	"A player's bounty scroll burns red -- the rarest prize on the board.",
	"You can hold only four Board scrolls at a time. Cash them in often.",
	"Gold buys you out of the Wanted list -- if you can afford the price.",
	"The Black Market trades in poisons no honest merchant will touch.",
	"Levels unlock new districts. Walk further and the world opens up.",
}

-- ── 0. Hide default loading screen ASAP ──────────────────────────────────────
-- Wrapped in pcall: in Studio this throws if the default screen is already gone.

pcall(function()
	ReplicatedFirst:RemoveDefaultLoadingScreen()
end)

-- ── 1. Resolve LocalPlayer ───────────────────────────────────────────────────
-- ReplicatedFirst scripts can wake up before Players.LocalPlayer is assigned.

local function getLocalPlayer(): Player
	local p = Players.LocalPlayer
	while not p do
		Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
		p = Players.LocalPlayer
	end
	return p
end

local player = getLocalPlayer()

-- ── 2. Build the UI ──────────────────────────────────────────────────────────

local playerGui = player:WaitForChild("PlayerGui") :: PlayerGui

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "LoadingScreen"
screenGui.ResetOnSpawn = false
screenGui.IgnoreGuiInset = true
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
-- Top of the stack -- nothing else should render over the loading screen.
screenGui.DisplayOrder = 1000
screenGui.Parent = playerGui

-- Root frame -- solid dark backdrop. This is the element we fade out.
local root = Instance.new("Frame")
root.Name = "Root"
root.Size = UDim2.new(1, 0, 1, 0)
root.BackgroundColor3 = Color3.fromRGB(8, 6, 5)
root.BackgroundTransparency = 0
root.BorderSizePixel = 0
root.Parent = screenGui

-- Background image (only if the pool is non-empty).
local backgroundImage: ImageLabel? = nil
if #LOADING_BACKGROUND_IMAGES > 0 then
	local bg = Instance.new("ImageLabel")
	bg.Name = "Background"
	bg.Size = UDim2.new(1, 0, 1, 0)
	bg.BackgroundTransparency = 1
	bg.Image = LOADING_BACKGROUND_IMAGES[math.random(1, #LOADING_BACKGROUND_IMAGES)]
	bg.ScaleType = Enum.ScaleType.Crop
	bg.ImageTransparency = 0
	bg.BorderSizePixel = 0
	bg.Parent = root
	backgroundImage = bg
end

-- Bottom-edge shade so the tip stays readable over any background.
local bottomShade = Instance.new("Frame")
bottomShade.Name = "BottomShade"
bottomShade.Size = UDim2.new(1, 0, 0.45, 0)
bottomShade.Position = UDim2.new(0, 0, 1, 0)
bottomShade.AnchorPoint = Vector2.new(0, 1)
bottomShade.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
bottomShade.BorderSizePixel = 0
bottomShade.Parent = root

local shadeGradient = Instance.new("UIGradient")
shadeGradient.Transparency = NumberSequence.new({
	NumberSequenceKeypoint.new(0, 1),
	NumberSequenceKeypoint.new(1, 0.15),
})
shadeGradient.Rotation = 90
shadeGradient.Parent = bottomShade

-- Tip caption at the bottom.
local tipText = LOADING_TIPS[math.random(1, math.max(1, #LOADING_TIPS))]
	or "Sharpen your blade. The marks are waiting."

local tipLabel = Instance.new("TextLabel")
tipLabel.Name = "Tip"
tipLabel.AnchorPoint = Vector2.new(0.5, 1)
tipLabel.Position = UDim2.new(0.5, 0, 1, -36)
tipLabel.Size = UDim2.new(0.9, 0, 0, 64)
tipLabel.BackgroundTransparency = 1
tipLabel.TextColor3 = Color3.fromRGB(232, 218, 188)
tipLabel.Font = Enum.Font.Antique -- matches UI_THEME.fontDisplay
tipLabel.TextSize = 22
tipLabel.TextScaled = false
tipLabel.TextWrapped = true
tipLabel.TextXAlignment = Enum.TextXAlignment.Center
tipLabel.TextYAlignment = Enum.TextYAlignment.Bottom
tipLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
tipLabel.TextStrokeTransparency = 0.4
tipLabel.Text = tipText
tipLabel.Parent = root

RunService.RenderStepped:Wait()
local visibleStartTime = tick()
print("[LOADING] UI built")

-- ── 3. Wait for all dismiss conditions ───────────────────────────────────────

-- (a) Roblox content load.
if not game:IsLoaded() then
	game.Loaded:Wait()
end
print("[LOADING] game.Loaded")

-- (b) Our own client init. Poll the attribute -- avoids the
-- check-then-Wait race that GetAttributeChangedSignal:Wait() can suffer.
while player:GetAttribute("ClientInitialized") ~= true do
	task.wait(0.05)
end
print("[LOADING] ClientInitialized")

-- (c) Minimum on-screen time.
local elapsed = tick() - visibleStartTime
if elapsed < LOADING_MIN_DURATION_SECONDS then
	task.wait(LOADING_MIN_DURATION_SECONDS - elapsed)
end
print("[LOADING] minimum duration elapsed, fading out")

-- ── 4. Fade out and destroy ──────────────────────────────────────────────────

local fadeInfo = TweenInfo.new(LOADING_FADE_OUT_SECONDS, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
local rootTween = TweenService:Create(root, fadeInfo, { BackgroundTransparency = 1 })
rootTween:Play()

if backgroundImage then
	TweenService:Create(backgroundImage, fadeInfo, { ImageTransparency = 1 }):Play()
end

TweenService:Create(bottomShade, fadeInfo, { BackgroundTransparency = 1 }):Play()

TweenService:Create(tipLabel, fadeInfo, {
	TextTransparency = 1,
	TextStrokeTransparency = 1,
}):Play()

rootTween.Completed:Wait()
RunService.Heartbeat:Wait()
screenGui:Destroy()
print("[LOADING] loading screen destroyed")
