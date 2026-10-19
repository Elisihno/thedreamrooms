--!strict
-- Popup that appears a couple of seconds after joining and lets the player pick a mode.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Types = require(Shared:WaitForChild("Types"))

local ModePopup = {}

local BG = Color3.fromRGB(20, 22, 32)
local FONT_BOLD = Enum.Font.GothamBlack
local FONT_BODY = Enum.Font.GothamMedium

local function corner(parent: Instance, radius: number)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius)
	c.Parent = parent
end

local function stroke(parent: Instance, color: Color3, thickness: number)
	local s = Instance.new("UIStroke")
	s.Color = color
	s.Thickness = thickness
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	s.Parent = parent
end

local function text(parent: Instance, props: { [string]: any }): TextLabel
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextWrapped = true
	for k, v in props do
		(label :: any)[k] = v
	end
	label.Parent = parent
	return label
end

local function buildModeButton(parent: Instance, mode: Types.ModeInfo, order: number, onPick: (Types.ModeId) -> ()): TextButton
	local button = Instance.new("TextButton")
	button.Name = mode.Id
	button.LayoutOrder = order
	button.Size = UDim2.new(0.5, -8, 1, 0)
	button.BackgroundColor3 = Color3.fromRGB(32, 35, 50)
	button.AutoButtonColor = false
	button.Text = ""
	button.Parent = parent
	corner(button, 12)
	stroke(button, mode.Color, 2)

	text(button, {
		Name = "Title",
		Size = UDim2.new(1, -20, 0, 40),
		Position = UDim2.fromOffset(10, 18),
		Text = mode.Name,
		Font = FONT_BOLD,
		TextSize = 26,
		TextColor3 = mode.Color,
	})
	text(button, {
		Name = "Description",
		Size = UDim2.new(1, -24, 1, -74),
		Position = UDim2.fromOffset(12, 64),
		Text = mode.Description,
		Font = FONT_BODY,
		TextSize = 16,
		TextColor3 = Color3.fromRGB(200, 205, 220),
		TextYAlignment = Enum.TextYAlignment.Top,
	})

	local hoverTween = TweenInfo.new(0.12, Enum.EasingStyle.Quad)
	button.MouseEnter:Connect(function()
		TweenService:Create(button, hoverTween, { BackgroundColor3 = Color3.fromRGB(48, 52, 74) }):Play()
	end)
	button.MouseLeave:Connect(function()
		TweenService:Create(button, hoverTween, { BackgroundColor3 = Color3.fromRGB(32, 35, 50) }):Play()
	end)
	button.Activated:Connect(function()
		onPick(mode.Id)
	end)
	return button
end

local function show()
	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	local modeSelected = Remotes.get("ModeSelected")

	local gui = Instance.new("ScreenGui")
	gui.Name = "ModePopup"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.DisplayOrder = 10

	-- CanvasGroup lets the whole popup fade as one piece
	local panel = Instance.new("CanvasGroup")
	panel.Name = "Panel"
	panel.AnchorPoint = Vector2.new(0.5, 0.5)
	panel.Position = UDim2.fromScale(0.5, 0.5)
	panel.Size = UDim2.fromOffset(560, 300)
	panel.BackgroundColor3 = BG
	panel.GroupTransparency = 1
	panel.Parent = gui
	corner(panel, 16)
	stroke(panel, Color3.fromRGB(70, 75, 100), 2)

	-- keeps the popup on-screen on small phones
	local scale = Instance.new("UIScale")
	scale.Scale = 0.85
	scale.Parent = panel
	local viewport = workspace.CurrentCamera and workspace.CurrentCamera.ViewportSize or Vector2.new(1280, 720)
	local fit = math.min(1, (viewport.X - 24) / 560, (viewport.Y - 24) / 300)

	text(panel, {
		Name = "Heading",
		Size = UDim2.new(1, -40, 0, 36),
		Position = UDim2.fromOffset(20, 18),
		Text = "CHOOSE YOUR MODE",
		Font = FONT_BOLD,
		TextSize = 28,
	})
	text(panel, {
		Name = "SubHeading",
		Size = UDim2.new(1, -40, 0, 20),
		Position = UDim2.fromOffset(20, 56),
		Text = Config.GameName,
		Font = FONT_BODY,
		TextSize = 15,
		TextColor3 = Color3.fromRGB(150, 155, 180),
	})

	local row = Instance.new("Frame")
	row.Name = "Modes"
	row.BackgroundTransparency = 1
	row.Position = UDim2.fromOffset(20, 92)
	row.Size = UDim2.new(1, -40, 1, -112)
	row.Parent = panel
	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Horizontal
	layout.Padding = UDim.new(0, 16)
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = row

	local closing = false
	local function close()
		local info = TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
		TweenService:Create(panel, info, { GroupTransparency = 1 }):Play()
		local out = TweenService:Create(scale, info, { Scale = 0.85 * fit })
		out.Completed:Once(function()
			gui:Destroy()
		end)
		out:Play()
	end

	for i, mode in Config.Modes do
		buildModeButton(row, mode, i, function(id: Types.ModeId)
			if closing then
				return
			end
			closing = true
			modeSelected:FireServer(id)
			close()
		end)
	end

	gui.Parent = playerGui
	local info = TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out)
	TweenService:Create(panel, info, { GroupTransparency = 0 }):Play()
	TweenService:Create(scale, info, { Scale = fit }):Play()
end

function ModePopup.start()
	task.wait(Config.PopupDelay)
	show()
end

return ModePopup
