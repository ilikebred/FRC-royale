# FRC Royale — web app

## FRC simulator workshop

The pit has a reference-inspired game lobby with large Workbench, Autonomous pathing, Leaderboards, and Settings buttons, a centered robot on a wheeled pit cart, rank progress above, and stats and match controls on the right. Light mode uses an ice-blue background and raised white controls; dark mode retains the same layout. Hardware and auto editing remain dedicated destinations, with part previews before purchase. Hopper models use folded side plates, a rear wall, sloped feed floor, rim rails, rivets, and capacity-specific widths.

**Normal coin spending is the default.** The pit's Options menu still has a **Test credits** switch; an existing saved preference is preserved. Test purchases and upgrades do not reduce your real balance. Owned test parts remain available when testing is turned off. Weight limits still apply. Profiles that have acquired test parts are excluded from upstream leaderboard syncing.

## Official matches, practice, and durability

**Play** opens the public Supabase matchmaking queue. Choose 1v1 (one human plus two AI robots per alliance), 2v2 (two humans plus one AI), or 3v3 (all human drivers). Players must search in the same season, mode, and protocol version. The queue waits for real opponents and can be cancelled. Each person controls their robot and any AI teammate; they cannot drive another human's robot. Boosts can target any ally, with shared alliance cooldowns.

Completed official matches pay coins based on personal contribution, match outcome, alliance objectives, robot condition, and foul penalties. The results screen shows the breakdown. Rewards apply once per session. Official matches update local RP and records; they do not submit results to the old creator's backend. Practice awards **zero coins and zero RP**, preserves the competitive record, starts with a healthy robot, and does not persist damage. Friendly room matches remain unranked.

Robots have condition and heat meters. In 2026, hard impacts damage the frame and sustained firing/overdrive generates heat. At 85% heat, launcher output halves; continued overheating causes wear. Idling cools the robot. Below 35% condition, speed/intake/output fall to 65%; at zero the robot breaks until repaired. Official damage persists when returning to the pit, including leaving an unfinished match. The workbench offers repairs at two coins per missing condition point, Reinforced alloy (650 coins, 1.6× durability), and Titanium composite (1,600 coins, 2.5× durability). Material purchases do not refill condition. Older replay recordings retain their original simulation rules.

Match controls are compact, and the field stays vertical on every screen size, including multiplayer and replays. Boosts keep their card appearance and drag cue.

Matchmaking uses public Realtime discovery and a browser host, not a dedicated authoritative game server. Local saves and client-hosted results are not cheat-resistant; server-validated accounts/rewards remain a separate backend project. Closing the host browser or losing a player ends an unfinished match without rewards. See [BACKEND_SETUP.md](BACKEND_SETUP.md).

Validation: `node test-gameplay.cjs` checks damage, replay compatibility, practice settlement, queue consensus, and complete 1v1/2v2/3v3 simulations. `node test-live-queue.cjs` checks real Supabase discovery using isolated temporary test channels (no database writes). `node test.cjs` runs the existing regression suite.

FRC Royale adds an original blue-and-gold arena identity, crowned robot shield, light/dark themes, and equipment-specific robot models in the pit and match. The 2026 models include open dump trays, angled flywheel hoods, single/dual turret bearings, compliant intake rollers, frame rails, swerve modules, and open storage. Older seasons retain their original season-specific mechanisms.

Open `model-review.html` on the local server to compare the five shooter silhouettes in pit and match views. Run `node test.cjs` to check geometry, trench clearances, routes, and deterministic replay.

Based on [sjsonline/bots](https://github.com/sjsonline/bots). The original seasons, credits, upgrades, teams, match rules and progression are retained.

- Run `node serve.cjs`, then open http://127.0.0.1:4173.
- Use the Light / Dark button to switch themes. The choice persists locally.
- Open the speaker button for Sound settings. Field sounds and music can be enabled independently; field volume is saved locally. The 2026 live match has synthesized swerve/tank motors, launcher/dumper shots, intake rattles, fuel thumps and phase buzzers. These are original FRC-style effects, not official event recordings. Paused/background matches mute drivetrain audio; replays and exports do not emit field sounds.
- In TELEOP, click the field to append waypoints. Right-click or select **Undo point** to remove the last pending waypoint. The cyan line shows the actual planned route. Normal robot AI resumes after the route completes.
- In the 2026 pit, create a custom auto and select Trench left/right or Bump left/right. These are relative to your alliance wall and set the robot's actual spawn. Tall robots cannot select trench starts. Plot or drag a route; each point becomes an editable command. Move/intake points flow together; Shoot, Feed and Wait stop and run for their chosen duration. Climb must be the final point, with a climber equipped and a valid tower approach. Right-click or Undo removes the last point. Presets retain their original routines; duplicating one converts it into a route for review.
- The 2026 autonomous editor shows hubs, trenches, bumps, towers, depots and midfield. Timing uses the same route executor and drivetrain as a match, including ascent/descent slowdown, braking, settling and action durations. Points that exceed the 20-second budget or land in blocked areas are rejected; invalid or over-budget autos cannot be saved or selected. Traffic can still change actual completion time.
- Robots brake before the front wheels reach a bump and remain slowed until the rear wheels leave the descent. Boosts still respect this terrain slowdown. The robot model rises and falls over the ramp while its shadow remains on the carpet.
- Match and editor routes share obstacle geometry. Tall robots use bumps; only low robots fit through trenches. Continuous route progress prevents steering back toward passed curve samples.
- The 2026 arena uses a straight overhead board with raised 3D structures and the same equipment geometry as the pit. The board fills its canvas with minimal margins; compact match controls leave more room for play. Light mode follows the supplied ice-blue reference, with raised borderless buttons and colored boost controls.
- Bézier corner rounding keeps obstacle checks. The 2026 drivetrain uses velocity-based steering, acceleration/braking limits, limited chassis rotation, and interpolated rendering. Base swerve speed is 9 ft/s (11.88 at level 5); matches start at 1× speed. Swerve AI paths also receive corner smoothing.
- In 2026, dumpers must settle below 0.8 ft/s and face the hub before firing. Base Dumper/Super Dumper output is 6/9 FUEL per second, but one defender cuts firing rate to 18% and reduces accuracy. Single/dual turrets fire at 3.6/5.4 FUEL per second, can shoot while moving, and retain 90% of firing rate under defense. Upgrades and boosts still apply.
- Dumper trays, turret bearings, intake direction indicators and net storage rendering have been improved. Models continue to reflect equipped parts.

Run `node test.cjs` for simulation regression checks, or `node build.cjs` to assemble `dist/` for static hosting. The autonomous editor is a schematic; the cyan in-match route includes obstacle detours, and travel-time estimates can differ from actual execution. This remains a game simulation, not a robot dynamics engineering tool.

An unofficial, FRC-inspired robot battler. This folder is the installable web app (PWA):
it runs in any modern browser, installs to a phone's home screen, and plays offline.

## Install it on a phone or computer
The game shows an **Install BOTS** card on the main menu when it's opened in a browser:
- **Android, ChromeOS, desktop Chrome / Edge:** tap **Install**. (Or **⋮ → Install app**.)
- **iPhone / iPad (Safari or Chrome):** follow the card: **Share → Add to Home Screen**.
- **Mac Safari:** **File → Add to Dock**.

## Friend multiplayer and ally boosts

- In a match, click a boost to apply it to your own robot. Drag a boost onto an allied robot to target that bot instead. Allied targets are highlighted while dragging; dropping on an opponent or outside the field cancels without spending the cooldown. Mouse, pen and touch use the same targeting. Boost cooldowns remain shared across your alliance's targets, and targeted boosts are recorded in single-player replays.
- In the pit, choose **Play with a friend**, then **Create room**. Share the 10-character code; the other player chooses **Join** in the same season. The host starts once both players are connected. Both people must load the updated build.
- Each player brings their equipped robot and selected autonomous routine. The host builds two alliances with two additional bots each. Select an allied robot under the field to direct its teleop route, and drag boosts onto allies. Empty route queues return robots to their normal AI behavior.
- These are unranked friend matches: no coins, ranking points, or leaderboard writes. The host controls match timing at 1x; both sides replay the same ordered simulation inputs. Frames and commands are acknowledged, duplicates are ignored, and missing frames are retried. Disconnects end the session; there is no mid-match reconnect or host migration. Keep the host tab open. Switching tabs keeps the simulation running on a worker-driven clock, and hidden guests continue consuming and acknowledging frames. Closing the tab, device sleep, or browser tab suspension still interrupts a browser-hosted session.
- Multiplayer uses the existing Supabase project's public Realtime Broadcast service, with no database migration or private server key. Room codes are shareable invitations, not authenticated private rooms. A host can modify their client, so this mode is intended for friends rather than competitive matchmaking. Only robot loadouts, team display information, match inputs, and synchronization messages are exchanged.
- `node test.cjs` covers targeting, replay compatibility, alliance ownership, shared cooldowns, complete two-client synchronization, duplicate/missing frames, and disconnect cleanup. `node test-relay.cjs` makes an optional live two-client broadcast check against the configured service. Realtime protocol: https://supabase.com/docs/guides/realtime/protocol

Multiplayer displays both alliances’ active/inactive hub indicators and shift countdowns. At the end, a regular-style results screen shows victory/defeat/tie, alliance robot contributions, score breakdown, and match objectives, with Pit and Play with a friend buttons. Friendly results do not write ranked rewards.

In the pit, drag sideways to rotate the robot/cart and vertically to roll the view up to 10 degrees in either direction. Focus the preview and use arrow keys for the same controls. Reset view, Home, or a double-click restores a level view. Motion is smoothed and automatic rotation respects reduced-motion preferences. The cart is display-only and does not affect robot weight, collision geometry, or match behavior.
