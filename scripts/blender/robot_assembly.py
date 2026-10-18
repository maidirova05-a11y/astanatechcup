"""
The hero mascot as a 3D build: every part flies in and locks onto the last,
the robot powers on, the logo pops in between its hands, then it idles.

It is the same robot and the same choreography as
src/components/sections/HeroRobot.tsx, rebuilt in Blender. SVG coordinates map
to Blender as x' = (x - 200) / 50, z' = (384 - y) / 50, with the robot facing -Y.

Run headless:

  blender -b -P scripts/blender/robot_assembly.py -- <out.mp4|out.png> [size] [still-frame]
  blender -b -P scripts/blender/robot_assembly.py -- public/models/robot.glb --export
  blender -b -P scripts/blender/robot_assembly.py -- public/models/robot-poster.png 720 --poster

With a still frame it renders one PNG instead of the video. A .blend of the
scene is always saved next to the output (except for --export / --poster).

--export writes the GLB the website plays (src/components/sections/HeroRobotScene.tsx):
robot, pad, ring, sparks, confetti and the sign, WITHOUT the studio sweep,
camera, lights or world. Only the build (frames 1..T["idle"]) is baked into
the clip; the idle loop, blinks and every glow (beacon, halo, pad ring) are
procedural in three.js, because F-modifier sines do not loop cleanly and
material animation does not survive glTF reliably. The halo sphere is left
out (the page draws it as a sprite) and so is the logo image (the page loads
/brand/astanatechcup.png itself, which keeps the GLB small and avoids a blob:
fetch that the site's CSP would refuse). Mesh resolution is lowered here.

--poster renders the final built frame on a transparent background, from the
same camera the page uses, as the static fallback (no WebGL, reduced motion,
or before three.js has loaded).
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

rad = math.radians

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
EXPORT = "--export" in argv
POSTER = "--poster" in argv
argv = [a for a in argv if not a.startswith("--")]
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.abspath(argv[0] if argv else os.path.join(HERE, "out", "robot.mp4"))
SIZE = int(argv[1]) if len(argv) > 1 else 800
STILL = int(argv[2]) if len(argv) > 2 else None
# Mesh resolution. The web export needs far fewer segments than a render.
RES = 0.5 if EXPORT else 1.0


def seg(n, lo=2):
    return max(lo, round(n * RES))

LOGO = os.path.join(REPO, "public", "brand", "astanatechcup.png")

FPS = 30
END = 240

# The build schedule, in frames. Mirrors `T` in HeroRobot.tsx at 30fps.
T = dict(
    footL=8, footR=11, legs=16, torso=25, armL=35, armR=39, head=48,
    earL=57, earR=60, face=64, eyes=71, smile=77, antenna=80, beacon=87,
    logo=93, confetti=100, idle=115,
)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, END


# ── Materials ────────────────────────────────────────────────────────────────

def lin(hexc, a=1.0):
    h = hexc.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (*[f(v) for v in c], a)


def mat(name, hexc, rough=0.4, emit=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(hexc)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Emission Color"].default_value = lin(hexc)
    b.inputs["Emission Strength"].default_value = emit
    b.inputs["Coat Weight"].default_value = coat
    return m


def emission_mat(name, hexc, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = lin(hexc)
    e.inputs["Strength"].default_value = strength
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


INK = "#00243c"
BODY = mat("Body", "#3d68ff", rough=0.32, coat=0.35)
INKM = mat("Ink", INK, rough=0.45)
WHITE = mat("White", "#ffffff", rough=0.3)
GOLD = mat("Gold", "#fcd800", rough=0.3)
BEACON = mat("Beacon", "#fcd800", rough=0.3)
CHEEK = mat("Cheek", "#e86bf0", rough=0.6, emit=0.3)
PAD = mat("Pad", "#d3ddf2", rough=0.55)
RING = mat("Ring", "#3d68ff", rough=0.4)
SWEEP = mat("Sweep", "#eef3fc", rough=0.9)
SPARK_GOLD = emission_mat("SparkGold", "#fcd800", 4.0)
SPARK_BLUE = emission_mat("SparkBlue", "#3d68ff", 4.0)

# Inverted-hull outline: the ink stroke that every SVG part has.
OUTLINE = emission_mat("Outline", INK, 1.0)
OUTLINE.use_backface_culling = True

# Antenna halo: additive glow that fades towards its silhouette.
HALO = bpy.data.materials.new("Halo")
HALO.use_nodes = True
nt = HALO.node_tree
nt.nodes.clear()
glow = nt.nodes.new("ShaderNodeValue")
glow.name = "Glow"
glow.outputs[0].default_value = 0.0
lw = nt.nodes.new("ShaderNodeLayerWeight")
lw.inputs["Blend"].default_value = 0.35
pw = nt.nodes.new("ShaderNodeMath")
pw.operation = "POWER"
pw.inputs[1].default_value = 3.0
inv = nt.nodes.new("ShaderNodeMath")
inv.operation = "SUBTRACT"
inv.inputs[0].default_value = 1.0
mul = nt.nodes.new("ShaderNodeMath")
mul.operation = "MULTIPLY"
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = lin("#ffe23a")
tr = nt.nodes.new("ShaderNodeBsdfTransparent")
add = nt.nodes.new("ShaderNodeAddShader")
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(lw.outputs["Facing"], inv.inputs[1])
nt.links.new(inv.outputs[0], pw.inputs[0])
nt.links.new(pw.outputs[0], mul.inputs[0])
nt.links.new(glow.outputs[0], mul.inputs[1])
nt.links.new(mul.outputs[0], em.inputs["Strength"])
nt.links.new(tr.outputs[0], add.inputs[0])
nt.links.new(em.outputs[0], add.inputs[1])
nt.links.new(add.outputs[0], out.inputs[0])
try:
    HALO.surface_render_method = "BLENDED"
except AttributeError:
    HALO.blend_method = "BLEND"

# Logo: the PNG over white, so its transparent plate reads as the sign face.
LOGO_MAT = bpy.data.materials.new("Logo")
LOGO_MAT.use_nodes = True
nt = LOGO_MAT.node_tree
b = nt.nodes["Principled BSDF"]
b.inputs["Roughness"].default_value = 0.35
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(LOGO)
tex.extension = "CLIP"
mix = nt.nodes.new("ShaderNodeMix")
mix.data_type = "RGBA"
mix.inputs["A"].default_value = (1, 1, 1, 1)
nt.links.new(tex.outputs["Alpha"], mix.inputs["Factor"])
nt.links.new(tex.outputs["Color"], mix.inputs["B"])
nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])


# ── Geometry helpers ─────────────────────────────────────────────────────────

def link(o):
    sc.collection.objects.link(o)
    return o


def parent(o, p):
    bpy.context.view_layer.update()
    o.parent = p
    o.matrix_parent_inverse = p.matrix_world.inverted()


def empty(name, loc, par=None):
    e = link(bpy.data.objects.new(name, None))
    e.location = loc
    e.empty_display_size = 0.3
    if par:
        parent(e, par)
    return e


def outline(o, t):
    o.data.materials.append(OUTLINE)
    s = o.modifiers.new("Outline", "SOLIDIFY")
    s.thickness = t
    s.offset = 1.0
    s.use_flip_normals = True
    s.use_rim = False
    s.material_offset = len(o.data.materials) - 1


def finish(o, m, par, ol, bev=0.0, seg=4):
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    if bev:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bev
        b.segments = max(1, round(seg * RES)) if EXPORT else seg
        b.limit_method = "ANGLE"
        b.angle_limit = rad(40)
        b.harden_normals = True
    if ol:
        outline(o, ol)
    if par:
        parent(o, par)
    return o


def plate(name, w, d, h, r, loc, m, par, ol=0.05, bev=0.12):
    """A box rounded in the picture plane (XZ) like an SVG rect with rx."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= d
        v.co.z *= h
    edges = [
        e for e in bm.edges
        if abs((e.verts[0].co - e.verts[1].co).normalized().y) > 0.9
    ]
    bmesh.ops.bevel(
        bm, geom=edges, offset=r, offset_type="OFFSET", segments=seg(12, 4),
        profile=0.5, affect="EDGES",
    )
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    o.location = loc
    return finish(o, m, par, ol, bev)


def select_only(o):
    for x in bpy.context.selected_objects:
        x.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


def cyl(name, r, depth, loc, m, par, rot=(0, 0, 0), ol=0.05, bev=0.04):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=seg(48, 16), radius=r, depth=depth, location=loc, rotation=rot
    )
    o = bpy.context.active_object
    o.name = name
    return finish(o, m, par, ol, bev, seg=3)


def sph(name, r, loc, m, par, scale=(1, 1, 1), ol=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg(48, 16), ring_count=seg(24, 8), radius=r, location=loc
    )
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, m, par, ol)


def box(name, size, loc, m, par, rot=(0, 0, 0), ol=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, m, par, ol, bev=min(size) * 0.3, seg=2)


def curve(name, pts, r, m, par, to_mesh=True, ol=0.05):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = seg(6, 3)
    cu.resolution_u = seg(24, 8)
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = link(bpy.data.objects.new(name, cu))
    if to_mesh:
        select_only(o)
        bpy.ops.object.convert(target="MESH")
        o = bpy.context.active_object
        return finish(o, m, par, ol)
    o.data.materials.append(m)
    if par:
        parent(o, par)
    return o


# ── The robot ────────────────────────────────────────────────────────────────

root = empty("Robot", (0, 0, -0.12))

# Feet
footL = empty("FootL", (-0.66, -0.1, 0.46), root)
plate("FootL_mesh", 1.4, 1.2, 0.6, 0.28, (-0.66, -0.1, 0.46), INKM, footL, bev=0.14)
footR = empty("FootR", (0.66, -0.1, 0.46), root)
plate("FootR_mesh", 1.4, 1.2, 0.6, 0.28, (0.66, -0.1, 0.46), INKM, footR, bev=0.14)

# Legs
legs = empty("Legs", (0, 0, 1.02), root)
for s in (-1, 1):
    cyl(f"Leg{s}", 0.3, 0.9, (0.58 * s, 0, 1.02), INKM, legs, ol=0, bev=0.1)

# Torso with the chest panel and its power core
torso = empty("Torso", (0, 0, 2.96), root)
plate("Torso_mesh", 2.08, 1.4, 3.44, 0.68, (0, 0, 2.96), BODY, torso, bev=0.28)
plate("Chest", 1.2, 0.1, 1.44, 0.28, (0, -0.72, 3.04), WHITE, torso, ol=0.035, bev=0.03)
cyl("Core", 0.22, 0.08, (0, -0.79, 3.24), GOLD, torso, rot=(rad(90), 0, 0), ol=0.035, bev=0.02)
box("ChestLine", (0.64, 0.05, 0.08), (0, -0.78, 2.68), INKM, torso)

# Arms, each with its hand, reaching forward to grip the sign's edge
SIGN_Y = -1.25
SIGN_Z = 2.96
arms = {}
for side, s in (("L", -1), ("R", 1)):
    arm = empty(f"Arm{side}", (0.95 * s, 0, 3.7), root)
    curve(
        f"Arm{side}_mesh",
        [(0.85 * s, 0, 3.7), (2.0 * s, -0.2, 3.78), (2.8 * s, -0.85, 3.35), (3.0 * s, SIGN_Y, SIGN_Z + 0.2)],
        0.2, BODY, arm,
    )
    plate(f"Hand{side}", 0.62, 0.66, 0.96, 0.24, (3.02 * s, SIGN_Y, SIGN_Z), BODY, arm, bev=0.12)
    box(f"Knuckle{side}", (0.06, 0.06, 0.34), (3.02 * s + 0.12 * s, SIGN_Y - 0.36, SIGN_Z), INKM, arm)
    arms[side] = arm

# Head: pivots at the neck so the idle tilt reads as a nod
head = empty("Head", (0, 0, 4.72), root)
plate("Head_mesh", 2.96, 2.0, 2.36, 0.76, (0, 0, 5.9), BODY, head, bev=0.26)

ears = {}
for side, s in (("L", -1), ("R", 1)):
    ear = empty(f"Ear{side}", (1.6 * s, 0, 5.92), head)
    cyl(f"Ear{side}_mesh", 0.44, 0.42, (1.64 * s, 0, 5.92), BODY, ear, rot=(0, rad(90), 0), bev=0.1)
    ears[side] = ear

face = empty("Face", (0, -1.02, 5.9), head)
plate("Face_mesh", 2.16, 0.12, 1.48, 0.56, (0, -1.02, 5.9), WHITE, face, ol=0.045, bev=0.04)

eyes = {}
for side, s in (("L", -1), ("R", 1)):
    eye = empty(f"Eye{side}", (0.44 * s, -1.1, 6.0), head)
    sph(f"Eye{side}_mesh", 0.27, (0.44 * s, -1.1, 6.0), INKM, eye, scale=(1, 0.35, 1))
    sph(f"Glint{side}", 0.095, (0.44 * s + 0.09, -1.19, 6.09), WHITE, eye, scale=(1, 0.5, 1))
    eyes[side] = eye

SMILE_PTS = [(-0.36, -1.1, 5.62), (0, -1.1, 5.44), (0.36, -1.1, 5.62)]
if EXPORT:
    # glTF cannot carry a curve's bevel factor, so the smile is a mesh under
    # an empty that "draws" it by growing from its centre.
    smile = empty("Smile", (0, -1.1, 5.53), head)
    curve("Smile_mesh", SMILE_PTS, 0.07, INKM, smile, ol=0)
else:
    smile = curve("Smile", SMILE_PTS, 0.07, INKM, head, to_mesh=False)
cheeks = empty("Cheeks", (0, -1.09, 5.6), head)
for s in (-1, 1):
    cyl(f"Cheek{s}", 0.15, 0.02, (0.8 * s, -1.1, 5.6), CHEEK, cheeks, rot=(rad(90), 0, 0), ol=0, bev=0)

antenna = empty("Antenna", (0, 0, 7.0), head)
cyl("Stem", 0.07, 0.5, (0, 0, 7.25), INKM, antenna, ol=0, bev=0.02)
sph("Ball", 0.21, (0, 0, 7.52), BEACON, antenna, ol=0.045)
if not EXPORT:
    sph("Halo", 0.42, (0, 0, 7.52), HALO, antenna)

# The sign the robot presents
sign = empty("Sign", (0, SIGN_Y, SIGN_Z), root)
plate("SignPlate", 6.24, 0.14, 2.64, 0.5, (0, SIGN_Y, SIGN_Z), WHITE, sign, ol=0.05, bev=0.04)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, SIGN_Y - 0.075, SIGN_Z), rotation=(rad(90), 0, 0))
logo = bpy.context.active_object
logo.name = "Logo"
logo.scale = (6.0, 6.0 / (1200 / 506), 1)
logo.data.materials.append(LOGO_MAT)
parent(logo, sign)

# ── Stage ────────────────────────────────────────────────────────────────────

cyl("Pad", 2.6, 0.06, (0, 0, -0.03), PAD, None, ol=0, bev=0.03)
bm = bmesh.new()
for i in range(28):
    a = i * 2 * math.pi / 28
    g = bmesh.ops.create_cube(bm, size=1)
    vs = g["verts"]
    for v in vs:
        v.co.x *= 0.38
        v.co.y *= 0.08
        v.co.z *= 0.03
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(a + math.pi / 2, 3, "Z"))
    bmesh.ops.translate(bm, verts=vs, vec=(2.95 * math.cos(a), 2.95 * math.sin(a), 0.02))
me = bpy.data.meshes.new("Ring")
bm.to_mesh(me)
bm.free()
ring = link(bpy.data.objects.new("Ring", me))
ring.data.materials.append(RING)

# Studio sweep: floor curving up into the backdrop
prof = [(-40, 0)]
R = 6
for i in range(13):
    a = i / 12 * math.pi / 2
    prof.append((8 + R * math.sin(a), R - R * math.cos(a)))
prof.append((8 + R, 30))
bm = bmesh.new()
cols = []
for x in (-40, 40):
    cols.append([bm.verts.new((x, y, z)) for y, z in prof])
for i in range(len(prof) - 1):
    bm.faces.new((cols[0][i], cols[1][i], cols[1][i + 1], cols[0][i + 1]))
me = bpy.data.meshes.new("Sweep")
bm.to_mesh(me)
bm.free()
sweep = link(bpy.data.objects.new("Sweep", me))
sweep.data.materials.append(SWEEP)
for p in sweep.data.polygons:
    p.use_smooth = True


# ── Animation helpers ────────────────────────────────────────────────────────

def fcurves(idb):
    ad = idb.animation_data
    act = ad.action
    try:
        from bpy_extras import anim_utils

        cb = anim_utils.action_get_channelbag_for_slot(act, ad.action_slot)
        if cb:
            return list(cb.fcurves)
    except (ImportError, AttributeError):
        pass
    return list(act.fcurves)


def interp(idb, path, frame, kind, easing="EASE_OUT", back=None):
    for f in fcurves(idb):
        if f.data_path != path:
            continue
        for k in f.keyframe_points:
            if abs(k.co.x - frame) < 0.01:
                k.interpolation = kind
                k.easing = easing
                if back is not None:
                    k.back = back


def wave(idb, path, idx, amp, period, start, blend=20, phase=0.0):
    """An endless additive sine from `start` on — the idle motion."""
    if EXPORT:
        return  # the page runs the idle itself
    f = next(f for f in fcurves(idb) if f.data_path == path and f.array_index == idx)
    m = f.modifiers.new("FNGENERATOR")
    m.function_type = "SIN"
    m.use_additive = True
    m.amplitude = amp
    m.phase_multiplier = 2 * math.pi / period
    m.phase_offset = -m.phase_multiplier * start + phase
    m.use_restricted_range = True
    m.frame_start = start
    m.frame_end = 100000
    m.blend_in = blend


# "Hidden" is a tiny scale, never 0: a parent at scale 0 has no inverse, and
# the glTF exporter then bakes its children at scale 0 for the whole clip.
HIDDEN = 1e-4


def hidden_until(o, f, scale_from=(1, 1, 1)):
    o.scale = (HIDDEN,) * 3
    o.keyframe_insert("scale", frame=1)
    o.keyframe_insert("scale", frame=f - 1)
    o.scale = scale_from
    o.keyframe_insert("scale", frame=f)
    interp(o, "scale", 1, "CONSTANT")
    interp(o, "scale", f - 1, "CONSTANT")


def fly(o, f, dur=14, off=(0, 0, 0), rot=(0, 0, 0), s=1.0, back=1.5):
    """Hidden until `f`, then springs from an offset into its seat."""
    rest_l = o.location.copy()
    rest_r = o.rotation_euler.copy()
    hidden_until(o, f, (s, s, s))
    o.scale = (1, 1, 1)
    o.keyframe_insert("scale", frame=f + dur)
    interp(o, "scale", f, "BACK", back=back)

    o.location = rest_l + Vector(off)
    o.keyframe_insert("location", frame=f)
    o.location = rest_l
    o.keyframe_insert("location", frame=f + dur)
    interp(o, "location", f, "BACK", back=back)

    o.rotation_euler = (rest_r.x + rad(rot[0]), rest_r.y + rad(rot[1]), rest_r.z + rad(rot[2]))
    o.keyframe_insert("rotation_euler", frame=f)
    o.rotation_euler = rest_r
    o.keyframe_insert("rotation_euler", frame=f + dur)
    interp(o, "rotation_euler", f, "BACK", back=back)
    return f + round(dur * 0.55)


def spark(loc, f):
    """A small burst at the joint where a part lands."""
    e = empty("Spark", loc)
    for i in range(8):
        a = i * math.pi / 4
        box(
            f"Ray{i}", (0.07, 0.07, 0.34),
            (loc[0] + 0.62 * math.cos(a), loc[1], loc[2] + 0.62 * math.sin(a)),
            SPARK_GOLD if i % 2 == 0 else SPARK_BLUE, e, rot=(0, math.pi / 2 - a, 0),
        )
    sph("SparkCore", 0.13, loc, SPARK_GOLD, e)
    hidden_until(e, f, (0.2, 0.2, 0.2))
    e.scale = (1.15, 1.15, 1.15)
    e.keyframe_insert("scale", frame=f + 3)
    e.scale = (HIDDEN,) * 3
    e.keyframe_insert("scale", frame=f + 10)
    interp(e, "scale", f + 3, "QUAD", "EASE_IN")
    e.rotation_euler = (0, 0, 0)
    e.keyframe_insert("rotation_euler", frame=f)
    e.rotation_euler = (0, rad(35), 0)
    e.keyframe_insert("rotation_euler", frame=f + 10)


def key_value(socket, frames):
    if EXPORT:
        return  # glows are driven by the page
    for fr, v in frames:
        socket.default_value = v
        socket.keyframe_insert("default_value", frame=fr)


# ── The build ────────────────────────────────────────────────────────────────

F = -1.4  # sparks sit in front of the part, towards the camera
spark((-0.66, F, 0.2), fly(footL, T["footL"], off=(-3.5, -1.5, 1.8), rot=(0, 30, -45)))
spark((0.66, F, 0.2), fly(footR, T["footR"], off=(3.5, -1.5, 1.8), rot=(0, -30, 45)))
spark((0, F, 1.55), fly(legs, T["legs"], off=(0, 0, 4.5)))
spark((0, F, 4.6), fly(torso, T["torso"], dur=16, off=(0, 0, 6.5), rot=(0, -12, 30)))
spark((-1.0, F, 3.7), fly(arms["L"], T["armL"], off=(-3.0, -1.0, 1.2), rot=(0, 25, -40)))
spark((1.0, F, 3.7), fly(arms["R"], T["armR"], off=(3.0, -1.0, 1.2), rot=(0, -25, 40)))
spark((0, F, 4.65), fly(head, T["head"], dur=18, off=(0, 0, 6.5), rot=(0, 0, 360)))
spark((-1.75, F + 0.4, 5.92), fly(ears["L"], T["earL"], dur=10, off=(-2.5, 0, 0)))
spark((1.75, F + 0.4, 5.92), fly(ears["R"], T["earR"], dur=10, off=(2.5, 0, 0)))
fly(face, T["face"], dur=10, off=(0, -2.0, 0), s=0.3, back=2.0)

# Power-on: eyes open, smile draws itself, cheeks, antenna, beacon.
for i, eye in enumerate(eyes.values()):
    f = T["eyes"] + i * 2
    hidden_until(eye, f, (1, 1, 0.05))
    eye.scale = (1, 1, 1)
    eye.keyframe_insert("scale", frame=f + 6)
    interp(eye, "scale", f, "BACK", back=2.0)
    for b in (() if EXPORT else (150, 205)):  # blinks during the idle
        eye.scale = (1, 1, 1)
        eye.keyframe_insert("scale", frame=b)
        eye.scale = (1, 1, 0.08)
        eye.keyframe_insert("scale", frame=b + 3)
        eye.scale = (1, 1, 1)
        eye.keyframe_insert("scale", frame=b + 6)

if EXPORT:
    hidden_until(smile, T["smile"], (0.02, 1, 0.6))
    smile.scale = (1, 1, 1)
    smile.keyframe_insert("scale", frame=T["smile"] + 8)
    interp(smile, "scale", T["smile"], "QUAD", "EASE_OUT")
else:
    smile.data.bevel_factor_end = 0.0
    smile.data.keyframe_insert("bevel_factor_end", frame=T["smile"])
    smile.data.bevel_factor_end = 1.0
    smile.data.keyframe_insert("bevel_factor_end", frame=T["smile"] + 8)
fly(cheeks, T["smile"] + 5, dur=8, s=HIDDEN, back=2.0)
spark((0, F + 0.3, 7.5), fly(antenna, T["antenna"], dur=10, off=(0, 0, -0.65), back=2.2))

bsock = BEACON.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
key_value(bsock, [(1, 0), (T["beacon"], 0), (T["beacon"] + 3, 6), (T["beacon"] + 10, 2.5)])
gsock = HALO.node_tree.nodes["Glow"].outputs[0]
key_value(gsock, [(1, 0), (T["beacon"], 0), (T["beacon"] + 3, 8), (T["beacon"] + 10, 3)])
wave(BEACON.node_tree, bsock.path_from_id("default_value"), 0, 1.2, 40, T["beacon"] + 10)
wave(HALO.node_tree, gsock.path_from_id("default_value"), 0, 1.6, 40, T["beacon"] + 10)

rsock = RING.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
key_value(rsock, [(1, 0), (T["logo"], 0), (T["logo"] + 4, 8), (T["logo"] + 14, 3)])
wave(RING.node_tree, rsock.path_from_id("default_value"), 0, 1.2, 50, T["logo"] + 14)

# The logo lands last and overshoots: built, then presenting.
fly(sign, T["logo"], dur=12, off=(0, -1.0, 0), rot=(0, -20, 0), s=HIDDEN, back=2.4)

COLORS = ["#3d68ff", "#fcd800", "#c118cf", "#0024a8", "#fcd800", "#c118cf",
          "#3d68ff", "#c118cf", "#fcd800", "#00243c", "#0024a8", "#00243c"]
CONFETTI = [(-190, -120), (-120, -170), (-30, -190), (70, -180), (160, -140), (210, -40),
            (190, 90), (-200, 60), (-150, 140), (120, 150), (-60, 170), (30, -120)]
cmats = {}
for i, ((dx, dy), c) in enumerate(zip(CONFETTI, COLORS)):
    m = cmats.setdefault(c, mat(f"Confetti{c}", c, rough=0.4, emit=0.4))
    start = Vector((0, SIGN_Y - 0.3, SIGN_Z))
    p = box(f"Confetti{i}", (0.2, 0.06, 0.2), start, m, None)
    f = T["confetti"] + (i % 4)
    hidden_until(p, f)
    p.keyframe_insert("scale", frame=f + 20)
    p.scale = (HIDDEN,) * 3
    p.keyframe_insert("scale", frame=f + 30)
    p.location = start
    p.keyframe_insert("location", frame=f)
    end = start + Vector((dx / 40, -0.6 - (i % 3) * 0.5, -dy / 40))
    p.location = end
    p.keyframe_insert("location", frame=f + 16)
    p.location = end + Vector((0, 0, -1.6))
    p.keyframe_insert("location", frame=f + 30)
    interp(p, "location", f, "QUAD", "EASE_OUT")
    interp(p, "location", f + 16, "QUAD", "EASE_IN")
    p.rotation_euler = (0, 0, 0)
    p.keyframe_insert("rotation_euler", frame=f)
    p.rotation_euler = (rad(dx * 2), rad(dy * 2), rad(dx + dy))
    p.keyframe_insert("rotation_euler", frame=f + 30)

# ── Idle: float, sway, nod, antenna wobble ───────────────────────────────────

I = T["idle"]
root.keyframe_insert("location", frame=1)
root.keyframe_insert("rotation_euler", frame=1)
wave(root, "location", 2, 0.14, 80, I, blend=30)
wave(root, "rotation_euler", 2, rad(7), 160, I, blend=40)
wave(head, "rotation_euler", 1, rad(4), 110, I, blend=30)
wave(antenna, "rotation_euler", 1, rad(8), 55, I, blend=20)
for side, s in (("L", -1), ("R", 1)):
    wave(ears[side], "rotation_euler", 0, rad(10), 70, I, blend=20, phase=s)

# ── Camera and light ─────────────────────────────────────────────────────────

# The website's camera (CAMERA in HeroRobotScene.tsx) is this one with a
# slightly longer lens and lower target, so the robot fills the hero stage.
# The poster is rendered through it so it lines up with the live 3D.
WEB_LENS, WEB_TARGET_Z = 69, 3.5
target = empty("CamTarget", (0, 0, WEB_TARGET_Z if POSTER else 3.7))
pivot = empty("CamPivot", (0, 0, 0))
cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = WEB_LENS if POSTER else 55
cam = link(bpy.data.objects.new("Camera", cam_data))
cam.location = (5.0, -16.5, 6.4)
parent(cam, pivot)
tc = cam.constraints.new("TRACK_TO")
tc.target = target
sc.camera = cam

pivot.rotation_euler = (0, 0, rad(-38))
pivot.keyframe_insert("rotation_euler", frame=1)
pivot.rotation_euler = (0, 0, rad(4))
pivot.keyframe_insert("rotation_euler", frame=I)
interp(pivot, "rotation_euler", 1, "SINE", "EASE_IN_OUT")
wave(pivot, "rotation_euler", 2, rad(5), 240, I, blend=40)


def light(name, loc, power, size, color="#ffffff"):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = power
    ld.size = size
    ld.color = lin(color)[:3]
    lo = link(bpy.data.objects.new(name, ld))
    lo.location = loc
    c = lo.constraints.new("TRACK_TO")
    c.target = target
    return lo


light("Key", (-7, -9, 11), 3200, 6)
light("Fill", (10, -7, 4), 1200, 9, "#dfe8ff")
light("Rim", (3, 7, 10), 2600, 4, "#cfe0ff")

world = bpy.data.worlds.new("World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = lin("#eef3fc")
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.world = world

# ── Render ───────────────────────────────────────────────────────────────────

sc.render.engine = "BLENDER_EEVEE"
sc.eevee.taa_render_samples = 64
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.resolution_percentage = 100
try:
    sc.view_settings.view_transform = "Standard"
except TypeError:
    pass

os.makedirs(os.path.dirname(OUT), exist_ok=True)

if EXPORT:
    for o in list(sc.objects):
        if o.type in {"CAMERA", "LIGHT"} or o.name in {"Sweep", "CamTarget", "CamPivot"}:
            bpy.data.objects.remove(o, do_unlink=True)
    # Only the build is baked; frame 1 is t = 0 in the clip.
    sc.frame_start, sc.frame_end = 1, T["idle"]
    # Fold every parent inverse into the child's own transform. Parts are
    # parented while their empties sit at rest, so the inverse is a constant;
    # left in place, the exporter derives the child's local transform from
    # world matrices at the current frame, and a parent keyed to scale 0 there
    # (every part before it lands, every spark) collapses its meshes for good.
    for o in sc.objects:
        if o.parent and o.animation_data is None:
            o.matrix_basis = o.matrix_parent_inverse @ o.matrix_basis
            o.matrix_parent_inverse.identity()
    sc.frame_set(T["idle"])
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        export_apply=True,
        export_image_format="NONE",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_animations=True,
        export_frame_range=True,
        # Rest transforms from the built robot (frame T.idle), where every part
        # sits at scale 1; frame 1 has them all hidden and loses precision.
        export_current_frame=True,
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_animation_mode="ACTIVE_ACTIONS",
        export_def_bones=False,
        export_extras=False,
    )
    print(f"GLB: {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)")
    sys.exit(0)

if POSTER:
    # Transparent final frame; the page supplies its own background.
    sweep.hide_render = True
    for o in sc.objects:  # confetti is still falling at the final build frame
        if o.name.startswith("Confetti"):
            o.hide_render = True
    sc.render.film_transparent = True
    STILL = T["idle"]
else:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(OUT)[0] + ".blend")

im = sc.render.image_settings
if STILL is not None:
    im.media_type = "IMAGE"
    im.file_format = "PNG"
    im.color_mode = "RGBA" if POSTER else "RGB"
    im.compression = 100
    sc.frame_set(STILL)
    sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
else:
    im.media_type = "VIDEO"
    im.file_format = "FFMPEG"
    ff = sc.render.ffmpeg
    ff.format = "MPEG4"
    ff.codec = "H264"
    ff.constant_rate_factor = "HIGH"
    ff.ffmpeg_preset = "GOOD"
    sc.render.filepath = OUT
    bpy.ops.render.render(animation=True)
