# About The Augmented Reality Editor Application


The **Augmented Reality Editor (AREditor)** is a browser-based GUI for creating hosted Augmented Reality Web Apps that can be run on any web-enabled device with a camera (phones, tablets, laptops, etc).

The AREditor combines the [Three.js Editor](https://threejs.org/editor/) with the Augmented Reality capabilities of [AR.js](https://ar-js-org.github.io/AR.js-Docs/) and Natural Feature Tracking technologies to provide a complete way to create, previewing, and exporting AR experiences directly from the browser.

Users can:

- Import GLTF/GLB 3D models
- Generate marker-based or Natural Feature Tracking (NFT) AR experiences from images
- Adjust and transform objects, lighting, materials, and rendering settings before publishing
- Supports animated models
- Export production-ready AR websites as ZIP files
- Exported projects are ready to deploy as free GitHub Pages or to any static web host

The editor supports both traditional marker tracking and image-based Natural Feature Tracking images, allowing users to create AR experiences ranging from educational visualizations and interactive exhibits to marketing demos and experimental XR applications.

---

# Features

- **Dual AR Tracking Modes supported**
  - Marker-based AR tracking
  - Natural Feature Tracking (NFT) from custom images

- **Real-Time 3D Editing**
  - Scale, rotation, lighting, shadows, and material editing
  - Live viewport preview

- **3D Model Support**
  - Import GLTF/GLB models
  - Built-in primitive geometry library

- **Animation Support**
  - Play and preview embedded model animations

- **Professional Rendering Options**
  - Tone mapping
  - Shadow mapping
  - Antialiasing
  - Exposure controls

- **One-Click Publishing**
  - Export complete AR web applications as ZIP archives

- **Free Deployment Ready**
  - Compatible with GitHub Pages, Netlify, Vercel, and other static hosting platforms

---

# Quick Start

## 1. Create a Default AR Template

```text
File > New Default Template
```

## 2. Import Your 3D Model

```text
File > Import
```

Import a `.gltf` or `.glb` model into the scene editor.

## 3. Generate Your Tracking Marker

Choose one of the following tracking workflows:

```text
Marker Generator
```

Traditional marker tracking for printed AR markers.

OR

```text
NFT Marker Generator
```

For Image-based Natural Feature Tracking (NFT) using custom images instead of classic-style markers.

## 4. Configure Lighting and Rendering

```text
Project Settings > Configure shadows, tone mapping, and renderer options
```

Adjust lighting, shadows, antialiasing, tone mapping, exposure, and renderer settings to improve the final AR presentation.

```text
Add > DirectionalLight (or other lighting as needed)
```

```text
Lighting Preview allows you to view the lights in an AR App or an AR NFT App environment
```

## 5. Publish Your AR Web Application

Choose one of the following export options:


Exports a traditional marker-based AR web application:

```text
File > Publish AR Marker App
```

Or Export an image-based Natural Feature Tracking AR web application.

```text
File > Publish AR NFT App
```


The exported ZIP file contains a complete AR website ready for deployment on GitHub Pages, Netlify, Vercel, or any static web host.

You can use the NFT Marker Generator or Marker Generator tabs to create your own markers before exporting your App.

---

# Technology Stack

- [Three.js](https://threejs.org/) — JavaScript 3D graphics library built on WebGL
- [AR.js](https://ar-js-org.github.io/AR.js-Docs/) — Browser-based Augmented Reality framework
- [JSArtoolkit5](https://github.com/artoolkitx/jsartoolkit5) — JavaScript/WebAssembly ARToolkit implementation used for marker tracking
- [ARnft](https://github.com/webarkit/ARnft) — Natural Feature Tracking (NFT) library for image-based AR experiences
- [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) — Browser graphics API for hardware-accelerated 3D rendering
- [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) — Core scripting language used throughout the editor and exported applications

---

# Use Cases

AREditor can be used for:

- Education and classroom visualization
- Product demonstrations
- Museum and exhibit experiences
- Interactive marketing campaigns
- AR storytelling and games
- 3D art and design showcases
- Research and experimentation in WebXR workflows

---

# Technical Capabilities

## 3D Scene Authoring

- Built-in primitive geometry library
- GLTF/GLB import support
- Material editing and shader support
- Advanced geometry manipulation tools

## Rendering Features

- WebGL antialiasing
- Multiple shadow mapping techniques
- Tone mapping options
- Exposure controls
- Real-time lighting adjustments

## AR Features

- Marker-based AR tracking
- Natural feature image tracking
- Built-in marker generation
- AR preview workflows
- Export-ready AR websites


## Export Support

- AR Marker App export
- AR NFT App export
- GLTF/GLB export
- ZIP packaging for deployment
- Static hosting compatibility

---

# Credits

This project builds upon:

- [Three.js Editor](https://threejs.org/editor/)
- [AR.js](https://ar-js-org.github.io/AR.js-Docs/)
- [ARnft](https://github.com/webarkit/ARnft)
