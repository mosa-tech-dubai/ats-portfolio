STATUS: Approved
VERSION: 1.0
LAST UPDATED: 2026-08-26
OWNER: Founder

# AI Read First

This project is designed to work with AI assistants — Claude Code, ChatGPT, and other tools. This file is the instruction set for how any AI should use the project files as context.

## The Core Rule

**Before generating any strategic or creative output, read the relevant project documentation first — starting with `00_PROJECT_BIBLE/`.**

When asked to create any of the following, first consult the documents named next to it:

| Request | Read first |
|---|---|
| Script, interview questions | `03_EPISODE_SYSTEM/`, `00_PROJECT_BIBLE/03_CORE_PHILOSOPHY.md` |
| Intro / outro copy | `03_EPISODE_SYSTEM/05_COLD_OPEN.md`, `06_OUTRO_AND_CTA.md`, `01_BRAND/04_TONE_OF_VOICE.md` |
| Thumbnail concept | `06_POST_PRODUCTION/04_THUMBNAILS.md`, `01_BRAND/06_VISUAL_IDENTITY.md` |
| Logo concept | `01_BRAND/06_VISUAL_IDENTITY.md`, `01_BRAND/01_WORKING_NAME.md` |
| Social caption | `01_BRAND/04_TONE_OF_VOICE.md`, `02_CONTENT_STRATEGY/04_PLATFORM_STRATEGY.md` |
| Episode questions | `03_EPISODE_SYSTEM/02_INTERVIEW_FRAMEWORK.md`, `03_QUESTION_BANK.md` |
| Short-form hook / video concept | `02_CONTENT_STRATEGY/05_CONTENT_REPURPOSING.md`, `06_POST_PRODUCTION/02_SHORT_FORM_EDITING.md` |
| Marketing idea | `08_GROWTH/01_MARKETING.md`, `00_PROJECT_BIBLE/04_DECISION_PRINCIPLES.md` |

More detailed prompt scaffolding for each of these lives in `01_PROMPT_LIBRARY.md` through `05_RESEARCH_PROMPTS.md`.

## The Non-Negotiable Rule

**Never invent a new direction that contradicts the Project Bible without explicitly flagging the conflict.**

If a request seems to require going against something recorded as DECIDED in `00_PROJECT_BIBLE/00_READ_ME_FIRST.md` or the project status document — e.g., writing a script that reads as a direct advertisement, designing a car-specific logo, or assuming a brand name/tagline that isn't actually locked — say so explicitly before proceeding. Name the specific conflict and ask, rather than quietly resolving it in either direction.

## Quick Checks Before Producing Creative Work

1. Does this stay editorial, not advertorial? (`00_PROJECT_BIBLE/04_DECISION_PRINCIPLES.md`, Ad Test)
2. Does this deliver something the viewer/reader didn't know before? (Value Test)
3. Would this still make sense if the guest were in a completely different field than automotive? (Portability Test / Scalability Check)
4. Does this match the tone in `01_BRAND/04_TONE_OF_VOICE.md`?
5. Am I treating anything marked `STATUS: TO BE DEVELOPED` as if it were decided? (Check `PROJECT_STATUS.md` at the project root if unsure.)

## What "Using the Project as Context" Means Practically

- Pull actual language and structure from the relevant files rather than reinventing the brand voice from a generic description of "a car podcast."
- When a file is marked `TO BE DEVELOPED`, treat that absence as real — offer options and flag the open decision rather than fabricating a definitive answer (e.g., don't invent a final tagline and present it as settled).
- When in doubt about which document governs a request, start from `00_PROJECT_BIBLE/00_READ_ME_FIRST.md` and follow its links.
