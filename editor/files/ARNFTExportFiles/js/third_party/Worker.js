/* eslint-env worker */
// Keep the packaged inline worker in ARnft.js synchronized with this source.
/*
 *  Worker.ts
 *  ARnft
 *
 *  This file is part of ARnft - WebARKit.
 *
 *  ARnft is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Lesser General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  ARnft is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with ARnft.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  As a special exception, the copyright holders of this library give you
 *  permission to link this library with independent modules to produce an
 *  executable, regardless of the license terms of these independent modules, and to
 *  copy and distribute the resulting executable under terms of your choice,
 *  provided that you also meet, for each linked independent module, the terms and
 *  conditions of the license of that module. An independent module is a module
 *  which is neither derived from nor based on this library. If you modify this
 *  library, you may extend this exception to your version of the library, but you
 *  are not obligated to do so. If you do not wish to do so, delete this exception
 *  statement from your version.
 *
 *  Copyright 2021 WebARKit.
 *
 *  Author(s): Walter Perdan @kalwalt https://github.com/kalwalt
 *
 */
import { ARControllerNFT } from "jsartoolkitnft";
import { OneEuroFilter } from "@webarkit/oneeurofilter-ts";
const ctx = self;
ctx.onmessage = (e) => {
    const msg = e.data;
    switch (msg.type) {
        case "load": {
            load(msg).catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                console.error("Error initializing NFT worker:", error);
                ctx.postMessage({ type: "error", message });
            });
            return;
        }
        case "stop": {
            ar = null;
            break;
        }
        case "process": {
            next = msg.imagedata;
            process(next, msg.frame);
        }
    }
};
let next = null;
let lastFrame = 0;
let ar = null;
let markerResult = null;
// initialize the OneEuroFilter
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
let filter = new OneEuroFilter(filterMinCF, filterBeta);

const readNumberSetting = (value, fallback, minimum, maximum, name) => {
    if (value === undefined || value === null) {
        return fallback;
    }

    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) {
        throw new RangeError(`${name} must be a number between ${minimum} and ${maximum}.`);
    }

    return number;
};

const oefFilter = (matrixGL_RH) => {
    tickCount += 1;
    var mat;
    if (tickCount > warmUpSamples) {
        mat = filter.filter(Date.now(), matrixGL_RH);
    }
    else {
        mat = matrixGL_RH;
    }
    return mat;
};
const load = async (msg) => {
    const basePath = self.origin;
    let cameraParamUrl;
    let nftMarkerUrls = [];
    let markerLength = msg.marker.length;
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
            throw new RangeError(`Unknown NFT threshold mode: ${thresholdModeName}`);
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
    console.debug("Base path:", basePath);
    const onLoad = async (arController) => {
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
        ar.addEventListener("getNFTMarker", (ev) => {
            let mat;
            if (oef == true) {
                mat = oefFilter(ev.data.matrixGL_RH);
            }
            else {
                mat = ev.data.matrixGL_RH;
            }
            markerResult = {
                type: "found",
                matrixGL_RH: JSON.stringify(mat),
            };
        });
        // after the ARControllerNFT is set up, we load the NFT Marker
        const regexM = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#()?&//=]*)/gim;
        const reM = regexM.test(msg.marker);
        for (var i = 0; i < markerLength; i++) {
            let nftMarkerUrl;
            if (reM == true) {
                if (msg.addPath) {
                    nftMarkerUrl = basePath + "/" + msg.addPath + "/" + msg.marker[i];
                }
                else {
                    nftMarkerUrls = msg.marker[i];
                }
            }
            else if (reM == false) {
                if (msg.addPath) {
                    nftMarkerUrl = basePath + "/" + msg.addPath + "/" + msg.marker[i];
                }
                else {
                    nftMarkerUrl = basePath + "/" + msg.marker[i];
                }
            }
            nftMarkerUrls.push(nftMarkerUrl);
        }
        console.debug("Loading NFT marker at: ", nftMarkerUrls);
        await ar
            .loadNFTMarkers(nftMarkerUrls, (id) => {
            var m = 0;
            let marker = ar.getNFTData(id[m], 0);
            ctx.postMessage({ type: "markerInfos", marker: marker });
            ar.trackNFTMarkerId(id[m]);
            console.log("loadNFTMarker -> ", id[m]);
            ctx.postMessage({ type: "endLoading", end: true });
            m++;
        }, (err) => {
            console.error("Error: ", err, " loading marker in loadNFTMarkers!");
        })
            .catch((err) => {
            console.error("Error in loading marker on Worker", err);
        });
        ctx.postMessage({ type: "loaded", proj: JSON.stringify(cameraMatrix) });
    };
    const onError = (error) => {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        ctx.postMessage({ type: "error", message });
    };
    const regexC = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#()?&//=]*)/gim;
    const reC = regexC.test(msg.camera_para);
    if (reC == true) {
        if (msg.addPath) {
            cameraParamUrl = basePath + "/" + msg.addPath + "/" + msg.camera_para;
        }
        else {
            cameraParamUrl = msg.camera_para;
        }
    }
    else if (reC == false) {
        if (msg.addPath) {
            cameraParamUrl = basePath + "/" + msg.addPath + "/" + msg.camera_para;
        }
        else {
            cameraParamUrl = basePath + "/" + msg.camera_para;
        }
    }
    console.debug("Loading camera at:", cameraParamUrl);
    ARControllerNFT.initWithDimensions(msg.pw, msg.ph, cameraParamUrl).then(onLoad).catch(onError);
};
const process = (next, frame) => {
    if (frame !== lastFrame) {
        markerResult = null;
        if (ar && ar.process) {
            ar.process(next);
        }
        lastFrame = frame;
    }
    if (markerResult != null) {
        ctx.postMessage(markerResult);
    }
    else {
        ctx.postMessage({ type: "not found" });
    }
    next = null;
};
