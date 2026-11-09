# Character assets

Sprite animation frames imported from
[cherry9001/tiktok-live-bar](https://github.com/cherry9001/tiktok-live-bar)
(`UnityProject/Assets/Resources/`), MIT License — Copyright (c) 2025 ÔNG CHÚ MMO.
See `LICENSE.txt`, which must stay with these files.

## Layout

Each folder is one animation: numbered frames `000.png`, `001.png`, … played in order.

| Folder               | Frames | Frame size |
| -------------------- | ------ | ---------- |
| `a`                  | 10     | 240×240    |
| `b`                  | 12     | 256×208    |
| `c`                  | 8      | 256×256    |
| `d`                  | 16     | 177×177    |
| `e`                  | 8      | 240×240    |
| `g`                  | 15     | 256×255    |
| `h`                  | 9      | 256×218    |
| `j`                  | 14     | 240×240    |
| `k`                  | 9      | 256×256    |
| `mushroom_dance_01`  | 14     | 240×240    |
| `mushroom_dance_15`  | 11     | 240×240    |
| `mushroom_magic_02`  | 16     | 240×240    |
| `hanhan_video_dance` | 40     | 256×372    |

`NpcAvatars/` is different: 16 standalone portraits (`npc-avatar-00.png` …
`npc-avatar-15.png`, 256×256), not an animation sequence.

## Notes

- All frames are transparent PNGs, suitable for `THREE.Texture` + billboard sprites.
- Frame sizes differ per folder, so keep each animation's aspect ratio rather than
  forcing one uniform quad size.
- Loading 198 individual PNGs as separate textures is heavy; pack each folder into a
  sprite sheet before using them in the 3D scene.
