# SpaceFour

Four-bar live space desk for bedroom producers and AI-music finishers.

AI tools and loop DAWs slam the chorus at full height.
Session players write four live bars of air — hats off, one chair, bass pedal, stop space — so the hook can slam.

Live samples only — FluidR3 acoustic grand, upright bass, nylon guitar, trumpet, violin, and acoustic kit from the PreEight sample CDN pinned to commit `d58301e4a494555f411a2afbc448b724136eee76`.
No oscillators.
Audio never leaves the tab.

## Distinct from yesterday and the rest of the line

| Tool | Job |
| --- | --- |
| TagFour | Four-bar last-line tag |
| LiftTwo | Two-bar pre-hook lift |
| ModEight | Last-chorus key change |
| PreEight | Eight-bar pre-chorus |
| AfterHook | Eight bars after the hook |
| EndEight | Last eight bars |
| LastHook | Money chorus |
| DropFour | Four-bar drop |
| AirFour | Four-bar air |
| **SpaceFour** | Four bars of live space so the hook can slam |

Yesterday's ship was the previous arrangement desk.
SpaceFour is the missing air that makes the slam land.

## Pricing recommendation

One-time **$19** on Lemon Squeezy (mirror on Gumroad).
This is a finite desk, not a cloud meter.
Do not subscribe.
Forge Pass stays the recurring cloud bundle ($24/mo).
Sell next to the other one-time desks.

**Current app is free.** No license gate. MIT.
A priced build would need a Lemon Squeezy or Gumroad key check.

## Samples

Pinned commit SHAs only. Never @main or @gh-pages.

## Export

Default bounce is 48 kHz, 24-bit stereo.
At 92 BPM and 8 bars the loop file is exactly 1,001,739 samples (`Math.round(8 * 4 * 60 / 92 * 48000)`), first downbeat at sample 0.
Fold the ring-out tail onto the start for seamless loop.
Matching MIDI with one track per chair.

## License

MIT.
workinwithai-create.
