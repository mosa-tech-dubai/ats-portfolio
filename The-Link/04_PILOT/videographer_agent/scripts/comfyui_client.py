"""
Thin client for ComfyUI's HTTP API.

Verified endpoints (ComfyUI standard API, confirmed against RunPod's ComfyUI
pod docs, Aug 2026):

  POST /prompt          -> submit a workflow (API-format JSON), returns prompt_id
  GET  /history/{id}    -> poll for completion; prompt appears once done
  GET  /view            -> fetch a generated output file by filename/subfolder/type

Nodes are located by their `_meta.title` (the name you give a node in the
ComfyUI UI, preserved when you export "Save (API Format)") rather than by
numeric node id, because numeric ids shift every time the workflow graph is
edited. Before exporting your workflow, rename the key nodes in ComfyUI's UI
to the titles below so this script can find them:

  - "POSITIVE_PROMPT"   -> the CLIPTextEncode (or equivalent) node carrying
                             the shot description
  - "REFERENCE_IMAGE"   -> the LoadImage node used as the image-to-video
                             start frame (only present in i2v workflows)
  - "VIDEO_LENGTH"      -> whatever node/widget controls frame count / duration
  - "OUTPUT_VIDEO"      -> the SaveVideo / VHS_VideoCombine node whose output
                             file this script should download

This file makes no assumptions about which model (LTXVideo, Wan 2.2,
HunyuanVideo, ...) is loaded in the workflow -- it only manipulates the
title-tagged nodes generically.
"""
from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

import requests


class ComfyUIClient:
    def __init__(self, server_url: str, timeout: float = 30.0):
        # server_url example: https://<pod-id>-8188.proxy.runpod.net
        self.server_url = server_url.rstrip("/")
        self.client_id = str(uuid.uuid4())
        self.timeout = timeout

    # ---- workflow patching -------------------------------------------------

    def load_template(self, path: str | Path) -> dict[str, Any]:
        with open(path, "r") as f:
            return json.load(f)

    def find_node_by_title(self, workflow: dict[str, Any], title: str) -> str | None:
        for node_id, node in workflow.items():
            if node.get("_meta", {}).get("title") == title:
                return node_id
        return None

    def set_text_prompt(self, workflow: dict[str, Any], title: str, text: str) -> None:
        node_id = self.find_node_by_title(workflow, title)
        if node_id is None:
            raise KeyError(
                f"No node titled '{title}' in workflow. Rename the node in "
                f"ComfyUI's UI and re-export with Save (API Format)."
            )
        # CLIPTextEncode-style nodes expose the prompt as `text`.
        workflow[node_id]["inputs"]["text"] = text

    def set_reference_image(self, workflow: dict[str, Any], title: str, filename: str) -> None:
        node_id = self.find_node_by_title(workflow, title)
        if node_id is None:
            raise KeyError(
                f"No node titled '{title}' in workflow -- this template may "
                f"not support image-to-video. Skip needs_reference shots or "
                f"add a LoadImage node titled '{title}'."
            )
        workflow[node_id]["inputs"]["image"] = filename

    def set_length(self, workflow: dict[str, Any], title: str, value: int) -> None:
        node_id = self.find_node_by_title(workflow, title)
        if node_id is None:
            return  # not every workflow exposes this as a separate node; non-fatal
        # widget name varies by node type (e.g. "length", "num_frames", "frame_count")
        for key in ("length", "num_frames", "frame_count", "frames"):
            if key in workflow[node_id]["inputs"]:
                workflow[node_id]["inputs"][key] = value
                return

    # ---- upload / submit / poll / fetch ------------------------------------

    def upload_image(self, image_path: str | Path) -> str:
        """Upload a local image to the pod so a LoadImage node can reference it.
        Returns the filename ComfyUI stored it under."""
        with open(image_path, "rb") as f:
            files = {"image": (Path(image_path).name, f, "image/png")}
            resp = requests.post(f"{self.server_url}/upload/image", files=files, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()["name"]

    def submit(self, workflow: dict[str, Any]) -> str:
        payload = {"prompt": workflow, "client_id": self.client_id}
        resp = requests.post(f"{self.server_url}/prompt", json=payload, timeout=self.timeout)
        resp.raise_for_status()
        data = resp.json()
        if data.get("node_errors"):
            raise RuntimeError(f"Workflow rejected: {data['node_errors']}")
        return data["prompt_id"]

    def wait_for_completion(self, prompt_id: str, poll_every: float = 3.0, max_wait: float = 900.0) -> dict[str, Any]:
        elapsed = 0.0
        while elapsed < max_wait:
            resp = requests.get(f"{self.server_url}/history/{prompt_id}", timeout=self.timeout)
            resp.raise_for_status()
            history = resp.json()
            if prompt_id in history:
                return history[prompt_id]
            time.sleep(poll_every)
            elapsed += poll_every
        raise TimeoutError(f"Prompt {prompt_id} did not complete within {max_wait}s")

    def download_output(self, history_entry: dict[str, Any], node_title_hint: str, workflow: dict[str, Any], out_path: str | Path) -> Path:
        node_id = self.find_node_by_title(workflow, node_title_hint)
        outputs = history_entry.get("outputs", {})
        node_output = outputs.get(node_id) if node_id else None
        if not node_output:
            # fall back: grab the first output that has "gifs" or "videos" or "images"
            for candidate in outputs.values():
                for key in ("gifs", "videos", "images"):
                    if key in candidate and candidate[key]:
                        node_output = candidate
                        break
                if node_output:
                    break
        if not node_output:
            raise RuntimeError(f"No output files found in history entry: {history_entry}")

        file_info = None
        for key in ("gifs", "videos", "images"):
            if key in node_output and node_output[key]:
                file_info = node_output[key][0]
                break
        if file_info is None:
            raise RuntimeError(f"Unrecognized output shape: {node_output}")

        params = {
            "filename": file_info["filename"],
            "subfolder": file_info.get("subfolder", ""),
            "type": file_info.get("type", "output"),
        }
        resp = requests.get(f"{self.server_url}/view", params=params, timeout=self.timeout)
        resp.raise_for_status()

        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(resp.content)
        return out_path
