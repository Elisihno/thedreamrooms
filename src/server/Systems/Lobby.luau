--!strict
-- Builds the start lobby in code: floor, spawn, title sign, golden chest and cyber chest.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local FLOOR_RADIUS = 60
local FLOOR_THICKNESS = 2
-- floor top sits a hair above a default Baseplate (top at y = 0) to avoid z-fighting
local FLOOR_TOP = 0.2

local GOLD = Color3.fromRGB(255, 196, 40)
local WOOD = Color3.fromRGB(120, 76, 40)
local DARK_METAL = Color3.fromRGB(22, 24, 34)
local CYAN = Color3.fromRGB(0, 240, 255)
local MAGENTA = Color3.fromRGB(255, 0, 200)

local Lobby = {}

local function part(
	parent: Instance,
	name: string,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	material: Enum.Material,
	shape: Enum.PartType?
): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.Material = material
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if shape then
		p.Shape = shape
	end
	p.Parent = parent
	return p
end

local function addLabel(adornee: BasePart, text: string, color: Color3, height: number)
	local gui = Instance.new("BillboardGui")
	gui.Name = "ChestLabel"
	gui.Adornee = adornee
	gui.Size = UDim2.fromOffset(260, 56)
	gui.StudsOffsetWorldSpace = Vector3.new(0, height, 0)
	gui.AlwaysOnTop = false
	gui.MaxDistance = 120
	gui.Parent = adornee

	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.TextColor3 = color
	label.TextStrokeTransparency = 0.3
	label.TextStrokeColor3 = Color3.new(0, 0, 0)
	label.Parent = gui
end

-- origin: chest base center on the floor, local -Z is the chest's front
local function buildGoldenChest(parent: Instance, origin: CFrame): Model
	local model = Instance.new("Model")
	model.Name = "GoldenChest"

	local body = part(model, "Body", Vector3.new(4, 2, 2.5), origin * CFrame.new(0, 1, 0), WOOD, Enum.Material.Wood)
	-- rounded lid: a cylinder lying along X, half sunk into the body
	part(
		model,
		"Lid",
		Vector3.new(4, 2.5, 2.5),
		origin * CFrame.new(0, 2, 0),
		WOOD,
		Enum.Material.Wood,
		Enum.PartType.Cylinder
	)
	for _, x in { -1.5, 1.5 } do
		part(model, "Band", Vector3.new(0.3, 2.05, 2.6), origin * CFrame.new(x, 1, 0), GOLD, Enum.Material.Metal)
		part(
			model,
			"LidBand",
			Vector3.new(0.3, 2.6, 2.6),
			origin * CFrame.new(x, 2, 0),
			GOLD,
			Enum.Material.Metal,
			Enum.PartType.Cylinder
		)
	end
	part(model, "Trim", Vector3.new(4.1, 0.25, 2.6), origin * CFrame.new(0, 2, 0), GOLD, Enum.Material.Metal)
	part(model, "Lock", Vector3.new(0.7, 0.9, 0.3), origin * CFrame.new(0, 2, -1.3), GOLD, Enum.Material.Metal)

	local glow = Instance.new("PointLight")
	glow.Color = GOLD
	glow.Range = 14
	glow.Brightness = 1.5
	glow.Parent = body

	model.PrimaryPart = body
	model.Parent = parent
	addLabel(body, Config.Chests.GoldenLabel, GOLD, 4.5)
	return model
end

local function buildCyberChest(parent: Instance, origin: CFrame): Model
	local model = Instance.new("Model")
	model.Name = "CyberChest"

	local body =
		part(model, "Body", Vector3.new(4, 2, 2.5), origin * CFrame.new(0, 1, 0), DARK_METAL, Enum.Material.Metal)
	part(model, "Lid", Vector3.new(4.1, 0.8, 2.6), origin * CFrame.new(0, 2.4, 0), DARK_METAL, Enum.Material.Metal)
	-- neon edge strips
	for _, x in { -2.02, 2.02 } do
		part(model, "EdgeV", Vector3.new(0.12, 2.8, 0.12), origin * CFrame.new(x, 1.4, -1.3), CYAN, Enum.Material.Neon)
		part(model, "EdgeV", Vector3.new(0.12, 2.8, 0.12), origin * CFrame.new(x, 1.4, 1.3), CYAN, Enum.Material.Neon)
	end
	part(model, "EdgeH", Vector3.new(4.14, 0.12, 0.12), origin * CFrame.new(0, 2.0, -1.31), CYAN, Enum.Material.Neon)
	part(model, "EdgeH", Vector3.new(4.14, 0.12, 0.12), origin * CFrame.new(0, 2.8, -1.31), MAGENTA, Enum.Material.Neon)
	part(model, "Core", Vector3.new(0.9, 0.9, 0.2), origin * CFrame.new(0, 1.6, -1.27), MAGENTA, Enum.Material.Neon)
	part(model, "Vent", Vector3.new(2.4, 0.15, 0.1), origin * CFrame.new(0, 0.5, -1.27), CYAN, Enum.Material.Neon)

	local glow = Instance.new("PointLight")
	glow.Color = CYAN
	glow.Range = 16
	glow.Brightness = 2
	glow.Parent = body

	model.PrimaryPart = body
	model.Parent = parent
	addLabel(body, Config.Chests.CyberLabel, CYAN, 4.5)
	return model
end

local function buildTitle(parent: Instance)
	local anchor = part(
		parent,
		"TitleAnchor",
		Vector3.new(1, 1, 1),
		CFrame.new(0, FLOOR_TOP + 16, -38),
		Color3.new(0, 0, 0),
		Enum.Material.SmoothPlastic
	)
	anchor.Transparency = 1
	anchor.CanCollide = false

	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(700, 110)
	gui.MaxDistance = 250
	gui.Adornee = anchor
	gui.Parent = anchor

	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = string.upper(Config.GameName)
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.TextColor3 = Color3.fromRGB(255, 255, 255)
	label.TextStrokeTransparency = 0
	label.TextStrokeColor3 = Color3.fromRGB(200, 30, 60)
	label.Parent = gui
end

function Lobby.init()
	Lighting.ClockTime = 20
	Lighting.Brightness = 2

	local lobby = Instance.new("Folder")
	lobby.Name = "Lobby"

	-- floor: cylinder rotated so its axis points up
	part(
		lobby,
		"Floor",
		Vector3.new(FLOOR_THICKNESS, FLOOR_RADIUS * 2, FLOOR_RADIUS * 2),
		CFrame.new(0, FLOOR_TOP - FLOOR_THICKNESS / 2, 0) * CFrame.Angles(0, 0, math.rad(90)),
		Color3.fromRGB(40, 42, 56),
		Enum.Material.Slate,
		Enum.PartType.Cylinder
	)
	-- glowing rim
	part(
		lobby,
		"Rim",
		Vector3.new(0.4, FLOOR_RADIUS * 2 + 1, FLOOR_RADIUS * 2 + 1),
		CFrame.new(0, FLOOR_TOP - 0.2, 0) * CFrame.Angles(0, 0, math.rad(90)),
		CYAN,
		Enum.Material.Neon,
		Enum.PartType.Cylinder
	)

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "LobbySpawn"
	spawn.Size = Vector3.new(10, 1, 10)
	spawn.Position = Vector3.new(0, FLOOR_TOP + 0.5, 22)
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Material = Enum.Material.Neon
	spawn.Color = Color3.fromRGB(60, 70, 110)
	spawn.TopSurface = Enum.SurfaceType.Smooth
	spawn.Parent = lobby

	-- chests face the middle of the floor, in front of the spawn
	local focus = Vector3.new(0, FLOOR_TOP, 14)
	local goldenPos = Vector3.new(-12, FLOOR_TOP, -10)
	local cyberPos = Vector3.new(12, FLOOR_TOP, -10)
	buildGoldenChest(lobby, CFrame.lookAt(goldenPos, Vector3.new(focus.X, goldenPos.Y, focus.Z)))
	buildCyberChest(lobby, CFrame.lookAt(cyberPos, Vector3.new(focus.X, cyberPos.Y, focus.Z)))

	buildTitle(lobby)

	lobby.Parent = workspace
end

return Lobby
