const QR_CODE_CONFIG_KEY_PREFIX = 'project/arQRCodeApp/';

const QR_CODE_RENDER_SETTING_GROUPS = [
	{
		title: 'Tracking',
		description: 'Controls how often the camera searches for the QR code and how long your artwork holds its last position when detection briefly drops.',
		open: true,
		settings: [
			{
				path: [ 'tracking', 'qrSizeMillis' ],
				label: 'QR Size',
				type: 'number',
				defaultValue: 1000,
				min: 1,
				max: 100000,
				step: 10,
				precision: 0,
				info: 'Physical QR size hint passed to POSIT. This affects the translation and depth scale of the tracked pose.'
			},
			{
				path: [ 'tracking', 'qrLostGraceMs' ],
				label: 'Lost Grace (ms)',
				type: 'number',
				defaultValue: 200,
				min: 0,
				max: 60000,
				step: 10,
				precision: 0,
				info: 'Time the overlay remains visible after the QR code disappears from view.'
			},
			{
				path: [ 'tracking', 'scanIntervalMs' ],
				label: 'Scan Interval (ms)',
				type: 'number',
				defaultValue: 0,
				min: 0,
				max: 10000,
				step: 1,
				precision: 0,
				info: 'Minimum delay between QR decode attempts. Zero attempts a decode every frame.'
			},
			{
				path: [ 'tracking', 'poseUpdateIntervalMs' ],
				label: 'Pose Interval (ms)',
				type: 'number',
				defaultValue: 0,
				min: 0,
				max: 10000,
				step: 1,
				precision: 0,
				info: 'Minimum delay between visible pose updates. Zero applies every decoded frame.'
			},
			{
				path: [ 'tracking', 'detectionConfidenceHoldMs' ],
				label: 'Detection Hold (ms)',
				type: 'number',
				defaultValue: 300,
				min: 0,
				max: 60000,
				step: 10,
				precision: 0,
				info: 'Time the last good pose is retained across missed decode frames before the overlay is hidden.'
			},
			{
				path: [ 'tracking', 'maxCameraSize' ],
				label: 'Max Camera Size',
				type: 'number',
				defaultValue: 960,
				min: 64,
				max: 8192,
				step: 1,
				precision: 0,
				info: 'Maximum camera dimension used for QR decoding. Lower values can improve performance at the cost of detail.'
			}
		]
	},
	{
		title: 'Camera',
		description: 'Shapes the virtual lens and visible depth range used to frame your 3D artwork in the published AR view.',
		settings: [
			{
				path: [ 'render', 'camera', 'fov' ],
				label: 'Field of View',
				type: 'number',
				defaultValue: 75,
				min: 1,
				max: 179,
				step: 1,
				precision: 0,
				info: 'Perspective camera field of view in degrees. Higher values show a wider view.'
			},
			{
				path: [ 'render', 'camera', 'near' ],
				label: 'Near Plane',
				type: 'number',
				defaultValue: 1,
				min: 0.001,
				max: 100000,
				step: 0.1,
				precision: 3,
				info: 'Closest distance rendered by the perspective camera. Objects nearer than this are clipped.'
			},
			{
				path: [ 'render', 'camera', 'far' ],
				label: 'Far Plane',
				type: 'number',
				defaultValue: 10000,
				min: 0.01,
				max: 10000000,
				step: 10,
				precision: 2,
				info: 'Farthest distance rendered by the perspective camera. Objects beyond this are clipped.'
			},
			{
				path: [ 'render', 'camera', 'z' ],
				label: 'Camera Z',
				type: 'number',
				defaultValue: 1000,
				step: 10,
				precision: 2,
				info: 'Initial camera position on the Z axis before tracked pose updates are applied.'
			}
		]
	},
	{
		title: 'Model',
		description: 'Controls how your exported artwork is interpreted, sized, oriented, and anchored to the QR code surface.',
		settings: [
			{
				path: [ 'render', 'model', 'jsonMode' ],
				label: 'JSON Mode',
				type: 'select',
				defaultValue: 'auto',
				options: { auto: 'Auto', object: 'Object', legacy: 'Legacy' },
				info: 'Loader mode for JSON models. Auto detects editor/app JSON versus the legacy JSON format.'
			},
			{
				path: [ 'render', 'model', 'modelUnitScale' ],
				label: 'Model Unit Scale',
				type: 'number',
				defaultValue: 1000,
				min: 0.0001,
				max: 1000000,
				step: 0.1,
				precision: 4,
				info: 'Conversion between authored model units and one QR-code width. Change this only when the model uses a different unit scale.'
			},
			{
				path: [ 'render', 'model', 'scale' ],
				label: 'Model Scale',
				type: 'number',
				defaultValue: 1,
				min: 0.0001,
				max: 1000000,
				step: 0.1,
				precision: 4,
				info: 'Additional scale multiplier applied to the model after its unit conversion.'
			},
			{
				path: [ 'render', 'model', 'placement', 'mode' ],
				label: 'Placement Mode',
				type: 'select',
				defaultValue: 'bbox',
				options: { bbox: 'Bounds', origin: 'Origin', originXY_bboxZ: 'Origin XY' },
				info: 'Controls whether placement uses model bounds, preserves the artist origin, or preserves only the X/Y origin.'
			},
			{
				path: [ 'render', 'model', 'placement', 'bboxZFace' ],
				label: 'Bounding Box Z Face',
				type: 'select',
				defaultValue: 'max',
				options: { max: 'Max', min: 'Min' },
				info: 'Chooses which Z face of the model bounds touches the QR marker plane in bounding-box placement modes.'
			},
			{
				path: [ 'render', 'model', 'positionOffset', 'x' ],
				label: 'Position X',
				type: 'number',
				defaultValue: 0,
				step: 1,
				precision: 3,
				info: 'Additional X position offset applied on top of the tracked QR pose.'
			},
			{
				path: [ 'render', 'model', 'positionOffset', 'y' ],
				label: 'Position Y',
				type: 'number',
				defaultValue: 0,
				step: 1,
				precision: 3,
				info: 'Additional Y position offset applied on top of the tracked QR pose.'
			},
			{
				path: [ 'render', 'model', 'positionOffset', 'z' ],
				label: 'Position Z',
				type: 'number',
				defaultValue: 0,
				step: 1,
				precision: 3,
				info: 'Additional Z position offset applied on top of the tracked QR pose.'
			},
			{
				path: [ 'render', 'model', 'rotationOffset', 'x' ],
				label: 'Rotation X',
				type: 'number',
				defaultValue: 0,
				step: 0.01,
				precision: 5,
				info: 'Additional X-axis rotation in radians. For example, -1.5708 is approximately -90 degrees.'
			},
			{
				path: [ 'render', 'model', 'rotationOffset', 'y' ],
				label: 'Rotation Y',
				type: 'number',
				defaultValue: 0,
				step: 0.01,
				precision: 5,
				info: 'Additional Y-axis rotation in radians applied on top of the tracked pose.'
			},
			{
				path: [ 'render', 'model', 'rotationOffset', 'z' ],
				label: 'Rotation Z',
				type: 'number',
				defaultValue: 0,
				step: 0.01,
				precision: 5,
				info: 'Additional Z-axis rotation in radians applied on top of the tracked pose.'
			}
		]
	},
	{
		title: 'Visibility and Scale',
		description: 'Controls how the artwork appears and disappears, and how smoothly its displayed size responds to tracking changes.',
		settings: [
			{
				path: [ 'render', 'model', 'fadeEnabled' ],
				label: 'Fade Enabled',
				type: 'boolean',
				defaultValue: false,
				info: 'Master switch for gradual visibility fading. When disabled, the model shows and hides immediately.'
			},
			{
				path: [ 'render', 'model', 'fadeDelayMs' ],
				label: 'Fade Delay (ms)',
				type: 'number',
				defaultValue: 700,
				min: 0,
				max: 60000,
				step: 10,
				precision: 0,
				info: 'Delay after the last good detection before fade-out begins.'
			},
			{
				path: [ 'render', 'model', 'fadeDurationMs' ],
				label: 'Fade Duration (ms)',
				type: 'number',
				defaultValue: 450,
				min: 0,
				max: 60000,
				step: 10,
				precision: 0,
				info: 'Time required for fade-out to complete after it starts.'
			},
			{
				path: [ 'render', 'model', 'visibilityLerp', 'enabled' ],
				label: 'Visibility Lerp',
				type: 'boolean',
				defaultValue: true,
				info: 'Interpolates model visibility instead of changing it instantly when fading is active.'
			},
			{
				path: [ 'render', 'model', 'visibilityLerp', 'factor' ],
				label: 'Visibility Factor',
				type: 'number',
				defaultValue: 0.08,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Visibility interpolation amount per update. Lower values fade more slowly; 1 applies immediately.'
			},
			{
				path: [ 'render', 'model', 'scaleSmoothing', 'enabled' ],
				label: 'Scale Smoothing',
				type: 'boolean',
				defaultValue: false,
				info: 'Smooths the final rendered scale after all scale multipliers have been combined.'
			},
			{
				path: [ 'render', 'model', 'scaleSmoothing', 'factor' ],
				label: 'Scale Smooth Factor',
				type: 'number',
				defaultValue: 0.2,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Scale interpolation amount per update. Lower values are steadier; 1 applies scale changes immediately.'
			}
		]
	},
	{
		title: 'Material and Cube',
		description: 'Sets the fallback material appearance and the dimensions of the placeholder cube used when the runtime needs them.',
		settings: [
			{
				path: [ 'render', 'model', 'material', 'color' ],
				label: 'Material Color',
				type: 'color',
				defaultValue: 13421772,
				info: 'Base color applied to model meshes when the runtime material fallback is used.'
			},
			{
				path: [ 'render', 'model', 'material', 'specular' ],
				label: 'Specular Color',
				type: 'color',
				defaultValue: 2236962,
				info: 'Color of specular highlights on the runtime fallback material.'
			},
			{
				path: [ 'render', 'model', 'material', 'shininess' ],
				label: 'Shininess',
				type: 'number',
				defaultValue: 30,
				min: 0,
				max: 1000,
				step: 1,
				precision: 1,
				info: 'Specular intensity of the fallback material. Higher values create tighter highlights.'
			},
			{
				path: [ 'render', 'model', 'material', 'debugWireframe' ],
				label: 'Debug Wireframe',
				type: 'boolean',
				defaultValue: false,
				info: 'Draws model meshes as wireframes for visibility and geometry debugging.'
			},
			{
				path: [ 'render', 'cube', 'width' ],
				label: 'Cube Width',
				type: 'number',
				defaultValue: 400,
				min: 0,
				step: 1,
				precision: 2,
				info: 'Width of the fallback cube in scene units.'
			},
			{
				path: [ 'render', 'cube', 'height' ],
				label: 'Cube Height',
				type: 'number',
				defaultValue: 400,
				min: 0,
				step: 1,
				precision: 2,
				info: 'Height of the fallback cube in scene units.'
			},
			{
				path: [ 'render', 'cube', 'depth' ],
				label: 'Cube Depth',
				type: 'number',
				defaultValue: 400,
				min: 0,
				step: 1,
				precision: 2,
				info: 'Depth of the fallback cube in scene units.'
			}
		]
	},
	{
		title: 'Lighting and Text',
		description: 'Adjusts the default light for your artwork and the optional 3D label that can display the detected QR code data.',
		settings: [
			{
				path: [ 'render', 'light', 'x' ],
				label: 'Light X',
				type: 'number',
				defaultValue: -20,
				step: 1,
				precision: 2,
				info: 'X position of the default point light.'
			},
			{
				path: [ 'render', 'light', 'y' ],
				label: 'Light Y',
				type: 'number',
				defaultValue: 200,
				step: 1,
				precision: 2,
				info: 'Y position of the default point light.'
			},
			{
				path: [ 'render', 'light', 'z' ],
				label: 'Light Z',
				type: 'number',
				defaultValue: 1000,
				step: 1,
				precision: 2,
				info: 'Z position of the default point light.'
			},
			{
				path: [ 'render', 'light', 'intensity' ],
				label: 'Light Intensity',
				type: 'number',
				defaultValue: 1,
				min: 0,
				max: 100,
				step: 0.1,
				precision: 3,
				info: 'Intensity of the default point light used when model files do not provide lights.'
			},
			{
				path: [ 'render', 'text', 'enabled' ],
				label: 'QR Text Enabled',
				type: 'boolean',
				defaultValue: false,
				info: 'Displays the decoded QR data as a 3D text label above the tracked model.'
			},
			{
				path: [ 'render', 'text', 'yOffset' ],
				label: 'Text Y Offset',
				type: 'number',
				defaultValue: -400,
				step: 1,
				precision: 2,
				info: 'Vertical offset of the QR text label relative to the tracked object.'
			},
			{
				path: [ 'render', 'text', 'zOffset' ],
				label: 'Text Z Offset',
				type: 'number',
				defaultValue: 50,
				step: 1,
				precision: 2,
				info: 'Depth offset of the QR text label relative to the tracked object.'
			}
		]
	},
	{
		title: 'Pose',
		description: 'Tunes how camera tracking becomes the artwork\'s position and rotation, including sensitivity, depth response, and jitter limits.',
		settings: [
			{
				path: [ 'pose', 'translationScaleX' ],
				label: 'Translation Scale X',
				type: 'number',
				defaultValue: 2,
				min: 0.001,
				max: 10000,
				step: 0.1,
				precision: 4,
				info: 'Divisor for X translation. Lower values make horizontal motion more sensitive.'
			},
			{
				path: [ 'pose', 'translationScaleY' ],
				label: 'Translation Scale Y',
				type: 'number',
				defaultValue: 2,
				min: 0.001,
				max: 10000,
				step: 0.1,
				precision: 4,
				info: 'Divisor for Y translation. Lower values make vertical motion more sensitive.'
			},
			{
				path: [ 'pose', 'zReference' ],
				label: 'Z Reference',
				type: 'number',
				defaultValue: 4500,
				step: 10,
				precision: 2,
				info: 'Reference depth used to remap POSIT depth into scene Z coordinates.'
			},
			{
				path: [ 'pose', 'zScale' ],
				label: 'Z Scale',
				type: 'number',
				defaultValue: 7,
				min: 0.001,
				max: 10000,
				step: 0.1,
				precision: 4,
				info: 'Divisor for depth conversion. Higher values reduce visible Z movement.'
			},
			{
				path: [ 'pose', 'farDepthCompensation' ],
				label: 'Far Depth Comp.',
				type: 'number',
				defaultValue: 0,
				step: 0.01,
				precision: 4,
				info: 'Legacy depth compensation. Leave at zero when size-based scaling is enabled.'
			},
			{
				path: [ 'pose', 'translationDeadzone' ],
				label: 'Translation Deadzone',
				type: 'number',
				defaultValue: 0,
				min: 0,
				step: 0.01,
				precision: 4,
				info: 'Ignores per-update X, Y, and Z translation changes smaller than this amount.'
			},
			{
				path: [ 'pose', 'maxPositionStep' ],
				label: 'Max Position Step',
				type: 'number',
				defaultValue: 0,
				min: 0,
				step: 0.1,
				precision: 4,
				info: 'Largest allowed translation jump per update. Zero disables position clamping.'
			},
			{
				path: [ 'pose', 'maxRotationStep' ],
				label: 'Max Rotation Step',
				type: 'number',
				defaultValue: 0,
				min: 0,
				step: 0.01,
				precision: 5,
				info: 'Largest allowed rotation jump in radians per update. Zero disables rotation clamping.'
			},
			{
				path: [ 'pose', 'rotationPrecision' ],
				label: 'Rotation Precision',
				type: 'number',
				defaultValue: 100,
				min: 1,
				max: 100000,
				step: 1,
				precision: 0,
				info: 'Rotation rounding factor. A value of 100 rounds rotations to two decimal places.'
			},
			{
				path: [ 'pose', 'rotationDeadzone' ],
				label: 'Rotation Deadzone',
				type: 'number',
				defaultValue: 0.3,
				min: 0,
				step: 0.01,
				precision: 4,
				info: 'Ignores rotation values below this threshold to reduce visible jitter.'
			}
		]
	},
	{
		title: 'Size-Based Scaling',
		description: 'Controls whether the artwork changes size as the QR code appears larger or smaller in the camera, and limits that change.',
		settings: [
			{
				path: [ 'pose', 'sizeBasedScaling', 'enabled' ],
				label: 'Enabled',
				type: 'boolean',
				defaultValue: true,
				info: 'Scales the model from the measured QR edge size in each tracked frame.'
			},
			{
				path: [ 'pose', 'sizeBasedScaling', 'referenceEdgePx' ],
				label: 'Reference Edge (px)',
				type: 'number',
				defaultValue: 0,
				min: 0,
				step: 1,
				precision: 2,
				info: 'Reference QR edge size in pixels. Zero calibrates automatically from the first tracked frame.'
			},
			{
				path: [ 'pose', 'sizeBasedScaling', 'smoothingFactor' ],
				label: 'Smoothing Factor',
				type: 'number',
				defaultValue: 0.25,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Blend amount for dynamic scale updates. Lower values are steadier; higher values respond faster.'
			},
			{
				path: [ 'pose', 'sizeBasedScaling', 'minMultiplier' ],
				label: 'Minimum Multiplier',
				type: 'number',
				defaultValue: 0.25,
				min: 0,
				step: 0.01,
				precision: 4,
				info: 'Lower clamp for the dynamic scale multiplier.'
			},
			{
				path: [ 'pose', 'sizeBasedScaling', 'maxMultiplier' ],
				label: 'Maximum Multiplier',
				type: 'number',
				defaultValue: 2,
				min: 0,
				step: 0.01,
				precision: 4,
				info: 'Upper clamp for the dynamic scale multiplier.'
			}
		]
	},
	{
		title: 'Pose Smoothing',
		description: 'Balances stability and responsiveness for movement and rotation, either overall or separately on each axis.',
		settings: [
			{
				path: [ 'pose', 'smoothing', 'enabled' ],
				label: 'Position Smoothing',
				type: 'boolean',
				defaultValue: true,
				info: 'Enables interpolation smoothing for tracked position and rotation.'
			},
			{
				path: [ 'pose', 'smoothing', 'factor' ],
				label: 'Position Factor',
				type: 'number',
				defaultValue: 0.25,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Shared smoothing blend per frame. Lower values are smoother but introduce more lag.'
			},
			{
				path: [ 'pose', 'axisSmoothing', 'enabled' ],
				label: 'Per-Axis Position',
				type: 'boolean',
				defaultValue: false,
				info: 'Uses separate X, Y, and Z position smoothing factors instead of the shared factor.'
			},
			{
				path: [ 'pose', 'axisSmoothing', 'xFactor' ],
				label: 'Position X Factor',
				type: 'number',
				defaultValue: 0.15,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'X-axis position smoothing amount when per-axis position smoothing is enabled.'
			},
			{
				path: [ 'pose', 'axisSmoothing', 'yFactor' ],
				label: 'Position Y Factor',
				type: 'number',
				defaultValue: 0.15,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Y-axis position smoothing amount when per-axis position smoothing is enabled.'
			},
			{
				path: [ 'pose', 'axisSmoothing', 'zFactor' ],
				label: 'Position Z Factor',
				type: 'number',
				defaultValue: 0.1,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Z-axis position smoothing amount when per-axis position smoothing is enabled.'
			},
			{
				path: [ 'pose', 'rotationSmoothing', 'enabled' ],
				label: 'Rotation Smoothing',
				type: 'boolean',
				defaultValue: true,
				info: 'Enables separate rotation smoothing so spin can be calmer than translation.'
			},
			{
				path: [ 'pose', 'rotationSmoothing', 'factor' ],
				label: 'Rotation Factor',
				type: 'number',
				defaultValue: 0.1,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Rotation smoothing blend per frame. Lower values produce calmer but slower rotation.'
			},
			{
				path: [ 'pose', 'rotationAxisSmoothing', 'enabled' ],
				label: 'Per-Axis Rotation',
				type: 'boolean',
				defaultValue: false,
				info: 'Uses separate X, Y, and Z rotation smoothing factors.'
			},
			{
				path: [ 'pose', 'rotationAxisSmoothing', 'xFactor' ],
				label: 'Rotation X Factor',
				type: 'number',
				defaultValue: 0.04,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'X-axis rotation smoothing amount when per-axis rotation smoothing is enabled.'
			},
			{
				path: [ 'pose', 'rotationAxisSmoothing', 'yFactor' ],
				label: 'Rotation Y Factor',
				type: 'number',
				defaultValue: 0.04,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Y-axis rotation smoothing amount when per-axis rotation smoothing is enabled.'
			},
			{
				path: [ 'pose', 'rotationAxisSmoothing', 'zFactor' ],
				label: 'Rotation Z Factor',
				type: 'number',
				defaultValue: 0.03,
				min: 0,
				max: 1,
				step: 0.01,
				precision: 3,
				info: 'Z-axis rotation smoothing amount when per-axis rotation smoothing is enabled.'
			}
		]
	},
	{
		title: 'Performance Fallback',
		description: 'Defines a lighter camera and detection mode that can activate on slower devices to keep the AR experience responsive.',
		settings: [
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'enabled' ],
				label: 'Enabled',
				type: 'boolean',
				defaultValue: true,
				info: 'Automatically lowers camera and detection settings when frame rate remains below the threshold.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'minFps' ],
				label: 'Minimum FPS',
				type: 'number',
				defaultValue: 20,
				min: 1,
				max: 240,
				step: 1,
				precision: 0,
				info: 'Frame-rate threshold below which the performance fallback may activate.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'lowFpsDurationMs' ],
				label: 'Low FPS Time (ms)',
				type: 'number',
				defaultValue: 3000,
				min: 0,
				max: 60000,
				step: 100,
				precision: 0,
				info: 'Time the measured frame rate must remain low before fallback settings are applied.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'sourceWidth' ],
				label: 'Source Width',
				type: 'number',
				defaultValue: 960,
				min: 1,
				max: 8192,
				step: 1,
				precision: 0,
				info: 'Camera capture width used after the performance fallback activates.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'sourceHeight' ],
				label: 'Source Height',
				type: 'number',
				defaultValue: 540,
				min: 1,
				max: 8192,
				step: 1,
				precision: 0,
				info: 'Camera capture height used after the performance fallback activates.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'displayWidth' ],
				label: 'Display Width',
				type: 'number',
				defaultValue: 960,
				min: 1,
				max: 8192,
				step: 1,
				precision: 0,
				info: 'Target ARToolkit display width used after the performance fallback activates.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'displayHeight' ],
				label: 'Display Height',
				type: 'number',
				defaultValue: 540,
				min: 1,
				max: 8192,
				step: 1,
				precision: 0,
				info: 'Target ARToolkit display height used after the performance fallback activates.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'canvasWidth' ],
				label: 'Canvas Width',
				type: 'number',
				defaultValue: 960,
				min: 1,
				max: 8192,
				step: 1,
				precision: 0,
				info: 'ARToolkit processing-canvas width used after the performance fallback activates.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'canvasHeight' ],
				label: 'Canvas Height',
				type: 'number',
				defaultValue: 540,
				min: 1,
				max: 8192,
				step: 1,
				precision: 0,
				info: 'ARToolkit processing-canvas height used after the performance fallback activates.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'maxDetectionRate' ],
				label: 'Max Detection Rate',
				type: 'number',
				defaultValue: 30,
				min: 1,
				max: 240,
				step: 1,
				precision: 0,
				info: 'Maximum QR detection attempts per second after fallback activates.'
			},
			{
				path: [ 'arjs', 'qrPoseBridge', 'performanceFallback', 'qrMaxCameraSize' ],
				label: 'QR Max Camera Size',
				type: 'number',
				defaultValue: 960,
				min: 64,
				max: 8192,
				step: 1,
				precision: 0,
				info: 'Maximum QR decode dimension used after fallback downscaling.'
			}
		]
	}
];

function getQRCodeSettingConfigKey( setting ) {

	return QR_CODE_CONFIG_KEY_PREFIX + setting.path.join( '/' );

}

function getQRCodeRenderSettingValue( config, setting ) {

	const configuredValue = config.getKey( getQRCodeSettingConfigKey( setting ) );

	if ( setting.type === 'boolean' ) {

		return typeof configuredValue === 'boolean' ? configuredValue : setting.defaultValue;

	}

	if ( setting.type === 'select' ) {

		return typeof configuredValue === 'string' && configuredValue in setting.options
			? configuredValue
			: setting.defaultValue;

	}

	const number = Number( configuredValue );
	return Number.isFinite( number ) ? number : setting.defaultValue;

}

function getQRCodeRenderSettingValues( config ) {

	return QR_CODE_RENDER_SETTING_GROUPS.flatMap( ( group ) => group.settings.map( ( setting ) => ( {
		path: setting.path,
		value: getQRCodeRenderSettingValue( config, setting )
	} ) ) );

}

function stripJSONComments( content ) {

	let result = '';
	let inString = false;
	let escaped = false;

	for ( let index = 0; index < content.length; index ++ ) {

		const character = content[ index ];
		const nextCharacter = content[ index + 1 ];

		if ( inString ) {

			result += character;

			if ( escaped ) escaped = false;
			else if ( character === '\\' ) escaped = true;
			else if ( character === '"' ) inString = false;

			continue;

		}

		if ( character === '"' ) {

			inString = true;
			result += character;
			continue;

		}

		if ( character === '/' && nextCharacter === '/' ) {

			while ( index < content.length && content[ index ] !== '\n' ) index ++;
			result += '\n';
			continue;

		}

		if ( character === '/' && nextCharacter === '*' ) {

			index += 2;

			while ( index < content.length && !( content[ index ] === '*' && content[ index + 1 ] === '/' ) ) {

				if ( content[ index ] === '\n' ) result += '\n';
				index ++;

			}

			index ++;
			continue;

		}

		result += character;

	}

	return result;

}

function setQRCodeRenderConfigValue( renderConfig, path, value ) {

	let target = renderConfig;

	for ( let index = 0; index < path.length - 1; index ++ ) {

		const key = path[ index ];

		if ( target[ key ] === null || typeof target[ key ] !== 'object' ) {

			throw new Error( `The QR tracker setting path "${path.join( '.' )}" was not found.` );

		}

		target = target[ key ];

	}

	const settingKey = path[ path.length - 1 ];

	if ( !Object.prototype.hasOwnProperty.call( target, settingKey ) ) {

		throw new Error( `The QR tracker setting path "${path.join( '.' )}" was not found.` );

	}

	target[ settingKey ] = value;

}

function createQRCodeRenderConfig( templateContent, settingValues, generatedValues ) {

	let renderConfig;

	try {

		renderConfig = JSON.parse( stripJSONComments( templateContent ) );

	} catch ( error ) {

		throw new Error( `Unable to parse the QR tracker render config: ${error.message}` );

	}

	for ( const setting of settingValues ) {

		setQRCodeRenderConfigValue( renderConfig, setting.path, setting.value );

	}

	setQRCodeRenderConfigValue( renderConfig, [ 'render', 'model', 'path' ], generatedValues.modelPath );
	setQRCodeRenderConfigValue( renderConfig, [ 'render', 'pageTitle' ], generatedValues.pageTitle );
	setQRCodeRenderConfigValue(
		renderConfig,
		[ 'tracking', 'trackMatchingQRCodeData' ],
		generatedValues.trackMatchingQRCodeData
	);

	return JSON.stringify( renderConfig, null, '\t' ) + '\n';

}

export {
	QR_CODE_RENDER_SETTING_GROUPS,
	getQRCodeSettingConfigKey,
	getQRCodeRenderSettingValue,
	getQRCodeRenderSettingValues,
	createQRCodeRenderConfig
};