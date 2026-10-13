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
	oef: true,
	showStats: false
};

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
	oef: 'project/nftMarkerApp/tracking/oef',
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
		oef: typeof settings.oef === 'boolean' ? settings.oef : NFT_MARKER_EXPORT_DEFAULTS.oef,
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