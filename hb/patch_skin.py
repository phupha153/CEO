import bpy, sys, os
bpy.ops.wm.open_mainfile(filepath="/home/claude/hb/hb_char.blend")
a = [float(x) for x in os.environ.get("SK0", "0.30,0.165,0.095").split(",")]; b = [float(x) for x in os.environ.get("SK1", "0.38,0.215,0.13").split(",")]
r = bpy.data.materials["skin"].node_tree.nodes["Color Ramp"].color_ramp
r.elements[0].color = (*a, 1); r.elements[1].color = (*b, 1)
bpy.ops.wm.save_mainfile()
