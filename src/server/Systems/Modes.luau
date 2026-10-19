--!strict
-- Receives mode choices from the popup. The client is never trusted: the id is
-- checked against Config and requests are rate limited.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Types = require(Shared:WaitForChild("Types"))

local COOLDOWN = 0.5

local Modes = {}

local selected: { [Player]: Types.ModeId } = {}
local lastRequest: { [Player]: number } = {}

local function isValidMode(id: unknown): boolean
	if typeof(id) ~= "string" then
		return false
	end
	for _, mode in Config.Modes do
		if mode.Id == id then
			return true
		end
	end
	return false
end

function Modes.getSelected(player: Player): Types.ModeId?
	return selected[player]
end

function Modes.init()
	Remotes.get("ModeSelected").OnServerEvent:Connect(function(player: Player, id: unknown)
		local now = os.clock()
		if now - (lastRequest[player] or 0) < COOLDOWN then
			return
		end
		lastRequest[player] = now

		if not isValidMode(id) then
			return
		end
		selected[player] = id :: Types.ModeId
		player:SetAttribute("SelectedMode", id)
	end)

	Players.PlayerRemoving:Connect(function(player: Player)
		selected[player] = nil
		lastRequest[player] = nil
	end)
end

return Modes
