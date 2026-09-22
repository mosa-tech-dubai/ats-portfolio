#!/usr/bin/env python3
"""
Local, GPU-free previs pipeline: turns still images into a low-res "fake
motion" video per shot (Ken Burns-style pan/zoom via ffmpeg), instead of
true AI video diffusion. Runs on any machine -- CPU only, no CUDA, no
RunPod, no cost -- because it never runs a video generation model at all.

Why this exists: LTXVideo/Wan/HunyuanVideo (the models the RunPod path in
this kit targets) need a CUDA GPU with real VRAM. An integrated GPU (e.g.
Intel UHD 620) cannot run them at any resolution -- that's a missing-CUDA
problem, not a "too slow" problem. This script sidesteps video diffusion
entirely: you supply one still image per shot (from any free image tool,
a photo, anything), and ffmpeg's zoompan/xfade filters synthesize the
camera movement in software. It is intentionally a *lower-fidelity*
substitute for real AI-generated motion, meant only for testing pacing,
story order, and tone before spending anything on real generation.

Every shot's parameters are logged to shots/manifest.json (still used,
pan direction, resolution, duration, timestamp, plus the shot's original
AI-video prompt carried over from shot_list.json) specifically so a later
higher-fidelity pass -- RunPod/ComfyUI image-to-video using the same
still as the reference frame -- can pick up exactly where this left off,
shot-for-shot, without re-deriving anything.

Usage:
  python scripts/local_previs.py \\
      --shot-list shot_list.json \\
      --stills-dir stills \\
      --out-dir shots \\
      --resolution 640x360

Each shot needs a still image at <stills-dir>/<shot_id>.png (or .jpg).
Shots with needs_reference=true fall back to <stills-dir>/character_reference.png
if no shot-specific still exists, so the 6 character-locked shots can all
share one reference image if you only generated one.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

PAN_DIRECTIONS = ["in", "out", "left", "right"]


def find_still(stills_dir: Path, shot: dict) -> Path | None:
    shot_id = shot["id"]
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        candidate = stills_dir / f"{shot_id}{ext}"
        if candidate.exists():
            return candidate
    if shot.get("needs_reference"):
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            candidate = stills_dir / f"character_reference{ext}"
            if candidate.exists():
                return candidate
    return None


def zoompan_filter(direction: str, width: int, height: int, duration_s: float, fps: int) -> str:
    """Build an ffmpeg zoompan filter string for a simple Ken Burns move.
    zoompan operates on the *scaled-up* source frame so panning has room
    to move without hitting the source edges."""
    frames = max(1, int(round(duration_s * fps)))
    # Pre-scale to 3x the output width -- enough headroom for zoompan's pan/zoom
    # window to move smoothly without visible stepping, at a fraction of the cost
    # of the commonly-cited "scale=8000" trick (~10x faster in testing, same
    # visual result at these output resolutions). Matters on modest/older CPUs
    # since this whole pipeline is intentionally CPU-only, no GPU required.
    prescale_width = width * 3
    if direction == "in":
        z_expr = "min(zoom+0.0015,1.15)"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"
    elif direction == "out":
        z_expr = "if(eq(on,0),1.15,max(zoom-0.0015,1.0))"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"
    elif direction == "left":
        z_expr = "1.15"
        x_expr = f"(iw-iw/zoom)*(1-on/{frames})"
        y_expr = "ih/2-(ih/zoom/2)"
    else:  # right
        z_expr = "1.15"
        x_expr = f"(iw-iw/zoom)*(on/{frames})"
        y_expr = "ih/2-(ih/zoom/2)"
    return (
        f"scale={prescale_width}:-1,zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}':"
        f"d={frames}:s={width}x{height}:fps={fps}"
    )


def render_shot(still: Path, out_path: Path, direction: str, width: int, height: int,
                 duration_s: float, fps: int) -> None:
    vf = zoompan_filter(direction, width, height, duration_s, fps)
    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-i", str(still),
        "-vf", vf, "-t", str(duration_s),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {still}: {result.stderr[-2000:]}")


def concat_with_crossfade(clip_paths: list[Path], out_path: Path, fps: int, xfade_s: float = 0.5) -> None:
    """Concatenate clips with a short crossfade between each pair using ffmpeg's
    xfade filter, chained left-to-right."""
    if len(clip_paths) == 1:
        subprocess.run(["ffmpeg", "-y", "-i", str(clip_paths[0]), "-c", "copy", str(out_path)],
                        capture_output=True, text=True)
        return

    inputs: list[str] = []
    for p in clip_paths:
        inputs += ["-i", str(p)]

    filter_parts = []
    prev_label = "0:v"
    cumulative_offset = 0.0
    durations = []
    for p in clip_paths:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(p)],
            capture_output=True, text=True,
        )
        durations.append(float(probe.stdout.strip() or 0.0))

    for i in range(1, len(clip_paths)):
        cumulative_offset += durations[i - 1] - xfade_s
        out_label = f"v{i}"
        filter_parts.append(
            f"[{prev_label}][{i}:v]xfade=transition=fade:duration={xfade_s}:"
            f"offset={max(cumulative_offset, 0):.3f}[{out_label}]"
        )
        prev_label = out_label

    filter_complex = ";".join(filter_parts)
    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", filter_complex,
        "-map", f"[{prev_label}]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(fps),
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg concat/crossfade failed: {result.stderr[-2000:]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot-list", default="shot_list.json")
    ap.add_argument("--stills-dir", default="stills")
    ap.add_argument("--out-dir", default="shots")
    ap.add_argument("--resolution", default="640x360", help="WIDTHxHEIGHT, e.g. 640x360 for low-res previs")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--only", help="Comma-separated shot ids to (re)render, default: all")
    ap.add_argument("--no-concat", action="store_true", help="Skip building the stitched trailer_previs.mp4")
    args = ap.parse_args()

    width, height = (int(x) for x in args.resolution.lower().split("x"))

    stills_dir = Path(args.stills_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(args.shot_list) as f:
        shot_list = json.load(f)

    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"shots": {}}

    only = set(args.only.split(",")) if args.only else None
    rendered_paths: list[Path] = []
    missing_stills: list[str] = []

    for i, shot in enumerate(shot_list["shots"]):
        if only and shot["id"] not in only:
            existing = manifest.get("shots", {}).get(shot["id"], {}).get("file")
            if existing and Path(existing).exists():
                rendered_paths.append(Path(existing))
            continue

        still = find_still(stills_dir, shot)
        if still is None:
            missing_stills.append(shot["id"])
            print(f"[{shot['id']}] SKIP: no still found at {stills_dir}/{shot['id']}.png "
                  f"(or character_reference.* if needs_reference)")
            continue

        direction = PAN_DIRECTIONS[i % len(PAN_DIRECTIONS)]
        out_path = out_dir / f"{shot['id']}_previs.mp4"
        print(f"[{shot['id']}] rendering {args.resolution} pan={direction} "
              f"dur={shot['duration_s']}s from {still.name} ...")
        try:
            render_shot(still, out_path, direction, width, height, shot["duration_s"], args.fps)
        except Exception as e:
            print(f"[{shot['id']}] FAILED: {e}", file=sys.stderr)
            manifest.setdefault("shots", {})[shot["id"]] = {"status": "error", "error": str(e)}
            continue

        rendered_paths.append(out_path)
        manifest.setdefault("shots", {})[shot["id"]] = {
            "status": "previs-lowres",
            "file": str(out_path),
            "source_still": str(still),
            "resolution": args.resolution,
            "pan_direction": direction,
            "duration_s": shot["duration_s"],
            "beat": shot.get("beat"),
            "ai_video_prompt": shot["prompt"],  # carried over for the future hi-res pass
            "needs_reference": shot.get("needs_reference", False),
            "rendered_at": time.time(),
        }
        manifest_path.write_text(json.dumps(manifest, indent=2))
        print(f"[{shot['id']}] done -> {out_path}")

    if missing_stills:
        print(f"\n{len(missing_stills)} shot(s) skipped, no still image yet: {', '.join(missing_stills)}")
        print(f"Generate one still per shot (any free image tool) and save it to "
              f"{stills_dir}/<shot_id>.png, then re-run.")

    if rendered_paths and not args.no_concat:
        trailer_path = out_dir / "trailer_previs.mp4"
        print(f"\nStitching {len(rendered_paths)} clips -> {trailer_path} ...")
        try:
            concat_with_crossfade(rendered_paths, trailer_path, args.fps)
            manifest["trailer_previs"] = str(trailer_path)
            manifest_path.write_text(json.dumps(manifest, indent=2))
            print(f"Done -> {trailer_path}")
        except Exception as e:
            print(f"Stitch FAILED (individual clips are still fine): {e}", file=sys.stderr)

    print(f"\nManifest: {manifest_path}")
    print("Every entry logs the source still, pan params, and the original AI-video "
          "prompt from shot_list.json, so a later hi-res pass (RunPod/ComfyUI "
          "image-to-video, using the same still as the reference frame) can pick "
          "up shot-by-shot without re-deriving anything.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
