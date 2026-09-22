STATUS: Draft
VERSION: 1.0
LAST UPDATED: 2026-08-26
OWNER: Founder

# Prompt Library

A general-purpose starting library of prompt patterns for working with AI on The Link. Category-specific prompt sets live in `02_SCRIPT_PROMPTS.md`, `03_DESIGN_PROMPTS.md`, `04_VIDEO_PROMPTS.md`, and `05_RESEARCH_PROMPTS.md`.

## The Standard Context-Loading Prompt

Use this pattern to start any creative session with an AI assistant on this project:

> "Before we start, read `00_PROJECT_BIBLE/00_READ_ME_FIRST.md` and [relevant folder] in The-Link project. I want to [task]. Flag anything that would conflict with the Project Bible before producing the output."

## General-Purpose Prompt Patterns

**Ideation within constraints:**
> "Given the Content Pillars in `02_CONTENT_STRATEGY/03_CONTENT_PILLARS.md` and the tone in `01_BRAND/04_TONE_OF_VOICE.md`, generate [N] ideas for [content type] about [topic/guest]. Reject any idea that reads like an advertisement."

**Testing an existing draft:**
> "Evaluate this draft against the Decision Principles in `00_PROJECT_BIBLE/04_DECISION_PRINCIPLES.md` — specifically the Ad Test and the Value Test. Where does it fail, and how would you fix it without losing [the specific thing being preserved]?"

**Extending to a new vertical (post-automotive):**
> "This format currently exists for automotive guests. Adapt [document/question set] for a [new field] specialist, preserving the structure and only changing vertical-specific details. Flag anything that seems to only work for automotive."

## Do / Don't for Prompting on This Project

**Do:**
- Point to specific files, not just "the brand guidelines."
- Ask the AI to flag conflicts with the Bible rather than silently resolving them.
- Ask for options where a decision is marked `TO BE DEVELOPED`, not a single fabricated answer.

**Don't:**
- Ask for content "in the style of a typical car repair channel" — this actively works against the brand's scalability constraint.
- Accept a script, caption, or concept that implicitly pitches the guest's business without checking it against the Ad Test first.
