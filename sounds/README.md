# Match phase sounds

Clips selected from the user-supplied [Myinstants FRC search](https://www.myinstants.com/en/search/?name=frc).

| Local file | Source | Cue |
| --- | --- | --- |
| frc-start-sound.mp3 | https://www.myinstants.com/en/instant/frc-start-sound-27140/ | Autonomous start |
| frc-end.mp3 | https://www.myinstants.com/en/instant/frc-end-37198/ | Autonomous end and teleop end |
| frc-resume.mp3 | https://www.myinstants.com/en/instant/frc-resume-91569/ | Teleop start, after autonomous end clip |
| frc-warning.mp3 | https://www.myinstants.com/en/instant/frc-warning-9351/ | Endgame start |

MP3s are bundled locally and cached for offline play. `build-sounds.cjs` also packages their exact bytes in `field-clips.js`, so opening `index.html` directly works without browser-blocked MP3 fetches. Run `node build.cjs` after replacing clips to regenerate both the script and distributable files. All clips use the field sound mute and volume controls. Robot sound effects and alliance shift cues remain synthesized.
