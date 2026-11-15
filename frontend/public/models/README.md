# anatomy.glb

The 3D body on the panel: the skin of the BodyParts3D atlas body and, inside it, the skeleton, the brain, the heart and the airways.

- **Source:** BodyParts3D, by the Database Center for Life Science (Japan), PART-OF polygon meshes `partof_BP3D_4.0_obj_99.zip` from <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>.
- **Licence:** CC BY 4.0. Credit: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International". The OBJ headers in the download still quote the database's earlier licence (CC BY-SA 2.1 Japan); the [licence page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) now states CC BY 4.0.
- **Changes:** made by `scripts/build_anatomy.py`, which explains each step:
  - Picks the parts of each group by name and merges them: skin (1 piece), skeleton (216), brain (44), heart (76) and airways (101).
  - Simplifies them to about 140 000 triangles in all (about 2 MB).
  - Moves them to the panel's frame: y up, facing +z, soles at y = 0, 1 unit = the person's height.
  - Flattens the front of the pelvis, as on a mannequin.
  - Bakes on each skin vertex how much it belongs to the head, an arm, a leg or the torso (vertex colour `COLOR_0`), from the nearest bone.
  - Stores the spots the rings point to, and the height where the chest ends, in the scene's `extras`.
- **Rebuild:** download and unzip the file above, then run `python scripts/build_anatomy.py <unzipped folder>` (needs numpy, scipy, trimesh and fast-simplification). The atlas itself is not stored here.
