# Space Battle sound effects

Drop audio files here to override the procedurally-synthesised battle sounds in
`src/screens/SpaceBattleScreen.jsx`. Any file that's **missing is simply ignored**
— that sound keeps using its built-in synth, so you can add them one at a time.

Files are loaded once when the battle screen mounts and played through the same
audio bus as the synth (so the master volume, compressor/saturation, reverb send,
mute toggle, and rate-limiting all still apply).

## Expected filenames

| File                  | Used for                                   | Fallback            |
| --------------------- | ------------------------------------------ | ------------------- |
| `laser.wav`           | Laser fire (both teams)                    | synth               |
| `laser-blue.wav`      | Blue laser (optional per-team override)    | `laser.wav` → synth |
| `laser-red.wav`       | Red laser (optional per-team override)     | `laser.wav` → synth |
| `explosion.wav`       | Fighter death / capital secondary blasts   | synth               |
| `explosion-big.wav`   | Capital ship final blast                   | `explosion.wav` → synth |
| `jump.wav`            | Hyperspace jump-in (battle start)          | synth               |
| `victory.wav`         | Engagement resolved                        | synth               |

## Notes

- Any web-audio-decodable format works (`.wav`, `.mp3`, `.ogg`, `.flac`); the
  filename extension in the table is just a convention — update the paths in the
  `SOUND_FILES` map in `SpaceBattleScreen.jsx` if you use a different one.
- Lasers fire often, so keep `laser*` short and quiet; the engine rate-limits and
  randomises pitch (±5%) automatically.
- To change which files are loaded or their paths, edit the `SOUND_FILES` config
  at the top of `SpaceBattleScreen.jsx`.
