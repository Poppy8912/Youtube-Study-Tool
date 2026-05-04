# Real-Blocker
A browser extension that removes Youtube Shorts and distractions to help you stay focused.

## Demo

### Homepage (Before)
![Homepage Before](./browser_screenshots/Homepage_before.png)

### Homepage (After)
![Homepage After](./browser_screenshots/Homepage_after.png)
### Focus Mode
![Focus Mode](./browser_screenshots/focus-mode.png

## Features
- Removes Youtube Shorts from homepage and search
- Focus Mode to reduce distractions
- Dynamic clceanup using MutationObserver
- Lightweight and fast

## Tech Stack
- JavaScript
- Chrome Extension API (Manifest V3)
- CSS (DOM manipulation and hiding elements)

## How It Works
The extension detects and removes Shorts content by:
- Targeting Shorts containers (e.g., ytd-reel-shelf-renderer)
- Using a MutationObserver to handle dynamically loaded content
- Hiding or removing parent containers to prevent layout issues

## Installation
- Clone the repo
- Go to chrome://extensions/
- Enable "Developer Mode"
- Click "Load unpacked"
- Select this folder

## Why I built this
I built this to reduce distractions while studying, since Youtube Shorts were negatively affecting my focus.


