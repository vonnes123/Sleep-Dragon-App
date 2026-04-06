# Sleep Dragon — Sleep Lense

A sleep digital twin PWA where a virtual pixel dragon mirrors your sleep quality. Built with vanilla HTML/CSS/JS and a lightweight Express server.

---

## Requirements

- [Node.js](https://nodejs.org/) v16 or higher
- A modern browser (Chrome or Safari recommended)

---

## Running the App

**1. Install dependencies**
```bash
npm install
```

**2. Start the server**
```bash
node server.js
```

**3. Open the app**

Navigate to [http://localhost:8080](http://localhost:8080) in your browser.

---

## Remote Control

The remote control is a developer tool designed to be opened in a **separate browser tab** while the main app is open in another. It communicates with the main app in real time via the BroadcastChannel API.

**To open the remote control:**

1. Make sure the main app is open at `http://localhost:8080`
2. Open a **new tab** and navigate to `http://localhost:8080/#remote-control`
3. Both tabs must be open in the **same browser** for the connection to work

---

## Remote Control Buttons

### 🌅 Next Day
Advances the app to the next dataset entry, simulating a new morning. The dragon falls asleep, then a popup appears on the home screen showing the food reward earned based on last night's sleep efficiency. The user rates their sleep using the smiley scale, after which the dragon wakes up with a mood matching the new entry's efficiency score.

### 🍖 Give Random Food
Adds a random food item of random quality directly to the dragon's food stash on the home screen. Useful for testing the feeding interaction without going through the Next Day flow.

### 🔔 Send Sleep Nudge
Sends an immediate sleep nudge notification to the user. The message is tailored based on the current entry's sleep efficiency score and is phrased as the dragon encouraging better sleep in exchange for better food rewards. If browser notifications are not available or have been denied, the nudge appears as an in-app toast at the top of the screen.

### ← Prev / Next →
Navigates backwards or forwards through the dataset entries without triggering the full Next Day flow. Updates all report charts (Today, Weekly, Monthly) to reflect the selected entry. Useful for browsing historical sleep data during a demo.

### Dragon Mode
Manually sets the dragon's emotional state independent of the current entry:
- **Normal** — default idle animation
- **Tired** — slow, drowsy animations
- **Energetic** — lively, bouncy animations

### Animations
Manually triggers individual dragon animations for testing or demonstration purposes:
- **Fall Asleep** — plays the fall asleep animation then transitions to the sleep loop
- **Wake Up** — plays the wake up animation then returns to idle
- **Level Up** — plays the level up celebration animation
- **Anticipating Food** — loops the food anticipation animation indefinitely
- **Eating** — plays the chewing animation twice

---

## Data Files

| File | Description |
|------|-------------|
| `data/Sleep_data_2022.csv` | Source dataset — 319 nightly sleep entries |
| `data/dragon-state.json` | Persisted dragon state — level, XP, food stash, food history |
| `data/sleep-ratings.json` | Persisted user sleep ratings — one entry per rated night |

> If either JSON file becomes corrupted, replace its contents with `{}` for ratings or the default state object for dragon state and restart the server.

---

## Project Structure

```
sleep-dragon/
├── index.html              # App shell, bottom nav, sleep popup
├── server.js               # Express server, save endpoints
├── css/
│   └── main.css            # Full design system
├── js/
│   ├── app.js              # Page controllers, renderHome, popup logic
│   ├── router.js           # Hash-based SPA routing
│   ├── dragon.js           # Sprite animation engine, BroadcastChannel
│   ├── charts.js           # Chart.js wrappers for all charts
│   ├── weekly.js           # Weekly and monthly data builders
│   ├── data-loader.js      # CSV parser and data access
│   ├── progression.js      # XP, levelling, food stash logic
│   └── sleep-ratings.js    # Sleep rating persistence
├── pages/                  # HTML partials loaded by router
├── assets/
│   ├── dragon/             # Dragon sprite sheets and static images
│   └── food/               # Food item pixel art images
└── data/                   # JSON state files and CSV dataset
```
