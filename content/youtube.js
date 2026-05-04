console.log("youtube.js loaded");

// Main async wrapper to initialize extension logic
(async function () {
  try {
    // Retrieve user settings from Chrome storage
    const settings = await chrome.storage.sync.get({
      enabled: true,
      youtube: true,
      focusMode: false
    });
    // Exit early if extension or Youtube blocking is disabled
    if (!settings.enabled || !settings.youtube) return;

    // Variables
    let focusMode = settings.focusMode;
    let lastUrl = location.href;
    let buttonCheckScheduled = false;
    let pageApplyScheduled = false;

    const SHORTS_HOME_URL = "https://www.youtube.com/";

    // Page type helpers
    const isHome = () => location.pathname === "/";
    const isWatch = () => location.pathname === "/watch";
    const isResults = () => location.pathname === "/results";
    // Detect if URL is a page that contains Shorts
    const isShorts = (url = location.href) => {
      try {
        const parsed = new URL(url, location.origin);
        return parsed.pathname === "/shorts" || parsed.pathname.startsWith("/shorts/");
      } catch {
        // Fallback for malformed URLs
        return location.pathname === "/shorts" || location.pathname.startsWith("/shorts/");
      }
    };

    // Redirects from Shorts page to homepage
    function redirectShorts() {
      if (!isShorts()) return false;
      location.replace(SHORTS_HOME_URL);
      return true;
    }

    // --------- STYLE SETUP ---------
    // Ensure just one tag is injected
    let style = document.getElementById("realblocker-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "realblocker-style";
      document.head.appendChild(style);
    }

    // CSS for Shorts blocking and Focus Mode UI
    function updateStyle() {
      style.textContent = `
        /* Hide Shorts Content */
        ytd-reel-shelf-renderer,
        ytd-reel-item-renderer,
        ytd-shorts-lockup-view-model,
        a[href="/shorts"],
        a[href^="/shorts/"] {
        display: none !important;
        }

        /* Remove Shorts shelf from appearing */
        ytd-reel-shelf-renderer {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
        }
        
        /* Focus Mode button */
        #focus-mode-btn {
          margin-left: 8px;
          height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          background: #0f0f0f;
          color: white;
          border: 1px solid rgba(255,255,255,0.2);
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          white-space: nowrap;
        }
        /* Hover effect for button */
        #focus-mode-btn:hover {
          opacity: 0.9;
        }

        /* Centered text when focus mode is ON */
        #realblocker-focus-text {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 32px;
          font-weight: 700;
          z-index: 999999;
          display: none;
          text-align: center;
          pointer-events: none;
          font-family: Arial, sans-serif;
        }

        /* Smoother transition for button */
        #focus-mode-btn {
          background: #0f0f0f;
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 0 0 rgba(255,255,255,0);
          transition: all 0.2s ease;
        }
        /* Glow + border change for button */
        #focus-mode-btn:hover {
          box-shadow: 0 0 12px rgba(255,255,255,0.15);
          border-color: rgba(255,255,255,0.3);
        }

        /* Glass + gradient look for button */
        #focus-mode-btn {
          height: 38px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.15);
        
          color: white;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.3px;
        
          background: linear-gradient(135deg, rgba(30,30,30,0.6), rgba(80,120,255,0.25));
          backdrop-filter: blur(8px);
        
          cursor: pointer;
          transition: all 0.25s ease;
        
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        /* Background glows when mouse is hovering */
        #focus-mode-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: linear-gradient(135deg, #4f7cff, #9f6bff);
          opacity: 0;
          z-index: -1;
          transition: opacity 0.25s ease;
        }
        
        /* Glow effect on hover */
        #focus-mode-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 20px rgba(100,140,255,0.25);
        }
        
        /* Display glow layer while hovering */
        #focus-mode-btn:hover::before {
          opacity: 0.15;
        }
        
        /* Click animation */
        #focus-mode-btn:active {
          transform: scale(0.96);
        }
        
        /* Focus mode is ON  */
        #focus-mode-btn.active {
          background: linear-gradient(135deg, rgba(80,120,255,0.4), rgba(160,100,255,0.4));
          box-shadow: 0 0 18px rgba(120,150,255,0.4);
          border-color: rgba(255,255,255,0.3);
        }
        /* Spacing/Sizing adjustments */
        #focus-mode-btn {
          padding: 0 16px;
          height: 38px;
          border-radius: 999px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        /* Alternate active style */
        #focus-mode-btn.active {
          background: linear-gradient(135deg, #1f1f1f, #2a2a2a);
          border-color: rgba(255,255,255,0.4);
          box-shadow: 0 0 14px rgba(255,255,255,0.2);
        }

        /* Subtext styling inside focus overlay */
        #realblocker-focus-text .sub {
          font-size: 14px;
          opacity: 0.7;
          margin-top: 8px;
          font-weight: 400;
        }

        /* Hide youtube sidebar navigation in Focus Mode */
        html.realblocker-focus ytd-guide-renderer,
        html.realblocker-focus ytd-mini-guide-renderer,
        html.realblocker-focus #guide,
        html.realblocker-focus #mini-guide {
          display: none !important;
        }

        /* Hide youtubes home page */
        html.realblocker-focus.realblocker-home ytd-browse[page-subtype="home"],
        html.realblocker-focus.realblocker-home ytd-rich-grid-renderer {
          display: none !important;
        }

        /* Hide reccomendations, comments, etc */
        html.realblocker-focus.realblocker-watch #secondary,
        html.realblocker-focus.realblocker-watch #related,
        html.realblocker-focus.realblocker-watch #comments,
        html.realblocker-focus.realblocker-watch ytd-watch-next-secondary-results-renderer,
        html.realblocker-focus.realblocker-watch #chat {
          display: none !important;
        }

        /* Center main video player */
        html.realblocker-focus.realblocker-watch #columns,
        html.realblocker-focus.realblocker-watch #primary,
        html.realblocker-focus.realblocker-watch #primary-inner {
          max-width: 1000px !important;
          margin: 0 auto !important;
        }
      `;
    }
    // Apply style 
    updateStyle();

    // ---------- FOCUS TEXT ----------
    // Create text when focus mode is ON
    let focusText = document.getElementById("realblocker-focus-text");
    if (!focusText) {
      focusText = document.createElement("div");
      focusText.id = "realblocker-focus-text";
      focusText.innerHTML = `
        <div>Focus Mode is On</div>
        <div class="sub">Distracting elements are hidden</div>
      `;
      document.documentElement.appendChild(focusText);
    }

    // Update page depending on current page + focus state
    function updatePageClasses() {
      const root = document.documentElement;

      root.classList.toggle("realblocker-focus", !!focusMode);
      root.classList.toggle("realblocker-home", !!focusMode && isHome());
      root.classList.toggle("realblocker-watch", !!focusMode && isWatch());
      root.classList.toggle("realblocker-results", !!focusMode && isResults());

      focusText.style.display = focusMode && isHome() ? "block" : "none";
    }

    // ---------- BUTTON ----------
    // Location of focus mode button in youtube header
    function getButtonHost() {
      return (
        document.querySelector("#buttons.ytd-masthead") ||
        document.querySelector("ytd-masthead #end") ||
        document.querySelector("#end")
      );
    }

    // Create and attach focus mode toggle button 
    function ensureFocusButton() {
      const host = getButtonHost();
      if (!host) return;

      let btn = document.getElementById("focus-mode-btn");

      if (!btn) {
        btn = document.createElement("button");
        btn.id = "focus-mode-btn";
        btn.type = "button";

        // Turn focus mode ON when button is clicked
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          focusMode = !focusMode;
          await chrome.storage.sync.set({ focusMode });
          updateButtonText();
          applyPageState();
        });
      }

      // Make sure button stays in the right location
      if (btn.parentElement !== host) {
        host.appendChild(btn);
      }

      updateButtonText();
    }

    // Labeling for button on/off
    function updateButtonText() {
      const btn = document.getElementById("focus-mode-btn");
      if (btn) btn.textContent = focusMode ? "Focus On" : "Focus Off";
    }

    // Delay button injection 
    function scheduleButtonCheck() {
      if (buttonCheckScheduled) return;
      buttonCheckScheduled = true;

      setTimeout(() => {
        buttonCheckScheduled = false;
        ensureFocusButton();
      }, 300);
    }

    // Hide "Shorts" tab under youtube header
    function hideShortsTab() {
      document.querySelectorAll("yt-chip-cloud-chip-renderer").forEach(chip => {
        const text = chip.innerText.trim().toLowerCase();
        if (text === "shorts") {
          chip.style.display = "none";
        }
      });
    }
    // ---------- LIGHT SHORTS CLEANUP ----------
    // Hide Shorts-related links from sidebar/navigation
    function hideShortsNavItems() {
      document
        .querySelectorAll('a[title="Shorts"], a[href="/shorts"], a[href^="/shorts/"]')
        .forEach((link) => {
          const item = link.closest(
            "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, tp-yt-paper-item, ytd-rich-section-renderer, ytd-item-section-renderer, ytd-shelf-renderer"
          );
          if (item) item.style.display = "none";
        });
    }

    // Remove "Playables" game section from homepage
    function removePlayables() {
      document.querySelectorAll("ytd-rich-section-renderer").forEach(el => {
        const text = el.innerText?.toLowerCase() || "";
    
        if (
          text.includes("playables") ||
          text.includes("instant games")
        ) {
          el.remove();
        }
      });
    }

    // Remove any Shorts containers when detected
    function killShortsImmediately(node) {
      if (!node || node.nodeType !== 1) return;
    
      // Climb up parent container
      let container = node.closest?.(
        "ytd-rich-section-renderer, ytd-item-section-renderer, ytd-shelf-renderer"
      );
    
      if (!container) container = node;
    
      const hasShorts =
        container.querySelector?.('a[href^="/shorts"]') ||
        container.innerText?.toLowerCase().includes("shorts") ||
        container.querySelector?.('yt-icon[icon="yt-icons:shorts"]');
    
      if (hasShorts) {
        container.remove();
      }
    }

    // ---------- SEARCH / NAV BLOCK ----------
    // Detecting if user searches for Shorts
    function searchLooksLikeShorts() {
      const input =
        document.querySelector('input[name="search_query"]') ||
        document.querySelector("#search");
      if (!input) return false;

      const value = (input.value || "").trim().toLowerCase();
      return value === "shorts" || value.startsWith("shorts ");
    }

   // Block user from viewing Shorts
    document.addEventListener(
      "submit",
      (e) => {
        const form = e.target;
        if (!form?.querySelector?.('input[name="search_query"]')) return;

        if (searchLooksLikeShorts()) {
          e.preventDefault();
          e.stopPropagation();
          location.replace(SHORTS_HOME_URL);
        }
      },
      true
    );

    // Block clicking Shorts links or searching Shorts via button
    document.addEventListener(
      "click",
      (e) => {
        const shortsLink = e.target.closest('a[href="/shorts"], a[href^="/shorts/"]');
        if (shortsLink) {
          e.preventDefault();
          e.stopPropagation();
          location.replace(SHORTS_HOME_URL);
          return;
        }

        const searchButton = e.target.closest("#search-icon-legacy, button[aria-label='Search']");
        if (searchButton && searchLooksLikeShorts()) {
          e.preventDefault();
          e.stopPropagation();
          location.replace(SHORTS_HOME_URL);
        }
      },
      true
    );

    // Block pressing Enter if searching Shorts
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter") return;

        const active = document.activeElement;
        if (
          active &&
          (active.name === "search_query" ||
            active.id === "search" ||
            active.closest?.("form"))
        ) {
          if (searchLooksLikeShorts()) {
            e.preventDefault();
            e.stopPropagation();
            location.replace(SHORTS_HOME_URL);
          }
        }
      },
      true
    );
    // Remove Shorts shelf from homepage
    function removeShortsShelf() {
      document.querySelectorAll("ytd-reel-shelf-renderer").forEach(el => {
        const container = el.closest(
          "ytd-rich-section-renderer, ytd-item-section-renderer, ytd-shelf-renderer"
        );
        if (container) {
          container.remove();
        } else {
          el.remove();
        }
      });
    }
    // ---------- APPLY ----------
    // Apply cleanup + UI logic
    function applyPageState() {
      if (redirectShorts()) return;
      updatePageClasses();
      ensureFocusButton();
      hideShortsNavItems();
      hideShortsTab();
      removeShortsShelf();
      removePlayables();
    }

    // Prevent repeated cleanup calls
    let shortsCleanupScheduled = false;

    // Delay Shorts cleanup to stabilize DOM
    function scheduleShortsCleanup() {
      if (shortsCleanupScheduled) return;
    
      shortsCleanupScheduled = true;
    
      setTimeout(() => {
        shortsCleanupScheduled = false;
        removeShortsShelf();
      }, 150);
    }

    // Schedule page  updates efficiently
    function scheduleApply() {
      if (pageApplyScheduled) return;
      pageApplyScheduled = true;

      requestAnimationFrame(() => {
        pageApplyScheduled = false;
        applyPageState();
      });
    }

    // ---------- URL CHANGE ----------
    // Detect SPA navigation changes on youtube
    function handleUrlChange() {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      scheduleApply();
    }

    // Hook into history navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      originalPushState.apply(this, arguments);
      handleUrlChange();
    };

    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      handleUrlChange();
    };

    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("yt-navigate-finish", handleUrlChange);

    // ---------- SMALL OBSERVER ----------
    // Watch DOM for new elements and remove Shorts dynamically
    const observer = new MutationObserver((mutations) => {
      scheduleButtonCheck();
      hideShortsTab();
      scheduleShortsCleanup();
    
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          killShortsImmediately(node);
        }
      }
      removePlayables();
    });
    

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // ---------- STORAGE ----------
    // Sync focus mdoe state across tabs
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;

      if (typeof changes.focusMode?.newValue !== "undefined") {
        focusMode = changes.focusMode.newValue;
        scheduleApply();
      }
    });

    // ---------- INIT ----------
    // Initial load
    if (redirectShorts()) return;
    applyPageState();

  } catch (err) {
    console.error(err);
  }
})();
