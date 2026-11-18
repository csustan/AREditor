# Local changes to `ARnft.js`

`ARnft.js` in this folder is the prebuilt `@webarkit/ar-nft` **v0.14.6** bundle with some local edits.
If you replace it with a newer upstream build, the edits are lost. Follow this guide to add them back.

## Why these changes exist

The stock ARnft bridge only passes the `oef` (One Euro Filter on/off) flag to the tracking worker.
The AREditor NFT export writes extra settings into `config-<name>.json`
(see `editor/js/NFTMarkerExportSettings.js`). They look like this:

```json
"camera": {
  "near": 0.1,
  "far": 1000
},
"tracking": {
  "thresholdMode": "trackerDefault",
  "threshold": 100,
  "oef": true,
  "filterMinCF": 0.0001,
  "filterBeta": 0.01,
  "warmUpSamples": 5
},
"oef": true
```

With the local changes:

1. ARnft sends the **whole config object** (`this.appData`) to the worker, not just `appData.oef`.
2. The worker applies the camera near/far planes, the threshold mode and threshold, and the One Euro Filter options.
3. Bad settings and worker load failures are sent back to the page as an `"error"` message and logged.
   Before this, they failed silently.

If you skip these changes, the exported app still runs, but it ignores every setting except `oef`.

## Where the code lives

`ARnft.js` is a webpack bundle. The tracking worker is **not** a separate file at runtime.
Its whole source is embedded in `ARnft.js` as one escaped string (see `function Worker_fn()`).
That gives us three files to keep in sync:

| File | Role | Loaded at runtime? |
| --- | --- | --- |
| `ARnft.js` | The bundle that `index.html` loads. Contains the `NFTWorker` class **and** the embedded worker string. | **Yes** |
| `NFTWorker.js` | Readable source of the `NFTWorker` class (main-thread side). | No (reference only) |
| `Worker.js` | Readable source of the worker (tracking side). | No (reference only) |

Only `ARnft.js` affects the exported app. `NFTWorker.js` and `Worker.js` hold the same edits in readable form, so you can copy code from them.
Upstream has matching files at `src/NFTWorker.ts` and `src/Worker.ts`.

There are two ways to bring the changes back:

- **Option A: rebuild from source (cleanest).** Clone ARnft at the version you want.
  Apply the `NFTWorker.js` and `Worker.js` changes below to `src/NFTWorker.ts` and `src/Worker.ts`.
  Apply the two `initialize(...)` call-site changes to `src/ARnft.ts`. Then run the project's build and copy `dist/ARnft.js` here.
- **Option B: patch the new prebuilt `ARnft.js` by hand.** Follow Parts 1–3 below.

In both cases, finish with the **Verify** section.

> Find code by searching for the snippets shown. Line numbers change between versions.
> Webpack-generated names such as `_NFTWorker__WEBPACK_IMPORTED_MODULE_4__` may also differ in a new bundle.
> Keep whatever names the new bundle uses.

---

## Part 1: The `ARnft` class (two call sites)

Search for `this.appData.oef`. There are two `initialize(...)` calls: one in the normal init path and one in the raw-camera init path.
Change **both** of them:

```js
// before
this.controllers[index].initialize(this.appData.cameraPara, renderUpdate, trackUpdate, this.appData.oef);

// after
// Forward the full export config so the worker can apply camera and tracking options.
this.controllers[index].initialize(this.appData.cameraPara, renderUpdate, trackUpdate, this.appData);
```

## Part 2: The `NFTWorker` class

Search for `class NFTWorker`. The same edits are in `NFTWorker.js`.

**2a. `initialize`:** rename the last parameter and pass it through.

```js
async initialize(cameraURL, renderUpdate, trackUpdate, settings) {
    ...
    return await this.load(cameraURL, renderUpdate, trackUpdate, settings);
}
```

**2b. `load`:** accept `settings`, normalize it, and send it to the worker.

```js
load(cameraURL, renderUpdate, trackUpdate, settings) {
    // Preserve compatibility with callers that still provide only the OEF boolean.
    const exportSettings = settings && typeof settings === "object" ? settings : { oef: settings };
    let [sw, sh, pw, ph, w, h] = getWindowSize(this.vw, this.vh);
    ...
    this.worker.postMessage({
        type: "load",
        ...
        addPath: this.addPath,
        oef: exportSettings.oef,      // was: oef: oef,
        settings: exportSettings,     // new
    });
```

**2c. `this.worker.onmessage`:** add an `"error"` case at the top of the `switch (msg.type)`.

```js
case "error": {
    // Report worker-side configuration and initialization failures to the page.
    console.error("NFT tracking worker error:", msg.message);
    break;
}
```

Update the JSDoc `@param oef` lines to `@param settings` as well. This is optional.

## Part 3: The embedded worker (inside `Worker_fn`)

The worker source is one long, escaped string literal, so editing it in place is error-prone.
Extract it to a normal file, edit that file, and embed it again. This helper does that.
Save it outside the repo (for example as `arnft_worker.py`):

```python
import json, sys
KEY = 'inline_js__WEBPACK_IMPORTED_MODULE_0___default()("'
def span(src):
    start = src.index(KEY) + len(KEY) - 1
    _, length = json.JSONDecoder().raw_decode(src[start:])
    return start, start + length
mode, bundle, worker = sys.argv[1:4]
src = open(bundle, encoding="utf-8", newline="").read()
start, end = span(src)
if mode == "extract":
    open(worker, "w", encoding="utf-8", newline="").write(json.loads(src[start:end]))
else:
    code = open(worker, encoding="utf-8", newline="").read()
    open(bundle, "w", encoding="utf-8", newline="").write(src[:start] + json.dumps(code) + src[end:])
```

```sh
python3 arnft_worker.py extract ARnft.js /tmp/worker-src.js   # 1. pull the worker out
# 2. edit /tmp/worker-src.js as described below
python3 arnft_worker.py embed   ARnft.js /tmp/worker-src.js   # 3. put it back
```

(`newline=""` matters. The embedded code contains `\r\n` line endings, and without it Python silently converts them.
If a new bundle wraps the worker differently and `KEY` is not found, find the `Worker_fn` function and change `KEY` to match.)

In the extracted worker, look for `ctx.onmessage` and the `load` function. Make the six edits below.
They match `Worker.js` exactly, except that in the bundle `OneEuroFilter` is called through a webpack name
such as `_webarkit_oneeurofilter_ts__WEBPACK_IMPORTED_MODULE_1__.OneEuroFilter`. Keep the bundle's name.

**3a. Catch load failures in `ctx.onmessage`:**

```js
case "load": {
    load(msg).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error initializing NFT worker:", error);
        ctx.postMessage({ type: "error", message });
    });
    return;
}
```

**3b. Replace the filter constants.** Replace this block:

```js
const WARM_UP_TOLERANCE = 5;
let tickCount = 0;
let oef;
let filterMinCF = 0.0001;
let filterBeta = 0.01;
const filter = new OneEuroFilter(filterMinCF, filterBeta);
```

with:

```js
const DEFAULT_CAMERA_NEAR = 0.1;
const DEFAULT_CAMERA_FAR = 1000;
const DEFAULT_FILTER_MIN_CUTOFF = 0.0001;
const DEFAULT_FILTER_BETA = 0.01;
const DEFAULT_WARM_UP_SAMPLES = 5;
const THRESHOLD_MODES = {
    manual: 0,
    autoMedian: 1,
    autoOtsu: 2,
    autoAdaptive: 3,
    autoBracketing: 4
};
let tickCount = 0;
let oef;
let filterMinCF = DEFAULT_FILTER_MIN_CUTOFF;
let filterBeta = DEFAULT_FILTER_BETA;
let warmUpSamples = DEFAULT_WARM_UP_SAMPLES;
let filter = new OneEuroFilter(filterMinCF, filterBeta);   // note: `let`, not `const`

const readNumberSetting = (value, fallback, minimum, maximum, name) => {
    if (value === undefined || value === null) {
        return fallback;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
        throw new RangeError(name + " must be a number between " + minimum + " and " + maximum + ".");
    }
    return number;
};
```

The `THRESHOLD_MODES` numbers are ARToolKit's `AR_LABELING_THRESH_MODE_*` values.
The mode names must match the ones `editor/js/NFTMarkerExportSettings.js` writes. `"trackerDefault"` means "don't change it".

**3c. In `oefFilter`:** change `if (tickCount > WARM_UP_TOLERANCE)` to `if (tickCount > warmUpSamples)`.

**3d. At the top of `load`:** replace `oef = msg.oef;` with:

```js
const settings = msg.settings && typeof msg.settings === "object" ? msg.settings : {};
const cameraSettings = settings.camera && typeof settings.camera === "object" ? settings.camera : {};
const trackingSettings = settings.tracking && typeof settings.tracking === "object" ? settings.tracking : {};
const cameraNear = readNumberSetting(cameraSettings.near, DEFAULT_CAMERA_NEAR, 0.001, 1000, "camera.near");
const cameraFar = readNumberSetting(cameraSettings.far, DEFAULT_CAMERA_FAR, 0.01, 1000000, "camera.far");
if (cameraFar <= cameraNear) {
    throw new RangeError("camera.far must be greater than camera.near.");
}
const threshold = readNumberSetting(trackingSettings.threshold, 100, 0, 255, "tracking.threshold");
if (!Number.isInteger(threshold)) {
    throw new RangeError("tracking.threshold must be an integer.");
}
const thresholdModeName = trackingSettings.thresholdMode;
let thresholdMode = null;
if (thresholdModeName !== undefined && thresholdModeName !== null && thresholdModeName !== "trackerDefault") {
    if (!Object.prototype.hasOwnProperty.call(THRESHOLD_MODES, thresholdModeName)) {
        throw new RangeError("Unknown NFT threshold mode: " + thresholdModeName);
    }
    thresholdMode = THRESHOLD_MODES[thresholdModeName];
}
filterMinCF = readNumberSetting(trackingSettings.filterMinCF, DEFAULT_FILTER_MIN_CUTOFF, 0.0001, 10, "tracking.filterMinCF");
filterBeta = readNumberSetting(trackingSettings.filterBeta, DEFAULT_FILTER_BETA, 0, 10, "tracking.filterBeta");
warmUpSamples = readNumberSetting(trackingSettings.warmUpSamples, DEFAULT_WARM_UP_SAMPLES, 0, 120, "tracking.warmUpSamples");
if (!Number.isInteger(warmUpSamples)) {
    throw new RangeError("tracking.warmUpSamples must be an integer.");
}
filter = new OneEuroFilter(filterMinCF, filterBeta);
tickCount = 0;
oef = typeof trackingSettings.oef === "boolean" ? trackingSettings.oef :
    typeof settings.oef === "boolean" ? settings.oef : msg.oef;
```

`oef` is read from `tracking.oef` first, then the top-level `oef`, then the old `msg.oef`.
This keeps older configs working.

**3e. In `onLoad`:** apply the settings right after `ar = arController;` and before `ar.getCameraMatrix()`.
The order matters because the projection matrix is read right after.

```js
ar = arController;
ar.setProjectionNearPlane(cameraNear);
ar.setProjectionFarPlane(cameraFar);
if (thresholdMode !== null) {
    ar.setThresholdMode(thresholdMode);
    if (thresholdMode === THRESHOLD_MODES.manual) {
        ar.setThreshold(threshold);
    }
}
const cameraMatrix = ar.getCameraMatrix();
```

**3f. In `onError` (inside `load`):** report the error to the page.

```js
const onError = (error) => {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    ctx.postMessage({ type: "error", message });
};
```

Then embed the worker again (step 3 of the helper commands).

## Part 4: Header comments (optional)

The current files carry reminder comments, which are worth copying back:

- At the very top of `ARnft.js`, there is a block comment explaining the customization. Copy it from the old file.
- Directly above `function Worker_fn()`:
  `// Generated inline-worker payload; keep its settings logic in sync with Worker.js.`
- At the top of `Worker.js`, below `/* eslint-env worker */`:
  `// Keep the packaged inline worker in ARnft.js synchronized with this source.`

---

## Verify

1. **Syntax:** `node --check ARnft.js` must print nothing.
2. **Patch present:** extract the worker again and grep for the new code.
   ```sh
   python3 arnft_worker.py extract ARnft.js /tmp/check.js
   grep -c "readNumberSetting\|THRESHOLD_MODES\|setProjectionNearPlane" /tmp/check.js   # should be > 0
   grep -c "this.appData.oef" ARnft.js                                                # should be 0
   ```
3. **API still exists:** the new code calls `setProjectionNearPlane`, `setProjectionFarPlane`,
   `setThresholdMode` and `setThreshold` on the ARToolKitNFT controller.
   Check that the jsartoolkit-nft build embedded in the new bundle still has them (grep `/tmp/check.js`).
   If an upgrade renamed them, update step 3e.
4. **At runtime:** export an NFT project from the editor and open it on a device.
   - Tracking should start normally, with no `NFT tracking worker error:` in the console.
   - In the exported `config-*.json`, set `"camera": { "near": 5, "far": 1 }` and reload.
     The console should show `NFT tracking worker error: camera.far must be greater than camera.near.`
     This confirms that the settings reach the worker and that error reporting works. Restore the values afterwards.
5. Bring `NFTWorker.js` and `Worker.js` in line with the new upstream sources too, so the reference copies stay accurate.
