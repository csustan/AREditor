const NFT_MARKER_EXPORT_DEFAULTS = {
	trackingWidth: 640,
	trackingHeight: 480,
	cameraWidthMin: 640,
	cameraWidthMax: 800,
	cameraHeightMin: 480,
	cameraHeightMax: 600,
	facingMode: 'environment',
	targetFrameRate: 30,
	cameraParametersUrl: 'Data/camera_para.dat',
	cameraNear: 0.1,
	cameraFar: 1000,
	thresholdMode: 'trackerDefault',
	threshold: 100,
	oef: true,
	filterMinCF: 0.0001,
	filterBeta: 0.01,
	warmUpSamples: 5,
	showStats: false
};

const NFT_MARKER_THRESHOLD_MODES = new Set( [
	'trackerDefault',
	'manual',
	'autoMedian',
	'autoOtsu',
	'autoAdaptive',
	'autoBracketing'
] );

const NFT_MARKER_EXPORT_CONFIG_KEYS = {
	trackingWidth: 'project/nftMarkerApp/tracking/width',
	trackingHeight: 'project/nftMarkerApp/tracking/height',
	cameraWidthMin: 'project/nftMarkerApp/video/widthMin',
	cameraWidthMax: 'project/nftMarkerApp/video/widthMax',
	cameraHeightMin: 'project/nftMarkerApp/video/heightMin',
	cameraHeightMax: 'project/nftMarkerApp/video/heightMax',
	facingMode: 'project/nftMarkerApp/video/facingMode',
	targetFrameRate: 'project/nftMarkerApp/video/targetFrameRate',
	cameraParametersUrl: 'project/nftMarkerApp/cameraParametersUrl',
	cameraNear: 'project/nftMarkerApp/camera/near',
	cameraFar: 'project/nftMarkerApp/camera/far',
	thresholdMode: 'project/nftMarkerApp/tracking/thresholdMode',
	threshold: 'project/nftMarkerApp/tracking/threshold',
	oef: 'project/nftMarkerApp/tracking/oef',
	filterMinCF: 'project/nftMarkerApp/tracking/filterMinCF',
	filterBeta: 'project/nftMarkerApp/tracking/filterBeta',
	warmUpSamples: 'project/nftMarkerApp/tracking/warmUpSamples',
	showStats: 'project/nftMarkerApp/stats/show'
};

function clampNumber( value, fallback, minimum, maximum ) {

	const number = Number( value );
	return Math.min( maximum, Math.max( minimum, Number.isFinite( number ) ? number : fallback ) );

}

function normalizeNFTMarkerExportSettings( settings = {} ) {

	const cameraWidthMin = clampNumber( settings.cameraWidthMin, NFT_MARKER_EXPORT_DEFAULTS.cameraWidthMin, 1, 7680 );
	const cameraHeightMin = clampNumber( settings.cameraHeightMin, NFT_MARKER_EXPORT_DEFAULTS.cameraHeightMin, 1, 4320 );
	const facingMode = settings.facingMode === 'user' ? 'user' : 'environment';
	const cameraParametersUrl = typeof settings.cameraParametersUrl === 'string' && settings.cameraParametersUrl.trim() !== ''
		? settings.cameraParametersUrl.trim()
		: NFT_MARKER_EXPORT_DEFAULTS.cameraParametersUrl;
	const cameraNear = clampNumber( settings.cameraNear, NFT_MARKER_EXPORT_DEFAULTS.cameraNear, 0.001, 1000 );
	const cameraFar = Math.max(
		cameraNear + 0.01,
		clampNumber( settings.cameraFar, NFT_MARKER_EXPORT_DEFAULTS.cameraFar, 0.01, 1000000 )
	);
	const rawThresholdMode = settings.thresholdMode === undefined || settings.thresholdMode === null
		? NFT_MARKER_EXPORT_DEFAULTS.thresholdMode
		: String( settings.thresholdMode );
	const thresholdMode = NFT_MARKER_THRESHOLD_MODES.has( rawThresholdMode )
		? rawThresholdMode
		: NFT_MARKER_EXPORT_DEFAULTS.thresholdMode;

	return {
		trackingWidth: Math.round( clampNumber( settings.trackingWidth, NFT_MARKER_EXPORT_DEFAULTS.trackingWidth, 1, 7680 ) ),
		trackingHeight: Math.round( clampNumber( settings.trackingHeight, NFT_MARKER_EXPORT_DEFAULTS.trackingHeight, 1, 4320 ) ),
		cameraWidthMin: Math.round( cameraWidthMin ),
		cameraWidthMax: Math.round( Math.max( cameraWidthMin, clampNumber( settings.cameraWidthMax, NFT_MARKER_EXPORT_DEFAULTS.cameraWidthMax, 1, 7680 ) ) ),
		cameraHeightMin: Math.round( cameraHeightMin ),
		cameraHeightMax: Math.round( Math.max( cameraHeightMin, clampNumber( settings.cameraHeightMax, NFT_MARKER_EXPORT_DEFAULTS.cameraHeightMax, 1, 4320 ) ) ),
		facingMode,
		targetFrameRate: Math.round( clampNumber( settings.targetFrameRate, NFT_MARKER_EXPORT_DEFAULTS.targetFrameRate, 1, 120 ) ),
		cameraParametersUrl,
		cameraNear,
		cameraFar,
		thresholdMode,
		threshold: Math.round( clampNumber( settings.threshold, NFT_MARKER_EXPORT_DEFAULTS.threshold, 0, 255 ) ),
		oef: typeof settings.oef === 'boolean' ? settings.oef : NFT_MARKER_EXPORT_DEFAULTS.oef,
		filterMinCF: clampNumber( settings.filterMinCF, NFT_MARKER_EXPORT_DEFAULTS.filterMinCF, 0.0001, 10 ),
		filterBeta: clampNumber( settings.filterBeta, NFT_MARKER_EXPORT_DEFAULTS.filterBeta, 0, 10 ),
		warmUpSamples: Math.round( clampNumber( settings.warmUpSamples, NFT_MARKER_EXPORT_DEFAULTS.warmUpSamples, 0, 120 ) ),
		showStats: typeof settings.showStats === 'boolean' ? settings.showStats : NFT_MARKER_EXPORT_DEFAULTS.showStats
	};

}

function getNFTMarkerExportSettings( config ) {

	const settings = {};

	for ( const [ settingName, configKey ] of Object.entries( NFT_MARKER_EXPORT_CONFIG_KEYS ) ) {

		settings[ settingName ] = config.getKey( configKey );

	}

	return normalizeNFTMarkerExportSettings( settings );

}

function setNFTMarkerExportSettings( config, settings ) {

	const normalizedSettings = normalizeNFTMarkerExportSettings( settings );
	const configArguments = [];

	for ( const [ settingName, configKey ] of Object.entries( NFT_MARKER_EXPORT_CONFIG_KEYS ) ) {

		configArguments.push( configKey, normalizedSettings[ settingName ] );

	}

	config.setKey( ...configArguments );
	return normalizedSettings;

}

function createNFTMarkerExportConfig( settings ) {

	const normalizedSettings = normalizeNFTMarkerExportSettings( settings );

	return {
		addPath: '',
		cameraPara: normalizedSettings.cameraParametersUrl,
		container: {
			create: true,
			containerName: '',
			canvasName: ''
		},
		videoSettings: {
			width: {
				min: normalizedSettings.cameraWidthMin,
				max: normalizedSettings.cameraWidthMax
			},
			height: {
				min: normalizedSettings.cameraHeightMin,
				max: normalizedSettings.cameraHeightMax
			},
			facingMode: normalizedSettings.facingMode,
			targetFrameRate: normalizedSettings.targetFrameRate
		},
		loading: {
			create: true,
			logo: {
				src: 'Data/StanState-logo.png',
				alt: 'Stan State logo'
			},
			loadingMessage: 'Loading, please wait...'
		},
		stats: {
			createHtml: normalizedSettings.showStats
		},
		camera: {
			near: normalizedSettings.cameraNear,
			far: normalizedSettings.cameraFar
		},
		tracking: {
			thresholdMode: normalizedSettings.thresholdMode,
			threshold: normalizedSettings.threshold,
			oef: normalizedSettings.oef,
			filterMinCF: normalizedSettings.filterMinCF,
			filterBeta: normalizedSettings.filterBeta,
			warmUpSamples: normalizedSettings.warmUpSamples
		},
		oef: normalizedSettings.oef
	};

}

export {
	NFT_MARKER_EXPORT_DEFAULTS,
	createNFTMarkerExportConfig,
	getNFTMarkerExportSettings,
	normalizeNFTMarkerExportSettings,
	setNFTMarkerExportSettings
};