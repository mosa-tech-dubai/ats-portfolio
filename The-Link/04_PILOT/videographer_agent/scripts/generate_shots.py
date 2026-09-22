#!/usr/bin/env python3
"""
Orchestrates generation of every shot in shot_list.json against a running
ComfyUI pod, with a hard wall-clock budget so a stuck/looping generation
can never turn into a runaway RunPod bill.

Usage:
  python generate_shots.py \\
      --server-url https://<pod-id>-8188.proxy.runpod.net \\
      --workflow-t2v workflows/t2v_api.json \\
      --workflow-i2v workflows/i2v_api.json \\
      --reference-image shots/reference.png \\
      --shot-list shot_list.json \\
      --out-dir shots \\
      --hourly-rate 0.34 \\
      --max-runtime-min 90

Behavior:
  - Shots with needs_reference=false use --workflow-t2v (text-to-video).
  - Shots with needs_reference=true use --workflow-i2v (image-to-video),
    with --reference-image uploaded and wired into the REFERENCE_IMAGE node.
  - Progress + running cost estimate is written to manifest.json in --out-dir
    after every shot, so a killed run can be inspected or resumed.
  - If elapsed wall-clock time exceeds --max-runtime-min, the script stops
    submitting new shots (already-running generation is allowed to finish
    or times out on its own per-shot limit). This does NOT terminate the
    RunPod pod itself -- that is the calling agent's job once this script
    exits (see the videographer subagent instructions).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from comfyui_client import ComfyUIClient


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--server-url", required=True)
    ap.add_argument("--workflow-t2v", required=True, help="API-format JSON for text-to-video shots")
    ap.add_argument("--workflow-i2v", help="API-format JSON for image-to-video (character-locked) shots")
    ap.add_argument("--reference-image", help="Local path to the character reference still")
    ap.add_argument("--shot-list", default="shot_list.json")
    ap.add_argument("--out-dir", default="shots")
    ap.add_argument("--hourly-rate", type=float, default=0.34, help="USD/hr for the rented pod, for cost reporting")
    ap.add_argument("--max-runtime-min", type=float, default=90.0, help="Hard stop: don't submit new shots past this")
    ap.add_argument("--only", help="Comma-separated shot ids to (re)generate, default: all")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.json"
    manifest = {"shots": {}, "started_at": time.time()}

    with open(args.shot_list) as f:
        shot_list = json.load(f)

    only = set(args.only.split(",")) if args.only else None

    client = ComfyUIClient(args.server_url)
    t2v_template = client.load_template(args.workflow_t2v)
    i2v_template = client.load_template(args.workflow_i2v) if args.workflow_i2v else None

    ref_filename = None
    if args.reference_image and i2v_template is not None:
        print(f"Uploading reference image {args.reference_image} ...")
        ref_filename = client.upload_image(args.reference_image)

    start_time = time.time()

    for shot in shot_list["shots"]:
        if only and shot["id"] not in only:
            continue

        elapsed_min = (time.time() - start_time) / 60.0
        if elapsed_min > args.max_runtime_min:
            print(f"HARD STOP: {elapsed_min:.1f}min elapsed > --max-runtime-min={args.max_runtime_min}. "
                  f"Remaining shots NOT submitted. Terminate the pod now.")
            break

        needs_ref = shot.get("needs_reference", False)
        if needs_ref and i2v_template is None:
            print(f"SKIP {shot['id']}: needs_reference=true but no --workflow-i2v provided")
            continue
        if needs_ref and ref_filename is None:
            print(f"SKIP {shot['id']}: needs_reference=true but no --reference-image provided")
            continue

        template = i2v_template if needs_ref else t2v_template
        workflow = json.loads(json.dumps(template))  # deep copy

        client.set_text_prompt(workflow, "POSITIVE_PROMPT", shot["prompt"])
        client.set_length(workflow, "VIDEO_LENGTH", shot["duration_s"] * 24)  # assumes 24fps; adjust to your model
        if needs_ref:
            client.set_reference_image(workflow, "REFERENCE_IMAGE", ref_filename)

        print(f"[{shot['id']}] submitting ({shot['duration_s']}s, ref={needs_ref}) ...")
        shot_start = time.time()
        try:
            prompt_id = client.submit(workflow)
            history_entry = client.wait_for_completion(prompt_id)
            out_path = out_dir / f"{shot['id']}.mp4"
            client.download_output(history_entry, "OUTPUT_VIDEO", workflow, out_path)
            wall_s = time.time() - shot_start
            manifest["shots"][shot["id"]] = {
                "status": "done",
                "file": str(out_path),
                "wall_seconds": wall_s,
            }
            print(f"[{shot['id']}] done in {wall_s:.0f}s -> {out_path}")
        except Exception as e:
            manifest["shots"][shot["id"]] = {"status": "error", "error": str(e)}
            print(f"[{shot['id']}] FAILED: {e}", file=sys.stderr)

        # write manifest after every shot so a killed run is inspectable
        total_elapsed_hr = (time.time() - start_time) / 3600.0
        manifest["elapsed_hours"] = total_elapsed_hr
        manifest["estimated_cost_usd"] = round(total_elapsed_hr * args.hourly_rate, 2)
        manifest_path.write_text(json.dumps(manifest, indent=2))

    total_elapsed_hr = (time.time() - start_time) / 3600.0
    print(f"\nBatch finished. Elapsed: {total_elapsed_hr*60:.1f} min. "
          f"Estimated compute cost: ${total_elapsed_hr * args.hourly_rate:.2f} at ${args.hourly_rate}/hr.")
    print("Reminder: terminate the RunPod pod now if nothing else needs it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
