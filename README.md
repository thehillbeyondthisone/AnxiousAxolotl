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

Progress and upgrades save in this browser on this device. Localhost and the public site have separate saves; different preview ports also have separate saves. Clearing browser data removes that site's save. Reset is tucked inside **Pause → Grown-up options**.

## Home life milestone in this checkout

**More → Journal** offers an optional path from meeting the rat to fishing, growing a crop, and decorating your cabin. Hide its HUD hint whenever you prefer to explore freely. The woods trail is open from the start; the Water Helmet still provides unlimited time on land.

The turtle vendor sells six furnishings, seed packs, a sprinkler and four extra farm plots, alongside the existing home upgrades. A potted plant costs 20 pebbles and can live in the flooded cabin. Other new furnishings need the Bilge Pump. In your cabin, choose **More → Decorate**, select a furnishing, tap a grid spot, and choose **Place**. **Save room** commits your draft; **Cancel** discards it. Stored furnishings remain yours. Doorways and essential furniture stay accessible.

Plant and water crops, then sleep in the free cabin bed to advance a day. Turtle Cove helpers water one crop each morning; the sprinkler waters every growing crop and newly planted seeds. The Shell Sorting Shelf enables sorted storage and **Store all carried items**. Your material pouch and tools stay with you.

At the cabin, **Pets → Play Together** starts puppy fetch or kitten toy chase. Tap while the dot is in green three times within 20 seconds. The world pauses during play. Each companion can earn its happiness boost once per game day; repeat play is still available. Companions staying home can rest in their bed or sun patch, and kittens can use the cat tree.

Visits reopen safely at the campsite lake with full hydration and oxygen. Your bag, crafting supplies, upgrades, companions, farm, room layout, journal, active errand, and day are retained. Surroundings refresh, and unfinished minigames restart. Nothing grows or gets hungry while the browser is closed. Being caught also retains your day, quests and possessions.

**Pause → Grown-up options → Your save** exports a local JSON backup or imports one after showing its contents. A last-valid backup supports recovery from corruption, and the original legacy profile is retained during migration. Newer unsupported save versions are preserved with automatic saving disabled. A visible status reports unavailable storage. Saves occur after meaningful changes, every 30 active seconds, and when leaving or backgrounding the page. Importing or resetting suspends the old session’s exit save so it cannot undo the replacement.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. `npm run build` creates `dist`; `npm run preview` previews that build. GitHub Actions runs the tests, builds the game, and deploys `main` to GitHub Pages. Relative asset URLs support the repository's `/AnxiousAxolotl/` path. This local milestone has not been published by this implementation task.

## Art and development

The touch polish uses a shared lake-blue, soft-pink, cream, and wood palette, a custom pixel Axel mascot, labeled controls, and readable body text. Home furnishings reuse the included art. The shared image registry decodes world pictures before boot and loads each optional disc’s pictures when needed; failed groups offer a retry. Audio remains asynchronous and unlocks on a user gesture.

Codex assisted with implementation and verification. `npm test` covers input regressions, save migration and recovery, import/reset lifecycle, milestone rewards, furniture validation, companion routes and rewards, farm helpers, and deferred image loading/retry. Browser checks use isolated saves and scripted gameplay fixtures to cover the first chapter, safe-lake reopening, home editing, existing minigames, all five discs, and landscape phone/tablet layouts. They do not establish real-device touch feel, speaker behavior, long-session performance, or a child's playtest acceptance. The first-improvement target of 20 minutes remains provisional until a real playtest.

Third-party assets have their own licenses and are **not** covered by a blanket code license. See [asset credits and included terms](ASSET_CREDITS.md). This is a non-commercial game; please do not extract or redistribute the asset libraries.
