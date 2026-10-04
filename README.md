# Anxious Axolotl

[**Play Anxious Axolotl in your browser**](https://thehillbeyondthisone.github.io/AnxiousAxolotl/)

Meet Axel, a little pink axolotl with a big resort to explore. Swim, sneak past guards, collect snacks, trade with the Sewer Rat, go fishing, and make a cozy home. Free to play, with no account required.

## Easy controls

Turn your phone or tablet sideways. Your first game shows three short lessons, and **Help** opens them again anytime.

| What you want to do | Touch | Keyboard |
| --- | --- | --- |
| Move | Slide the pink stick on the left; let go to stop | WASD or arrow keys |
| Do something nearby | Tap the big blue button on the right; its word changes to Talk, Dive, Search, and more | E or Space |
| Use your bag | Tap **Bag** | B or I |
| Take a break | Tap **Pause**, then **Keep playing** | Escape |
| Pick a quick tool | Tap Seeds, Water, or Snack; tap the selected tool again to use it | 1, 2, or 3 |
| Catch a fish | Tap Reel when a fish bites. Hold to lift the catch bar; let go to lower it | Hold/release E or Space |

“Go closer” means there is nothing to use yet. Walk toward a friend, door, or treasure. Water fills the blue bar. You can move with one finger while tapping with another.

**More** contains Shop, Awards, Outfits, and Pets. Opening menus, reading dialogue, backgrounding the game, and turning a small screen upright pause the relevant gameplay. The normal developer controls are hidden; developers can use `?dev=1`.

Progress and upgrades save in this browser on this device. Localhost and the public site have separate saves; clearing browser data removes that site's save. Reset is tucked inside **Pause → Grown-up options**.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. `npm run build` creates `dist`; `npm run preview` previews that build. GitHub Actions runs the input tests, builds the game, and deploys `main` to GitHub Pages. Relative asset URLs support the repository's `/AnxiousAxolotl/` path.

## Art and development

The touch polish uses a shared lake-blue, soft-pink, cream, and wood palette, a custom pixel Axel mascot, labeled controls, and readable body text. Existing world art and progression are retained. This public snapshot contains the committed game and the art/control polish; unfinished local experiments are excluded.

Codex assisted with this polish, implementation, and verification. `npm test` covers the input regressions: independent movement/action fingers, cancellation and capture loss, pause gates, blur/background/resize resets, single tap activation, resizing, and diagonal speed. Browser checks cover menu navigation and landscape phone/tablet layouts. Automated checks do not establish real-device touch feel, speaker behavior, long-session performance, or an eight-year-old's playtest acceptance.

Third-party assets have their own licenses and are **not** covered by a blanket code license. See [asset credits and included terms](ASSET_CREDITS.md). This is a non-commercial game; please do not extract or redistribute the asset libraries.
