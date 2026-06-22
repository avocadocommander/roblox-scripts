import { ReplicatedStorage } from "@rbxts/services";
import { ITEMS } from "shared/inventory";
import { WEAPONS } from "shared/config/weapons";

export interface ItemVisualOptions {
	size: UDim2;
	position: UDim2;
	zIndex: number;
	fallbackText: string;
	fallbackColor: Color3;
	fallbackTextSize: number;
}

function normalizeName(name: string): string {
	return name.lower().gsub("[^%w]", "")[0];
}

function findNormalizedChild(root: Instance | undefined, names: string[]): Instance | undefined {
	if (!root) return undefined;
	const normalizedNames = new Set<string>();
	for (const name of names) normalizedNames.add(normalizeName(name));

	for (const child of root.GetChildren()) {
		if (normalizedNames.has(normalizeName(child.Name))) return child;
	}
	return undefined;
}

function resolveDisplaySource(itemId: string): Instance | undefined {
	const item = ITEMS[itemId];
	if (!item) return undefined;

	const names = [item.id, item.name];
	if (item.familyId) names.push(item.familyId);

	const displayModels = ReplicatedStorage.FindFirstChild("DisplayModels");
	const displaySource = findNormalizedChild(displayModels, names);
	if (displaySource) return displaySource;

	if (item.category === "poison") {
		const fallback = findNormalizedChild(displayModels, ["Poison", "Posion"]);
		if (fallback) return fallback;
	} else if (item.category === "elixir") {
		const fallback = findNormalizedChild(displayModels, ["Elixir", "Elixer"]);
		if (fallback) return fallback;
	}

	if (item.category === "weapon") {
		const heldModelName = WEAPONS[itemId]?.heldModelName;
		if (heldModelName) names.push(heldModelName);
		return findNormalizedChild(ReplicatedStorage.FindFirstChild("Weapons"), names);
	}
	return undefined;
}

function cloneAsModel(source: Instance): Model | undefined {
	if (source.IsA("Model")) return source.Clone();

	if (source.IsA("Accessory")) {
		const handle = source.FindFirstChild("Handle");
		if (!handle?.IsA("BasePart")) return undefined;
		const model = new Instance("Model");
		const clone = handle.Clone();
		clone.Parent = model;
		model.PrimaryPart = clone;
		return model;
	}

	if (source.IsA("BasePart")) {
		const model = new Instance("Model");
		const clone = source.Clone();
		clone.Parent = model;
		model.PrimaryPart = clone;
		return model;
	}
	return undefined;
}

function createFallback(parent: GuiObject, options: ItemVisualOptions): TextLabel {
	const icon = new Instance("TextLabel");
	icon.Size = options.size;
	icon.Position = options.position;
	icon.BackgroundTransparency = 1;
	icon.Text = options.fallbackText;
	icon.TextColor3 = options.fallbackColor;
	icon.Font = Enum.Font.Antique;
	icon.TextSize = options.fallbackTextSize;
	icon.ZIndex = options.zIndex;
	icon.Parent = parent;
	return icon;
}

/** Render an item model from DisplayModels/Weapons, falling back to its text icon. */
export function createItemVisual(parent: GuiObject, itemId: string, options: ItemVisualOptions): GuiObject {
	const source = resolveDisplaySource(itemId);
	const display = source ? cloneAsModel(source) : undefined;
	if (!display) return createFallback(parent, options);

	for (const descendant of display.GetDescendants()) {
		if (
			descendant.IsA("Script") ||
			descendant.IsA("LocalScript") ||
			descendant.IsA("ModuleScript") ||
			descendant.IsA("Humanoid") ||
			descendant.IsA("Animator")
		) {
			descendant.Destroy();
		} else if (descendant.IsA("BasePart")) {
			descendant.Anchored = true;
			descendant.CanCollide = false;
			descendant.CanTouch = false;
			descendant.CanQuery = false;
		}
	}

	const parts = display.GetDescendants().filter((desc): desc is BasePart => desc.IsA("BasePart"));
	if (parts.size() === 0) {
		display.Destroy();
		return createFallback(parent, options);
	}

	const viewport = new Instance("ViewportFrame");
	viewport.Name = "ItemModel";
	viewport.Size = options.size;
	viewport.Position = options.position;
	viewport.BackgroundTransparency = 1;
	viewport.Ambient = Color3.fromRGB(185, 185, 185);
	viewport.LightColor = Color3.fromRGB(255, 244, 220);
	viewport.LightDirection = new Vector3(-1, -1, -1);
	viewport.ZIndex = options.zIndex;
	viewport.Parent = parent;

	const world = new Instance("WorldModel");
	world.Parent = viewport;
	display.Parent = world;

	const [boxCFrame, boxSize] = display.GetBoundingBox();
	const centerTransform = new CFrame(boxCFrame.Position).Inverse();
	for (const part of parts) part.CFrame = centerTransform.mul(part.CFrame);

	const camera = new Instance("Camera");
	camera.FieldOfView = 35;
	camera.Parent = viewport;
	viewport.CurrentCamera = camera;

	const maxDimension = math.max(boxSize.X, boxSize.Y, boxSize.Z);
	const distance = math.max(2, maxDimension / (2 * math.tan(math.rad(camera.FieldOfView / 2))) * 1.3);
	const direction = new Vector3(1, 0.45, 1).Unit;
	camera.CFrame = CFrame.lookAt(direction.mul(distance), new Vector3());

	return viewport;
}
