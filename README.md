# BOTS: Build Optimize Team Score — web app

An unofficial, FRC-inspired robot battler. This folder is the installable web app (PWA):
it runs in any modern browser, installs to a phone's home screen, and plays offline.

## Host it on GitHub Pages
1. Create a new public repository on GitHub (for example `bots`).
2. Upload everything in this folder to the repository's root
   (on github.com: **Add file → Upload files**, drag the files in, **Commit**).
   Include the `icons` folder and the hidden `.nojekyll` file.
3. Open **Settings → Pages**. Under **Build and deployment**, choose
   **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute the game is live at `https://<your-username>.github.io/<repo>/`.

## Install it on a phone or computer
The game shows an **Install BOTS** card on the main menu when it's opened in a browser:
- **Android, ChromeOS, desktop Chrome / Edge:** tap **Install**. (Or **⋮ → Install app**.)
- **iPhone / iPad (Safari or Chrome):** follow the card: **Share → Add to Home Screen**.
- **Mac Safari:** **File → Add to Dock**.

## Android TV / Google TV (Chromecast with Google TV, Sony, TCL, Hisense, NVIDIA Shield…)
TVs can't install web apps, so use the Android app (`BOTS.apk`, included in this folder):
1. On the TV, install **Downloader** (by AFTVnews) from the Google Play Store.
2. Allow it to install apps: **Settings → Apps → Security & restrictions → Unknown sources → Downloader → On**
   (on Google TV: **Settings → System → About → tap Android TV OS build 7 times** to unlock developer mode first if the option is hidden).
3. In Downloader, enter `https://<your-username>.github.io/<repo>/BOTS.apk` and install.
4. BOTS appears in **Apps** on the TV home screen. Play with the remote: arrows move between buttons,
   **OK** selects, **Back** goes back. In a match the arrows aim a crosshair on the field and OK drives your robot there;
   push **down** past the bottom edge of the field to reach the boosts and SCORE IN.

It opens full screen like a native app and keeps working without a connection
(the leaderboard needs internet). Saved robots live on that device/browser.

## Updating
Rebuild (`python3 build.py && python3 pwa/build_pwa.py` in the source) and upload the new files over
the old ones. Players get the new version the next time they open the app.
