--!strict
local loaded: { [string]: any } = {}
for _, child in script.Systems:GetChildren() do
	if child:IsA("ModuleScript") then
		loaded[child.Name] = require(child)
	end
end

-- two phases: every system is constructed before any starts running
for _, system in loaded do
	if typeof(system.init) == "function" then
		system.init()
	end
end
for _, system in loaded do
	if typeof(system.start) == "function" then
		task.spawn(system.start)
	end
end
