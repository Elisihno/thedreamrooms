--!strict
local loaded: { [string]: any } = {}
for _, child in script.Controllers:GetChildren() do
	if child:IsA("ModuleScript") then
		loaded[child.Name] = require(child)
	end
end

for _, controller in loaded do
	if typeof(controller.init) == "function" then
		controller.init()
	end
end
for _, controller in loaded do
	if typeof(controller.start) == "function" then
		task.spawn(controller.start)
	end
end
