--!strict
local Types = require(script.Parent.Types)

local Modes: { Types.ModeInfo } = {
	{
		Id = "FFA",
		Name = "Free For All",
		Description = "Every blade for itself. Last one standing wins.",
		Color = Color3.fromRGB(255, 170, 40),
	},
	{
		Id = "Duos",
		Name = "2 vs 2",
		Description = "Team up with a partner and cut down the other duo.",
		Color = Color3.fromRGB(40, 220, 255),
	},
}

return {
	GameName = "Blade Antagonist",
	-- seconds after joining before the mode popup appears
	PopupDelay = 2,
	Modes = Modes,
	Chests = {
		GoldenLabel = "Golden Chest",
		CyberLabel = "Cyber Chest",
	},
}
