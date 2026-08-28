STATUS: In Progress
VERSION: 1.1
LAST UPDATED: 2026-08-28
OWNER: Founder

# Pilot Guest Lock & Pre-Production Tracker

This is a live, single-shoot tracking document — unlike the reusable framework docs in `04_PILOT/01–06` and `05_PRODUCTION/`, it gets filled in and updated as this specific pilot actually moves through pre-production. Once the pilot is shot and reviewed, its outcomes feed back into `06_PILOT_REVIEW.md`; this file itself can move to `99_ARCHIVE/OLD_VERSIONS/` once the shoot is complete.

## Locked Guest

**ATS / Ignite Auto Garage — Dubai, UAE.**

- **Why this fits the pilot objectives (`01_PILOT_OBJECTIVES.md`):** real, accessible location; automotive specialist expertise; strong visual/demonstration potential (diagnostic scans, ECU/EEPROM programming sessions, bench and boot-mode work are inherently show-able, not just describable).
- **Working specialty angle:** automotive diagnostics and ECU/EEPROM programming — fault scanning (DTCs), bench/boot-mode programming, and the job-sheet/case-file work the garage already does. This is a *more specialized* angle than a generalist BMW mechanic, which is a good pilot stress-test: it forces the Episode Structure and Question Bank to prove they work for a narrower technical specialty, not just the broadest possible automotive guest.
- **Access:** since this is the founder's own workshop, guest sourcing/vetting and the "explain the format isn't an ad" conversation (`05_PRODUCTION/01_PRE_PRODUCTION.md`) are effectively already satisfied — the remaining pre-production work is logistics and content planning, not persuasion.

## Pre-Production Checklist Status

Pulled from `05_PRODUCTION/01_PRE_PRODUCTION.md`:

- [x] Guest sourced and vetted — locked above.
- [x] Format expectations understood — internal, no separate "this isn't an ad" briefing needed, though the on-camera specialist should still be walked through the Interviewer Rule (`03_EPISODE_SYSTEM/02_INTERVIEW_FRAMEWORK.md`) so they're comfortable telling stories on camera, not just demonstrating.
- [ ] **On-camera specialist identified** — who at ATS / Ignite Auto Garage is the actual subject? (Founder, lead technician, or someone else.) *Needs founder input.*
- [ ] **Shoot date/window confirmed** — no date locked yet. *Needs founder input.*
- [ ] **Hero case selected** — a specific real diagnostic/ECU job (in progress or recently completed, with permission) to anchor the Demonstration section (`03_EPISODE_SYSTEM/01_EPISODE_STRUCTURE.md`, Section G). *Needs founder input.*
- [ ] Guest-specific question plan — drafted below, pending confirmation of who's on camera.
- [ ] Shot list — drafted below, pending confirmation of hero case and shoot date.
- [ ] Consent/release paperwork — for any real customer vehicle or job sheet shown on camera. *Needs founder confirmation of process.*
- [ ] End-card info confirmed — business name, address, website, social handles, contact details to include per `03_EPISODE_SYSTEM/06_OUTRO_AND_CTA.md`. *Needs founder input.*
- [ ] Equipment checked and packed — blocked on `05_PRODUCTION/03_AUDIO.md` / `04_CAMERA.md`, both still `TO BE DEVELOPED`.
- [ ] Highlight-logging role assigned for shoot day (`03_EPISODE_SYSTEM/04_HIGHLIGHT_SYSTEM.md`) — depends on who else is available on shoot day.

## Guest-Specific Question Plan (Draft)

Adapted from `04_PILOT/03_PILOT_QUESTION_PLAN.md` for the diagnostics/ECU angle. Reservoir, not a script — per the Interviewer Rule.

**Who Is This Person? (Section C)**
- Who are you, and what pulled you specifically into diagnostics and ECU work rather than general mechanical repair?
- How did you learn this — is it mostly self-taught, trained, or both?

**The Place (Section D)**
- What are we looking at? *(scan tool, bench setup, EEPROM programmer, job sheets — asked naturally per station)*
- Show us. *(used throughout, not just in the dedicated demonstration block)*

**Expertise (Section E)**
- What's the fault code or symptom you see most often that turns out to be something completely different from what the customer assumed?
- What's a repair people pay for that a proper diagnostic would have shown wasn't necessary?
- When does a problem actually require bench/boot-mode ECU work versus something simpler?
- What do customers misunderstand about what "the computer" in their car actually does?

**Stories (Section F)**
- What's the strangest fault you've ever had to track down?
- Have you ever had a car with a problem nobody else could diagnose?
- What's a job that looked simple on paper and turned into a nightmare?

**Demonstration (Section G)**
- Walk through the hero case once selected — a real scan, a real fault code, or a real programming session, with permission.

**Personal / Light Moment (C/H)**
- What's the most satisfying fix you've ever pulled off?
- What keeps this interesting after doing it for years?

**Closing (I/J)**
- If someone's dashboard throws a warning light, what's the one thing you wish every driver did before panicking or replacing parts?
- What's a diagnostic myth you want to correct once and for all?

## Shot List Notes (Draft)

Adds to `04_PILOT/04_PILOT_SHOT_LIST.md`'s general checklist, specific to this location:

- Scan tool / diagnostic screen close-ups (readable on camera — check screen glare and font size before shoot day)
- EEPROM/bench programmer setup and a real programming session in progress
- Job sheets / case files as physical objects (with any customer-identifying info handled per consent status)
- Wide shot of the bay/workshop floor, ideally with a car up on a lift or mid-diagnostic
- The specialist's hands actually working — connecting a scanner, reading a live data stream, etc.

## Open Items — Needs Your Input Before Pre-Production Can Close Out

1. Who is the on-camera specialist?
2. Target shoot date or window?
3. What's the hero case — a specific real job we can plan the Demonstration section around?
4. What garage info goes in the end card (address, website, Instagram/social handles, phone/WhatsApp)?
5. Who handles consent/release for any customer vehicle or job sheet shown on camera?

Once these five are answered, this tracker can move from `STATUS: In Progress` to `STATUS: Ready to Shoot`, and the checklist above should be fully checked off.

## AI Previs (Optional, Before the Real Shoot)

Goal: previsualize the "Diagnostic Detective" concept trailer — 13 shots, generic/placeholder identity, not the real specialist — to test tone and pacing before committing a shoot day. This is a visualization aid only: it does not replace or block any of the five open items above.

**Active path (chosen 2026-08-28): free-tier consumer web tools, zero spend.** Founder decided not to commit any money (RunPod GPU rental or otherwise) until the pilot itself proves out ROI. Plan:

1. Generate the character reference still (`character_reference_prompt` in `04_PILOT/videographer_agent/shot_list.json`) via a free, cardless image tool (e.g. Bing Image Creator/Copilot Designer).
2. Run the 13 shots in `shot_list.json` through a free-tier video generator with a daily no-cost credit allowance and no card required (e.g. Pika, Kling — verify current limits at signup, they move) — text-to-video for the 7 shots with `needs_reference: false`, image-to-video with the reference still for the 6 with `needs_reference: true`.
3. Download and stitch the clips in a free editor (CapCut, DaVinci Resolve Free) for a rough assembled trailer.

**Deferred path: self-hosted RunPod + ComfyUI pipeline.** `04_PILOT/videographer_agent/` still holds the full self-hosted setup (Claude Code subagent + scripts, near-zero marginal cost per clip once running) — worth revisiting once the pilot validates the format and content volume justifies infra investment, not before. Nothing in it has been run; it still needs a RunPod account/API key and a one-time manual ComfyUI workflow build. The RunPod MCP server (`runpod`) is registered locally for this project but not yet connected (needs `RUNPOD_API_KEY`, not currently set).
