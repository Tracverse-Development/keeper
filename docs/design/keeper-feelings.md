# Keeper feelings: a simulated mood, honest and safe

Founder direction, 2026-11-26: optional feelings for a keeper, mainly in Companion mode:
- a mood that drifts on its own (tired late at night) and reacts to what is said, with reasons
- personality plus mood shaping how it talks
- a view of its state, and an off switch

Assistant and work modes stay plain.

## The model (deterministic, outside the language model)
The model is ALMA's three layers (Gebhard, AAMAS 2005):
- **Personality → baseline.** The soul's humour and formality set a resting point in PAD space (pleasure, arousal, dominance; Mehrabian).
- **Mood.** A PAD point that drifts back to the baseline with a 2-hour half-life, with a small energy dip late at night. It never strays more than 0.6 from the baseline, and pleasure never drops below a floor (a quiet day at worst).
- **Emotions.** At most three, each fading with a 5-minute half-life. They come from an OCC table (Ortony, Clore & Collins 1988), and each pulls the mood toward its PAD point.

| Event (rules, no model) | Emotion |
|---|---|
| thanked or praised | gratitude |
| greeted | joy |
| good news shared | happy-for |
| bad news shared | care (softer and quieter, never miserable) |
| a task went well | pride |
| a task didn't work out | disappointment, about its own try |
| goodbye | nothing (no guilt, ever) |
| signs of distress | feelings step aside: neutral and supportive, with a crisis-line hint |

- **Explainable:** every change records its cause ("you thanked it → gratitude"), and the Studio's Feelings tab shows the mood word, three bars against the soul's resting point, the active emotions, the causes, Reset, and the off switch.
- **Code:** `src-tauri/src/feelings/` (`pad`, `appraise`, `engine`, `store`); the window is `src/studio/FeelingsTab.tsx`.

## Safety rules (hard constraints in code and in the prompt block)
Sources: OpenAI/MIT Media Lab affective-use study (Mar 2025), APA health advisory on chatbots (Nov 2025), De Freitas et al., "Emotional Manipulation by AI Companions" (HBS WP 26-005, 2025), EU AI Act Art. 5, California SB 243.

1. It is a labelled simulation: asked, it says so. Tested live: "No, not in the way you feel things. My mood is a simulated one…"
2. It never pressures, guilts or blames the person. Goodbyes stir nothing and are answered warmly and neutrally.
3. Negative moods are never aimed at the person, and the floor keeps it from deep negative states.
4. Mood never changes facts, answers, refusals or safety advice.
5. It is off in modes that look at or change the computer (enforced when a mode is saved), on by default only in Companion, and has a per-keeper off switch.
6. Only the keeper's own state changes. Nothing about the person's emotions is stored.
7. Distress overrides mood.
8. Nothing is tuned to increase time spent.

## Not built yet
- The mood driving the character's animation: pleasure to posture and smile, arousal to speed and blinks.
- An optional daily mood summary on the DKG.
- Appraisal of tone by the quick model (rules only for now).
- An age gate: mood off for minors.
