# Making your own FRC Royale robots

The pit and 2026 match share robotModel() in royale-models.js. Edit that model once to change both views. arena.js projects the same geometry into the overhead match. Match geometry is cached: refresh the page after edits.

## Current model format

Models are procedural JavaScript, not imported 3D assets. Dimensions are inches. The chassis center is X=0, Y=0; Z is height above the floor. +X is the front/intake end. The chassis spans roughly -13 to +13 in X and Y; bumpers extend to about 16.75 inches each side.

Inside robotModel(), use these helpers:

- box(x0, x1, y0, y1, z0, z1, color): chassis rails, motor housings, bumpers.
- cyl(centerX, centerY, radius, bottomZ, topZ, color): vertical cylinders.
- roller(x, y, z, length, radius, color): horizontal rollers along Y.
- plate(vertices, color, thicknessOffset): folded hopper panels and gussets; vertices are [x,y,z] coordinates.

Example replacement intake roller and side plates, inside robotModel():

```js
roller(19, 0, 4, 22, 1.5, '#36dcc9');
for (const side of [-1, 1]) {
  plate([[9,side*11,4], [20,side*11,3], [19,side*11,8], [10,side*11,7]],
        '#c4d4e1', [0,side*.5,0]);
}
```

Replace the existing corresponding geometry rather than drawing a duplicate on top. Keep equipment branches (b.drive.id, b.intake.id, b.hopper.id, b.shooter.id, b.climber.id) so the displayed hardware matches the selected build. Preserve the existing turret flags/pivot and fuelIndex metadata when changing moving shooters or hopper fuel. Use col for alliance-colored bumpers.

## Suggested workflow

1. Sketch the robot from above and from the side, with dimensions.
2. Build the chassis and bumper silhouette first; add hopper, intake, and shooter as separate sections.
3. Check the pit view, then check the same build in a match. Small details may disappear at match scale.
4. Run node test.cjs and node build.cjs. Bump the asset/cache version in index.html and sw.js when distributing updates.

## Using an external model

The current renderer cannot load STL, OBJ, or GLB files directly. If you prefer modeling in a 3D editor or CAD, keep the chassis, bumpers, intake, hopper, shooter/turret, and climber as separate named parts. Supply dimensions, front direction, turret pivot locations, and a lightweight mesh export (GLB is a useful interchange candidate). Supporting that asset requires a model loader and renderer integration first; exporting a file alone will not replace the current models.

Visual geometry does not change collision size, robot height rules, weight, capacity, or performance. Those remain defined by equipment stats in index.html and the physics/navigation code.
