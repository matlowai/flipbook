# flipbook

Side-by-side review for video-model experiments: pick a subject, filter by what
varied, choose what counts as the reference, and A/B the renders with flip, wipe
or side-by-side playback.

Every row carries the configuration read out of the render's own graph rather
than parsed from its filename, alongside measured wall time, peak VRAM,
checkpoint size and PSNR against the selected reference.

## Pages

- `index.html` — the comparison surface
- `crest_map.html` — per-tensor quantisation difficulty across a model's layers
- `trueclock.html` - pick the clock: 22 hybrid RoPE-clock arms for the de-rope's
  time-dilated span (stock clock plays it accelerated; TrueClock fixes the speed
  but pays in seam flash and jitter). Two candidates survive the dose ladder;
  loop the regenerated window and tell us which you'd ship.
- `derope.html` — the de-rope A/B deck: LTX-2.5 as a dilate-and-upscale pass
  against H3's own de-rope, with the staircase, alternation and detail rulers.
  Every row carries its ComfyUI workflow (`graphs/`): copy and paste it on the
  canvas, or download the UI or API JSON. The LTX rows there run a flat clock
  (oracle-placed window, uniform hold); the oracle-shaped LTX clock is in progress.

## Notes on reading the numbers

- PSNR between two different sampling runs of the same prompt mostly measures
  *which take you landed on*, not quality. It is shown because it is cheap and
  catches gross breakage, not because it ranks results. Playback decides.
- PSNR is suppressed (`n/a`) between renders at different resolutions, where it
  is undefined rather than merely weak.
- Wall times are single runs from a sequential queue, reconciled from the
  renderer's own history. Peak VRAM is device-wide occupancy, so it includes
  whatever the process already had resident; the floor is tracked alongside it
  locally for that reason.

## Built with

One live pair at a time, by design: an earlier version built every video element
up front and exhausted the GPU's DMA mapping space.
