# Videographer agent — self-hosted video generation for Claude Code

Drives an open-source video model (LTXVideo 13B by default) on a rented RunPod
GPU pod instead of paying per-generation credits on Runway/Kling/etc. Real
cost is hourly compute, not per-clip — roughly $0.34-0.74/hr on an RTX 4090
(RunPod Community/Secure Cloud, verified Aug 2026 — check current pricing at
runpod.io before you rely on this number, it moves).

## What's in here

```
.claude/agents/videographer.md   the Claude Code subagent definition
scripts/comfyui_client.py        thin wrapper around ComfyUI's HTTP API
scripts/generate_shots.py        batch-runs shot_list.json against a pod
shot_list.json                   the "Diagnostic Detective" trailer, 13 shots
workflows/                       EMPTY — see step 3, this can't be pre-built for you
shots/                           generated clips + manifest.json land here
```

## Setup (one-time)

### 1. Drop this into your Claude Code project

Copy `.claude/agents/videographer.md` into your project's `.claude/agents/`
directory (create it if it doesn't exist). Copy `scripts/`, `shot_list.json`,
and the empty `workflows/` and `shots/` folders alongside it, or wherever you
keep this project.

```
pip install requests
```

### 2. RunPod account + API key

Sign up at runpod.io, add a small credit balance, and generate an API key
under Settings → API Keys. Set it as an environment variable:

```
export RUNPOD_API_KEY=your_key_here
```

Optional but recommended: install the official RunPod MCP server so the
agent can manage pods through proper tool calls instead of raw curl:

```
claude mcp add runpod -- npx -y @runpod/mcp-server
```

(Needs Node 18+. See RunPod's MCP docs for the hosted alternative at
mcp.getrunpod.io if you'd rather not run it locally.)

### 3. Build the ComfyUI workflow once — the part I can't do for you

I did not fabricate `workflows/t2v_api.json` or `workflows/i2v_api.json`.
The exact node graph depends on which custom nodes and model checkpoint
your ComfyUI setup ends up with, and a guessed one would silently fail or
(worse) silently produce garbage. This is a 15-minute one-time task:

1. Deploy a ComfyUI pod manually once from the RunPod console: New Pod →
   RTX 4090 → template "ComfyUI" (or "ComfyUI Blackwell Edition" for a
   5090/B200) → deploy.
2. Open the pod's port 8188 URL once it's up (`https://<pod-id>-8188.proxy.runpod.net`).
3. Install the LTXVideo 13B checkpoint (ComfyUI Manager → search "LTXVideo",
   or download from the model's official HuggingFace repo into `models/checkpoints`).
4. Build a minimal **text-to-video** workflow: a prompt-conditioning node →
   the LTXVideo sampler/decoder → a video-save node (VHS_VideoCombine or
   similar). Rename three nodes by double-clicking their title bar:
   - the text prompt node → `POSITIVE_PROMPT`
   - the length/frame-count node (if it's separate from the sampler) → `VIDEO_LENGTH`
   - the save/combine node → `OUTPUT_VIDEO`
5. Menu → Workflow → Export (API Format). Save as `workflows/t2v_api.json`.
6. Duplicate the workflow, add a `LoadImage` node feeding the sampler's
   image-conditioning input (this is what turns it into image-to-video),
   rename it `REFERENCE_IMAGE`. Export as `workflows/i2v_api.json`.
7. You can now terminate that pod — the agent will spin up new ones per
   session using these exported templates.

`scripts/comfyui_client.py` finds nodes by these titles, not by numeric ID,
so the workflow keeps working even after you edit the graph later, as long
as the titles stay put.

### 4. Generate the character reference still

Before running the full batch, generate one still image of the technician
(`character_reference_prompt` in `shot_list.json`) through the same
ComfyUI pod's image pipeline (SDXL/Flux/whatever image checkpoint you have
loaded — that's a separate, simpler workflow), save it locally, and look at
it before spending pod-hours on the 6 shots that depend on it matching.

## Running it

Either ask the videographer agent directly in Claude Code ("use the
videographer agent to generate shot_list.json"), or run the script by hand:

```
python scripts/generate_shots.py \
  --server-url https://<pod-id>-8188.proxy.runpod.net \
  --workflow-t2v workflows/t2v_api.json \
  --workflow-i2v workflows/i2v_api.json \
  --reference-image shots/reference.png \
  --hourly-rate 0.34 \
  --max-runtime-min 90
```

Check `shots/manifest.json` afterward for per-shot status and the real
`estimated_cost_usd`. **Terminate the pod when you're done** — nothing in
this pipeline does that automatically for you if you run the script by
hand instead of through the agent.

## Honest limitations

- First pod boot can take up to ~30 minutes while the model downloads,
  unless you attach a persistent network volume with the model pre-cached
  (worth doing if you'll run this weekly for @mosa_tech content).
- Open-source model character consistency is real but not perfect — the
  image-to-video reference-frame trick (same technique used with Runway)
  narrows drift, it doesn't eliminate it. Expect to regenerate a shot or two.
- LTXVideo 13B trades some visual fidelity for speed vs. Wan 2.2 /
  HunyuanVideo 1.5. If a shot doesn't hold up, that's the one to swap in
  the higher-fidelity model for at the cost of a bigger/pricier GPU.
