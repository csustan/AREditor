
/*
// Ensure Emscripten resolves the .wasm from the correct folder (prevents doubled paths)
globalThis.Module = globalThis.Module || {};
globalThis.Module.locateFile = ( path, prefix ) => {
	if ( path.endsWith( '.wasm' ) ) return '/editor/js/libs/nft/' + path;
	return prefix + path;
};
*/

// start module imports: basics and the NFT marker creator ESM import

import { UISpan, UIRow, UIText, UIButton, UIInput, UISelect, UICheckbox, UINumber, UIHorizontalRule, UITabbedPanel } from './libs/ui.js';
import { getMarkerSystemState, setMarkerSystemState } from './MarkerSystemRegistry.js';
import {
	NFT_MARKER_EXPORT_DEFAULTS,
	getNFTMarkerExportSettings,
	setNFTMarkerExportSettings
} from './NFTMarkerExportSettings.js';

//import nftMarkerCreatorFactory from './libs/nft/NftMarkerCreator.min.js';


//
// Sidebar.NFTMarkerGenerator
//
// This panel lets users load an image and generate:
//   - NFT .patt
//   - NFT .iset
//   - NFT .fset
//   - PNG preview (binary)
//
// These are saved to global variables:
//   window.NFT_PatternText
//   window.NFT_Iset
//   window.NFT_Fset
//   window.NFT_Zft        // optional, only when zft checkbox is checked
//   window.NFT_ImageBlob
//
// The NFT export code in Menubar.File.js will read these.
//


// end module imports


const nftGenerationWorkerUrl = new URL( './workers/NFTMarkerGeneratorWorker.js', import.meta.url );

let nftGenerationWorker = null;
let pendingNftGeneration = null;
let nextNftGenerationRequestId = 1;

function rejectPendingNftGeneration( error ) {

	if ( pendingNftGeneration === null ) return;

	const { reject } = pendingNftGeneration;
	pendingNftGeneration = null;
	reject( error );

}

function disposeNftGenerationWorker( error ) {

	nftGenerationWorker?.terminate();
	nftGenerationWorker = null;

	if ( error !== undefined ) rejectPendingNftGeneration( error );

}

function getNftGenerationWorker() {

	if ( nftGenerationWorker !== null ) return nftGenerationWorker;

	const worker = new Worker( nftGenerationWorkerUrl );

	worker.addEventListener( 'message', ( event ) => {

		const request = pendingNftGeneration;

		if ( request === null || event.data?.requestId !== request.requestId ) return;

		pendingNftGeneration = null;

		if ( event.data.type === 'error' ) {

			const error = new Error( event.data.error?.message || 'NFT marker generation failed in the worker.' );
			if ( event.data.error?.stack ) error.stack = event.data.error.stack;
			request.reject( error );
			return;

		}

		if ( event.data.type !== 'generated' ||
			!( event.data.iset instanceof ArrayBuffer ) ||
			!( event.data.fset instanceof ArrayBuffer ) ||
			!( event.data.fset3 instanceof ArrayBuffer ) ) {

			request.reject( new Error( 'The NFT worker returned an incomplete dataset.' ) );
			return;

		}

		request.resolve( {
			iset: new Uint8Array( event.data.iset ),
			fset: new Uint8Array( event.data.fset ),
			fset3: new Uint8Array( event.data.fset3 ),
			zft: event.data.zft instanceof ArrayBuffer ? new Uint8Array( event.data.zft ) : null
		} );

	} );

	worker.addEventListener( 'error', ( event ) => {

		event.preventDefault();
		disposeNftGenerationWorker( new Error( event.message || 'The NFT generation worker stopped unexpectedly.' ) );

	} );

	worker.addEventListener( 'messageerror', () => {

		disposeNftGenerationWorker( new Error( 'The NFT generation worker returned unreadable data.' ) );

	} );

	nftGenerationWorker = worker;
	return worker;

}

function generateNftMarkerInWorker( imageData, options ) {

	if ( pendingNftGeneration !== null ) {

		return Promise.reject( new Error( 'NFT marker generation is already running.' ) );

	}

	const requestId = nextNftGenerationRequestId ++;
	const imageBuffer = imageData.data.buffer;

	return new Promise( ( resolve, reject ) => {

		pendingNftGeneration = { requestId, resolve, reject };

		try {

			getNftGenerationWorker().postMessage( {
				type: 'generate',
				requestId,
				imageBuffer,
				width: imageData.width,
				height: imageData.height,
				options
			}, [ imageBuffer ] );

		} catch ( error ) {

			disposeNftGenerationWorker( error );

		}

	} );

}

function createNftGenerationCanceledError() {

	const error = new Error( 'NFT marker generation was canceled.' );
	error.name = 'AbortError';
	return error;

}

function cancelNftMarkerGeneration() {

	if ( pendingNftGeneration === null ) return false;

	disposeNftGenerationWorker( createNftGenerationCanceledError() );
	return true;

}



function SidebarNFTMarkerGenerator(editor) {

	const config = editor.config;

	// Outer container (returned to the Sidebar system)
	const container = new UISpan();
	container.dom.style.display = 'block';
	container.dom.style.width = '100%';
	container.dom.style.boxSizing = 'border-box';

	// Inner padded content wrapper (all UI should be added to this)
	const content = new UISpan();
	content.dom.style.display = 'block';
	content.dom.style.width = '100%';
	content.dom.style.boxSizing = 'border-box';
	content.dom.style.paddingLeft = '14px';
	content.dom.style.paddingRight = '10px';

	container.add( content );

	function makeInfoButton( infoText ) {

		const wrapper = document.createElement( 'span' );
		wrapper.style.position = 'relative';
		wrapper.style.display = 'inline-flex';
		wrapper.style.alignItems = 'center';

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.textContent = 'i';
		button.setAttribute( 'aria-label', `Information: ${infoText}` );
		button.style.width = '16px';
		button.style.height = '16px';
		button.style.padding = '0';
		button.style.border = '1px solid currentColor';
		button.style.borderRadius = '50%';
		button.style.background = 'transparent';
		button.style.color = 'inherit';
		button.style.font = 'bold 12px/14px sans-serif';
		button.style.cursor = 'help';
		button.setAttribute( 'aria-pressed', 'false' );

		const tooltip = document.createElement( 'span' );
		tooltip.textContent = infoText;
		tooltip.style.display = 'none';
		tooltip.style.position = 'fixed';
		tooltip.style.width = '220px';
		tooltip.style.maxWidth = 'calc(100vw - 16px)';
		tooltip.style.boxSizing = 'border-box';
		tooltip.style.padding = '7px 9px';
		tooltip.style.background = '#fff';
		tooltip.style.color = '#444';
		tooltip.style.border = '1px solid #aaa';
		tooltip.style.borderRadius = '3px';
		tooltip.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
		tooltip.style.font = '12px/1.35 sans-serif';
		tooltip.style.whiteSpace = 'normal';
		tooltip.style.textAlign = 'left';
		tooltip.style.zIndex = '2147483647';
		tooltip.style.pointerEvents = 'none';

		let pinned = false;
		const positionTooltip = () => {

			const buttonRect = button.getBoundingClientRect();
			const tooltipRect = tooltip.getBoundingClientRect();
			const viewportPadding = 8;
			const gap = 5;
			const maxLeft = Math.max( viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding );
			const left = Math.min( maxLeft, Math.max( viewportPadding, buttonRect.right - tooltipRect.width ) );
			let top = buttonRect.bottom + gap;

			if ( top + tooltipRect.height > window.innerHeight - viewportPadding ) {

				top = buttonRect.top - tooltipRect.height - gap;

			}

			tooltip.style.left = `${left}px`;
			tooltip.style.top = `${Math.max( viewportPadding, top )}px`;

		};
		const showTooltip = () => {

			if ( !tooltip.isConnected ) document.body.appendChild( tooltip );
			tooltip.style.display = 'block';
			positionTooltip();
			window.addEventListener( 'resize', positionTooltip );
			window.addEventListener( 'scroll', positionTooltip, true );

		};
		const removeTooltip = () => {

			tooltip.remove();
			window.removeEventListener( 'resize', positionTooltip );
			window.removeEventListener( 'scroll', positionTooltip, true );

		};
		const hideTooltip = () => {

			if ( !pinned ) removeTooltip();

		};

		button.addEventListener( 'mouseenter', showTooltip );
		button.addEventListener( 'mouseleave', hideTooltip );
		button.addEventListener( 'focus', showTooltip );
		button.addEventListener( 'blur', hideTooltip );
		button.addEventListener( 'click', ( event ) => {

			event.stopPropagation();
			pinned = !pinned;
			button.setAttribute( 'aria-pressed', String( pinned ) );
			button.style.filter = pinned ? 'invert(1)' : 'none';
			if ( pinned ) showTooltip();
			else removeTooltip();

		} );

		wrapper.appendChild( button );
		return wrapper;

	}

	function createDisclosureSection( label ) {

		const details = document.createElement( 'details' );
		details.style.marginBottom = '8px';

		const summary = document.createElement( 'summary' );
		summary.textContent = label;
		summary.style.cursor = 'pointer';
		summary.style.fontSize = '12px';
		summary.style.fontWeight = 'bold';
		details.appendChild( summary );

		const body = document.createElement( 'div' );
		body.style.paddingTop = '8px';
		details.appendChild( body );

		return { details, body };

	}

	// Title -----------------------------------------------------

	const header = new UIText( 'NFT Marker Generator' );
	header.setFontSize( '14px' );
	header.setMarginBottom( '8px' );
	header.dom.style.display = 'block'; // ensures the next text does not sit on the same line
	content.add( header );

	const publishButton = new UIButton( 'Publish App with Active NFT' );
	publishButton.setWidth( '100%' );
	publishButton.setMarginBottom( '4px' );
	publishButton.onClick( () => editor.signals.publishARNFTApp.dispatch() );
	content.add( publishButton );

	const publishTargetText = new UIText( 'Will publish: Default Pineball' );
	publishTargetText.setColor( '#888' );
	publishTargetText.setMarginBottom( '12px' );
	publishTargetText.dom.style.display = 'block';
	publishTargetText.dom.style.overflowWrap = 'anywhere';
	publishTargetText.dom.id = 'nft-publish-target';
	publishButton.dom.setAttribute( 'aria-describedby', publishTargetText.dom.id );
	content.add( publishTargetText );


	// File input -----------------------------------------------------

	// Keep the packaged Pineball marker as the initial Active NFT until a custom
	// marker has completed every generation step successfully.
	const defaultNftMarkerPreviewUrl = new URL( '../files/ARNFTExportFiles/img/pinball.jpg', import.meta.url ).toString();
	const markerSettingInfo = {
		outputName: 'Base name for the generated NFT dataset files. File extensions are added automatically.',
		zft: 'Also generates the optional .zft companion file alongside the standard NFT marker dataset.',
		dpi: 'Source image resolution in dots per inch. This determines the marker\'s real-world scale during tracking.',
		level: 'Tracking-feature extraction level. Higher values select more features for ongoing marker tracking.',
		leveli: 'Initialization-feature extraction level. Higher values select more features for initially finding the marker.',
		sd_thresh: 'Minimum local image variation required for feature candidates. Higher values reject more low-detail areas.',
		max_thresh: 'Upper similarity threshold used during feature selection. Keep this value above min_thresh.',
		min_thresh: 'Lower similarity threshold used during feature selection. Keep this value below max_thresh.',
		feature_density: 'Target density of extracted feature points. Higher values retain more points and may increase generation time and dataset size.'
	};
	const defaultMarkerSettings = {
		outputName: 'generatedMarker',
		zft: false,
		dpi: 72,
		level: 2,
		leveli: 1,
		sd_thresh: 8,
		max_thresh: 0.9,
		min_thresh: 0.55,
		feature_density: 70
	};

	// Explain why choosing a new image does not immediately replace the marker used
	// by the viewport, downloads, and publishing.
	const imageTabsHeader = new UIRow();
	imageTabsHeader.dom.style.display = 'flex';
	imageTabsHeader.dom.style.alignItems = 'center';
	imageTabsHeader.dom.style.gap = '6px';
	imageTabsHeader.setMarginBottom( '6px' );
	imageTabsHeader.add( new UIText( 'NFT Images' ) );
	imageTabsHeader.dom.appendChild( makeInfoButton(
		'Active NFT is used by the viewport, downloads, and exports. Create NFT is where a new image and generation settings are selected. The new marker becomes active only after successful generation.'
	) );
	content.add( imageTabsHeader );

	const imageTabs = new UITabbedPanel();
	imageTabs.dom.style.minWidth = '0';
	imageTabs.dom.style.marginBottom = '8px';

	// Active NFT tab -------------------------------------------------
	// This image and name describe the dataset currently used outside the generator.
	const activeImagePanel = new UISpan();
	activeImagePanel.dom.style.display = 'block';
	activeImagePanel.dom.style.padding = '10px 0';

	const activeImageNameText = new UIText( 'Default Pineball' );
	activeImageNameText.setColor( '#888' );
	activeImageNameText.setMarginBottom( '8px' );
	activeImageNameText.dom.style.display = 'block';
	activeImageNameText.dom.style.overflowWrap = 'anywhere';
	activeImagePanel.add( activeImageNameText );

	const activePreviewImg = document.createElement( 'img' );
	activePreviewImg.alt = 'Active NFT marker image';
	activePreviewImg.style.display = 'block';
	activePreviewImg.style.maxWidth = '100%';
	activePreviewImg.style.maxHeight = '180px';
	activePreviewImg.style.margin = '0 auto';
	activePreviewImg.style.objectFit = 'contain';
	activeImagePanel.dom.appendChild( activePreviewImg );

	const downloadBtn = new UIButton( 'Download the NFT Files' );
	downloadBtn.setMarginTop( '10px' );
	downloadBtn.setMarginBottom( '8px' );
	activeImagePanel.add( downloadBtn );

	const downloadSourceText = new UIText( 'Download source: Default NFT files' );
	downloadSourceText.setColor( '#888' );
	downloadSourceText.setMarginBottom( '8px' );
	downloadSourceText.dom.style.display = 'block';
	activeImagePanel.add( downloadSourceText );

	const resetToDefaultNftMakerBtn = new UIButton( 'Reset to Default NFT Marker' );
	resetToDefaultNftMakerBtn.setMarginBottom( '8px' );
	activeImagePanel.add( resetToDefaultNftMakerBtn );

	const activeStatusText = new UIText( 'Using the default Pineball NFT marker.' );
	activeStatusText.setColor( '#888' );
	activeStatusText.setMarginBottom( '8px' );
	activeStatusText.dom.style.display = 'block';
	activeImagePanel.add( activeStatusText );

	activeImagePanel.add( new UIHorizontalRule() );

	const activeGenerationSettingsSection = createDisclosureSection( 'Marker Settings' );
	activeImagePanel.dom.appendChild( activeGenerationSettingsSection.details );

	function addActiveSettingRow( labelText, infoText ) {

		const row = new UIRow();
		row.setMarginBottom( '8px' );
		row.dom.style.display = 'flex';
		row.dom.style.alignItems = 'center';
		row.dom.style.gap = '6px';

		row.add( new UIText( labelText ).setWidth( '110px' ) );
		row.dom.appendChild( makeInfoButton( infoText ) );

		const valueText = new UIText( 'Not recorded' );
		valueText.setColor( '#aaa' );
		valueText.dom.style.marginLeft = 'auto';
		valueText.dom.style.overflowWrap = 'anywhere';
		valueText.dom.style.textAlign = 'right';
		row.add( valueText );
		activeGenerationSettingsSection.body.appendChild( row.dom );

		return valueText;

	}

	const activeSettingValueTexts = {
		outputName: addActiveSettingRow( 'Filename', markerSettingInfo.outputName ),
		zft: addActiveSettingRow( 'zft', markerSettingInfo.zft ),
		dpi: addActiveSettingRow( 'dpi', markerSettingInfo.dpi ),
		level: addActiveSettingRow( 'level', markerSettingInfo.level ),
		leveli: addActiveSettingRow( 'leveli', markerSettingInfo.leveli ),
		sd_thresh: addActiveSettingRow( 'sd_thresh', markerSettingInfo.sd_thresh ),
		max_thresh: addActiveSettingRow( 'max_thresh', markerSettingInfo.max_thresh ),
		min_thresh: addActiveSettingRow( 'min_thresh', markerSettingInfo.min_thresh ),
		feature_density: addActiveSettingRow( 'feature_density', markerSettingInfo.feature_density )
	};

	function updateActiveSettingValues( state ) {

		const generationSettings = state?.generationSettings || defaultMarkerSettings;
		const values = {
			outputName: state?.outputName || defaultMarkerSettings.outputName,
			zft: generationSettings.zft ? 'Enabled' : 'Disabled',
			dpi: generationSettings.dpi ?? state?.dpi,
			level: generationSettings.level,
			leveli: generationSettings.leveli,
			sd_thresh: generationSettings.sd_thresh,
			max_thresh: generationSettings.max_thresh,
			min_thresh: generationSettings.min_thresh,
			feature_density: generationSettings.feature_density
		};

		for ( const [ settingName, valueText ] of Object.entries( activeSettingValueTexts ) ) {

			const value = values[ settingName ];
			valueText.setValue( value === undefined || value === null ? 'Not recorded' : String( value ) );

		}

	}

	activeImagePanel.add( new UIHorizontalRule() );

	const exportSettingsHeader = new UIText( 'Published App Settings' );
	exportSettingsHeader.dom.style.display = 'block';
	exportSettingsHeader.setMarginBottom( '8px' );
	activeImagePanel.add( exportSettingsHeader );

	const runtimeControls = {};

	function addRuntimeSettingRow( labelText, control, infoText ) {

		const row = new UIRow();
		row.setMarginBottom( '8px' );
		row.dom.style.display = 'flex';
		row.dom.style.flexWrap = 'wrap';
		row.dom.style.alignItems = 'center';
		row.dom.style.gap = '6px';
		row.add( new UIText( labelText ).setWidth( '120px' ) );
		row.dom.appendChild( makeInfoButton( infoText ) );
		row.add( control );
		activeImagePanel.add( row );

	}

	function setRuntimeControlValues( settings ) {

		for ( const [ settingName, control ] of Object.entries( runtimeControls ) ) {

			control.setValue( settings[ settingName ] );

		}

	}

	function saveRuntimeControlValues() {

		const settings = {};

		for ( const [ settingName, control ] of Object.entries( runtimeControls ) ) {

			settings[ settingName ] = control.getValue();

		}

		setRuntimeControlValues( setNFTMarkerExportSettings( config, settings ) );

	}

	function addRuntimeNumberSetting( settingName, labelText, minimum, maximum, infoText ) {

		const control = new UINumber();
		control.setPrecision( 0 );
		control.setRange( minimum, maximum );
		control.setStep( 1 );
		control.setWidth( '90px' );
		control.onChange( saveRuntimeControlValues );
		runtimeControls[ settingName ] = control;
		addRuntimeSettingRow( labelText, control, infoText );

	}

	addRuntimeNumberSetting(
		'trackingWidth', 'Tracking Width', 1, 7680,
		'Horizontal resolution used to initialize NFT tracking in the published app. Higher values can improve detail but require more processing.'
	);
	addRuntimeNumberSetting(
		'trackingHeight', 'Tracking Height', 1, 4320,
		'Vertical resolution used to initialize NFT tracking in the published app. Keep its aspect ratio aligned with the camera stream.'
	);
	addRuntimeNumberSetting(
		'cameraWidthMin', 'Camera Width Min', 1, 7680,
		'Minimum camera-stream width requested by the published app.'
	);
	addRuntimeNumberSetting(
		'cameraWidthMax', 'Camera Width Max', 1, 7680,
		'Maximum camera-stream width requested by the published app. It cannot be lower than Camera Width Min.'
	);
	addRuntimeNumberSetting(
		'cameraHeightMin', 'Camera Height Min', 1, 4320,
		'Minimum camera-stream height requested by the published app.'
	);
	addRuntimeNumberSetting(
		'cameraHeightMax', 'Camera Height Max', 1, 4320,
		'Maximum camera-stream height requested by the published app. It cannot be lower than Camera Height Min.'
	);
	addRuntimeNumberSetting(
		'targetFrameRate', 'Target Frame Rate', 1, 120,
		'Maximum number of camera frames processed per second for NFT tracking.'
	);

	const facingModeControl = new UISelect();
	facingModeControl.setWidth( '140px' );
	facingModeControl.setOptions( {
		environment: 'Rear Camera',
		user: 'Front Camera'
	} );
	facingModeControl.onChange( saveRuntimeControlValues );
	runtimeControls.facingMode = facingModeControl;
	addRuntimeSettingRow(
		'Preferred Camera', facingModeControl,
		'Camera direction requested by the published app. Rear Camera is the usual choice for marker tracking.'
	);

	const cameraParametersControl = new UIInput();
	cameraParametersControl.setWidth( '160px' );
	cameraParametersControl.onChange( saveRuntimeControlValues );
	runtimeControls.cameraParametersUrl = cameraParametersControl;
	addRuntimeSettingRow(
		'Camera Params', cameraParametersControl,
		'Path to the camera calibration file inside the published app. The default file is included automatically.'
	);

	const oefControl = new UICheckbox();
	oefControl.onChange( saveRuntimeControlValues );
	runtimeControls.oef = oefControl;
	addRuntimeSettingRow(
		'Matrix Filtering', oefControl,
		'Applies orientation-estimation filtering to reduce pose jitter in the published app.'
	);

	const showStatsControl = new UICheckbox();
	showStatsControl.onChange( saveRuntimeControlValues );
	runtimeControls.showStats = showStatsControl;
	addRuntimeSettingRow(
		'Performance Stats', showStatsControl,
		'Shows runtime performance panels in the published app for diagnostics.'
	);

	setRuntimeControlValues( getNFTMarkerExportSettings( config ) );

	const resetExportSettingsButton = new UIButton( 'Reset Export Settings' );
	resetExportSettingsButton.setMarginBottom( '8px' );
	resetExportSettingsButton.onClick( () => {

		setRuntimeControlValues( setNFTMarkerExportSettings( config, NFT_MARKER_EXPORT_DEFAULTS ) );

	} );
	activeImagePanel.add( resetExportSettingsButton );

	function showDefaultNftMarkerPreview() {

		activePreviewImg.src = defaultNftMarkerPreviewUrl;
		activeImageNameText.setValue( 'Default Pineball' );
		publishTargetText.setValue( 'Will publish: Default Pineball' );

	}

	showDefaultNftMarkerPreview();

	// Create NFT tab -------------------------------------------------
	// A selected file is staged here without changing the Active NFT.
	const pendingImagePanel = new UISpan();
	pendingImagePanel.dom.style.display = 'block';
	pendingImagePanel.dom.style.padding = '10px 0';

	const fileStatusText = new UIText( 'No image loaded.' );
	fileStatusText.setColor( '#888' );
	fileStatusText.setMarginBottom( '6px' );
	fileStatusText.dom.style.display = 'block';
	pendingImagePanel.add( fileStatusText );

	const chooseFileRow = new UIRow();
	chooseFileRow.dom.style.display = 'flex';
	chooseFileRow.dom.style.alignItems = 'center';
	chooseFileRow.dom.style.gap = '8px';
	chooseFileRow.setMarginBottom( '6px' );

	const chooseFileBtn = new UIButton( 'Choose File' );

	// Hidden native input (we click it from the button)
	const fileInput = new UIInput();
	fileInput.dom.type = 'file';
	fileInput.dom.accept = 'image/*';
	fileInput.dom.style.display = 'none';

	chooseFileBtn.onClick( () => {
		// Open the native file picker
		fileInput.dom.click();
	} );

	chooseFileRow.add( chooseFileBtn );
	chooseFileRow.add( fileInput );
	pendingImagePanel.add( chooseFileRow );

	const chosenFileNameText = new UIText( 'No file chosen' );
	chosenFileNameText.setColor( '#888' );
	chosenFileNameText.setMarginBottom( '8px' );
	chosenFileNameText.dom.style.display = 'block';
	chosenFileNameText.dom.style.overflowWrap = 'anywhere';
	pendingImagePanel.add( chosenFileNameText );

	// Create the generation controls here, then place them beneath the preview so
	// users can inspect the pending image before acting on it.
	const generateBtn = new UIButton( 'Generate NFT Marker' );
	generateBtn.setMarginBottom( '6px' );

	const cancelBtn = new UIButton( 'Discard Image' );
	cancelBtn.setMarginBottom( '10px' );

	const pendingPreviewImg = document.createElement( 'img' );
	pendingPreviewImg.alt = 'Pending NFT marker image';
	pendingPreviewImg.style.display = 'none';
	pendingPreviewImg.style.maxWidth = '100%';
	pendingPreviewImg.style.maxHeight = '180px';
	pendingPreviewImg.style.margin = '0 auto';
	pendingPreviewImg.style.objectFit = 'contain';
	pendingImagePanel.dom.appendChild( pendingPreviewImg );
	pendingImagePanel.add( generateBtn );
	pendingImagePanel.add( cancelBtn );

	const createStatusText = new UIText( 'Choose an image to make a new Natural Feature Tracker Marker.' );
	createStatusText.setColor( '#888' );
	createStatusText.setMarginBottom( '8px' );
	createStatusText.dom.style.display = 'block';
	pendingImagePanel.add( createStatusText );

	// addTab() selects each tab as it is registered, so explicitly return to Active
	// after both panels have been added for the initial view.
	imageTabs.addTab( 'nft-active-image', 'Active NFT', activeImagePanel );
	imageTabs.addTab( 'nft-pending-image', 'Create NFT', pendingImagePanel );
	imageTabs.select( 'nft-active-image' );
	content.add( imageTabs );

	// End File input -----------------------------------------------------


	//Start Generate Button Helper
	function setGenerateButtonState( enabled ) {

		// Disable state
		generateBtn.setDisabled( !enabled );

		// Visual feedback (optional but nice)
		generateBtn.dom.style.opacity = enabled ? '1' : '0.5';
		generateBtn.dom.style.pointerEvents = enabled ? 'auto' : 'none';

		generateBtn.dom.title = enabled
			? 'Generate NFT marker files'
			: ( isGenerating ? 'Generation is running...' : 'Choose an image to generate an NFT marker' );
	}
	//End Generate Button Helper

	// Start Spinner
	// start progress spinner: generation progress indicator (spinner + timer)
	const progressRow = new UIRow();
	progressRow.setMarginBottom('6px');
	progressRow.dom.setAttribute( 'role', 'status' );
	progressRow.dom.setAttribute( 'aria-live', 'polite' );
	progressRow.dom.style.alignItems = 'center';
	progressRow.dom.style.gap = '8px';

	//Start Animated Spinner
	//Swet up CSS for an animated spinner
	const style = document.createElement('style');
	style.textContent = `
	@keyframes spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
	}`;
	document.head.appendChild(style);

	//Set up the animated spinner
	const progressSpinner = document.createElement('span');
	//progressSpinner.textContent = '⏳';
	//progressSpinner.style.display = 'none';
	//progressSpinner.style.marginRight = '8px';
	progressSpinner.textContent = ''; // or remove
	progressSpinner.style.width = '20px';
	progressSpinner.style.height = '20px';
	progressSpinner.style.border = '2px solid #aaa';
	progressSpinner.style.borderTop = '2px solid #444';
	progressSpinner.style.borderRadius = '50%';
	progressSpinner.style.animation = 'spin 1s linear infinite';
	progressSpinner.setAttribute( 'aria-hidden', 'true' );
	progressRow.dom.style.display = 'none'; //Hide the spinner until you're ready to display it.

	const progressTimerText = new UIText('');
	progressTimerText.setColor('#aaa');

	progressRow.dom.appendChild(progressSpinner);
	progressRow.add(progressTimerText);

	pendingImagePanel.dom.insertBefore( progressRow.dom, cancelBtn.dom );

	let generationTimerHandle = null;
	let generationStartMs = 0;

	
	//Control spinner visibility
	function setGenerationIndicatorVisible( visible ) {

    // Show/hide the whole row
	    progressRow.dom.style.display = visible ? 'inline-flex' : 'none';

    if ( visible ) {

        // Show spinner animation
        progressSpinner.style.display = 'inline-block';

        // Initialize timer
        generationStartMs = performance.now();
	        progressTimerText.setValue( 'Generating… 0s' );

        if ( generationTimerHandle ) {
			clearInterval( generationTimerHandle );
		}

        generationTimerHandle = setInterval(() => {
            const elapsedSec = Math.floor((performance.now() - generationStartMs) / 1000);
	            progressTimerText.setValue(`Generating… ${elapsedSec}s`);
        }, 500);

		} else {

			// Hide spinner graphic and reset timer text
			progressSpinner.style.display = 'none';
			progressTimerText.setValue('');

			if ( generationTimerHandle ) {
				clearInterval( generationTimerHandle );
				generationTimerHandle = null;
			}
		}
	}


	// End Spinner

	
	pendingImagePanel.add(new UIHorizontalRule());
	
	//  place Download and Cancel buttons above the generator controls
	// content.add(downloadBtn);
	// content.add(cancelBtn);
	// 
	// ---------------------------------------------------------
	// Start Generator Control Options
	// ---------------------------------------------------------
	// Marker settings controls (Filename + generator params)
	// ---------------------------------------------------------

	const settingsRow1 = new UIRow();
	settingsRow1.setMarginBottom('8px');
	// start patch: keep filename + zft from overlapping on narrow widths
	settingsRow1.dom.style.display = 'flex';
	settingsRow1.dom.style.flexWrap = 'wrap';
	settingsRow1.dom.style.alignItems = 'center';
	settingsRow1.dom.style.gap = '6px';
	// end patch

	const fileNameInput = new UIInput().setWidth('140px');
	fileNameInput.setValue( defaultMarkerSettings.outputName );
	settingsRow1.add(new UIText('Filename').setWidth('90px'));
	settingsRow1.dom.appendChild( makeInfoButton( markerSettingInfo.outputName ) );
	settingsRow1.add(fileNameInput);

	const zftCheckbox = document.createElement('input');
	zftCheckbox.type = 'checkbox';
	zftCheckbox.checked = defaultMarkerSettings.zft;
	zftCheckbox.style.marginLeft = '10px';
	zftCheckbox.style.transform = 'translateY(2px)';

	const zftLabel = document.createElement('label');
	zftLabel.style.marginLeft = '6px';
	zftLabel.textContent = 'zft';

	const zftWrap = document.createElement('span');
	zftWrap.style.marginLeft = '12px';
	zftWrap.style.display = 'inline-flex';
	zftWrap.style.alignItems = 'center';
	zftWrap.style.gap = '6px';
	zftWrap.appendChild(zftCheckbox);
	zftWrap.appendChild(zftLabel);
	zftWrap.appendChild( makeInfoButton( markerSettingInfo.zft ) );

	// Helper to create numeric input blocks consistently
	function addNumberSetting(row, labelText, defaultValue, widthPx) {
		const input = new UIInput().setWidth(widthPx || '90px');
		input.setValue(String(defaultValue));
		//row.add(new UIText(labelText).setWidth('90px'));
		row.add(new UIText(labelText).setWidth('70px')); //90px is too large.
		row.add(input);
		return input;
	}

//settingsRow1.dom.appendChild(zftWrap);

	pendingImagePanel.add(settingsRow1);

	const advancedGenerationSettingsSection = createDisclosureSection( 'Advanced Generation Settings' );
	pendingImagePanel.dom.appendChild( advancedGenerationSettingsSection.details );

	// zft checkbox on its own row
	const zftRow = new UIRow();
	zftRow.setMarginBottom('8px');
	zftRow.add( new UIText('').setWidth('90px') ); // spacer to align with labels
	zftRow.dom.appendChild( zftWrap );
	advancedGenerationSettingsSection.body.appendChild( zftRow.dom );
	// end zft checkbox insert



	// start addNumberSettingRow function: each numeric setting on its own line (prevents sidebar warping)
	function addNumberSettingRow( labelText, defaultValue, widthPx, infoText ) {

		const row = new UIRow();
		row.setMarginBottom('8px');
		row.dom.style.display = 'flex';
		row.dom.style.flexWrap = 'wrap';
		row.dom.style.alignItems = 'center';
		row.dom.style.gap = '6px';

		const input = new UIInput().setWidth( widthPx || '120px' );
		input.setValue( String( defaultValue ) );

		row.add( new UIText( labelText ).setWidth( '110px' ) );
		row.dom.appendChild( makeInfoButton( infoText ) );
		row.add( input );

		advancedGenerationSettingsSection.body.appendChild( row.dom );

		return input;
	}
	// end addNumberSettingRow functions


	const dpiInput = addNumberSettingRow(
		'dpi', defaultMarkerSettings.dpi, '120px',
		markerSettingInfo.dpi
	);
	const levelInput = addNumberSettingRow(
		'level', defaultMarkerSettings.level, '120px',
		markerSettingInfo.level
	);
	const leveliInput = addNumberSettingRow(
		'leveli', defaultMarkerSettings.leveli, '120px',
		markerSettingInfo.leveli
	);
	const sdThreshInput = addNumberSettingRow(
		'sd_thresh', defaultMarkerSettings.sd_thresh, '120px',
		markerSettingInfo.sd_thresh
	);
	const maxThreshInput = addNumberSettingRow(
		'max_thresh', defaultMarkerSettings.max_thresh, '120px',
		markerSettingInfo.max_thresh
	);
	const minThreshInput = addNumberSettingRow(
		'min_thresh', defaultMarkerSettings.min_thresh, '120px',
		markerSettingInfo.min_thresh
	);
	const featureDensityInput = addNumberSettingRow(
		'feature_density', defaultMarkerSettings.feature_density, '120px',
		markerSettingInfo.feature_density
	);
	// end insert


	// Helper: read + sanitize settings (keeps generator code clean)
	
	function getMarkerSettings() {

	// --- Helper functions to safely parse values ---

	function toFloat(value, fallback) {
		const n = parseFloat(value);
		return Number.isFinite(n) ? n : fallback;
	}

	function toInt(value, fallback) {
		const n = parseInt(value);
		return Number.isFinite(n) ? n : fallback;
	}

	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}

	// --- Output name ---
	const outputName =
		(fileNameInput.getValue?.() ?? fileNameInput.dom?.value ?? '')
			.trim() || defaultMarkerSettings.outputName;

	// --- Parse numeric inputs safely ---
	let dpi = toFloat(dpiInput.dom.value, defaultMarkerSettings.dpi);
	let level = toInt(levelInput.dom.value, defaultMarkerSettings.level);
	let leveli = toInt(leveliInput.dom.value, defaultMarkerSettings.leveli);
	let sd_thresh = toFloat(sdThreshInput.dom.value, defaultMarkerSettings.sd_thresh);
	let max_thresh = toFloat(maxThreshInput.dom.value, defaultMarkerSettings.max_thresh);
	let min_thresh = toFloat(minThreshInput.dom.value, defaultMarkerSettings.min_thresh);
	let feature_density = toInt(featureDensityInput.dom.value, defaultMarkerSettings.feature_density);

	// --- Sanity constraints ---

	// DPI must be positive
	dpi = clamp(dpi, 1, 600);

	// Levels must not be negative
	level = clamp(level, 0, 5);
	leveli = clamp(leveli, 0, 5);

	// Standard deviation threshold must be positive
	sd_thresh = clamp(sd_thresh, 1, 100);

	// Feature density must be positive
	feature_density = clamp(feature_density, 1, 1000);

	// Thresholds must be between 0 and 1
	min_thresh = clamp(min_thresh, 0.01, 0.99);
	max_thresh = clamp(max_thresh, 0.01, 0.99);

	// Enforce correct relationship
	if (min_thresh >= max_thresh) {

		console.warn("min_thresh was >= max_thresh. Resetting to safe defaults.");

		min_thresh = defaultMarkerSettings.min_thresh;
		max_thresh = defaultMarkerSettings.max_thresh;
	}

	return {
		outputName,
		options: {
			zft: !!zftCheckbox.checked,
			dpi,
			level,
			leveli,
			sd_thresh,
			max_thresh,
			min_thresh,
			feature_density
		}
	};
}

	// ---------------------------------------------------------
	// End Generator Control Options
	// ---------------------------------------------------------



	// Old Generate button --------------------------------------------------

	//const generateBtn = new UIButton('Generate NFT Marker');
	//generateBtn.setMarginBottom('10px');
	//content.add(generateBtn);

	// Download button and Cancel Button -----------------------------------------------

		//Button setup
		// start buttons: moved button creation above the generator controls so it can be rendered earlier
		// const downloadBtn = new UIButton('Download the NFT Files');
		// downloadBtn.setMarginBottom('10px');

		// const cancelBtn = new UIButton('Cancel');
		// cancelBtn.setMarginBottom('10px');
		// end buttons

		//disable the spinner on a cancel:
		//setGenerationIndicatorVisible(false); //The spinner element's display is now set 
		// to 'none' on creation, so this code is no longer needed.

		//Button State flags
		let generationStarted = false;         // true once "Generate" clicked
		let stagedPreviousSnapshot = null; // what Cancel restores while a new upload is staged
		let isGenerating = false; // Prevent double-click generation runs
		let generationCancellationRequested = false;


		//Create a helper function to control the download button's enable/disable state
		//as well as its visual stylings
		function setDownloadButtonState( enabled ) {

			//Set the download's disable state to the opposite of what was passed into the function
			//(this allows for easier-to-read code)
			downloadBtn.setDisabled( !enabled );

			// Visual feedback
			downloadBtn.dom.style.opacity = enabled ? '1' : '0.5';
			downloadBtn.dom.style.pointerEvents = enabled ? 'auto' : 'none';

			// Tooltip hint
			downloadBtn.dom.title = enabled
				? 'Download the active NFT marker files'
				: 'Download unavailable while generation is running';
		}

		function hasGeneratedNftOutput() {
			return !!window.NFT_Iset && !!window.NFT_Fset && !!window.NFT_Fset3;
		}

		function refreshDownloadUiState() {

			// Download always uses Active NFT data, including while a Pending Image is
			// staged or generating. Fall back to the packaged dataset when no custom trio exists.
			if ( hasGeneratedNftOutput() ) {
				setDownloadButtonState( true );
				downloadSourceText.setValue( 'Download source: Generated NFT files' );
				return;
			}

			setDownloadButtonState( true );
			downloadSourceText.setValue( 'Download source: Default NFT files' );

		}

		//Create a helper function to control the Cancel Button's enable/disable state
		//As well as its visual stylings
		cancelBtn.onClick(() => {

			if ( isGenerating ) {

				generationCancellationRequested = true;
				cancelNftMarkerGeneration();
				cancelBtn.setDisabled( true );
				setCancelButtonMode( 'canceling' );
				createStatusText.setValue( 'Canceling NFT marker generation...' );
				return;

			}

			// Restore the snapshot captured before this upload, then discard only the
			// Pending Image. The current Active NFT remains the source of truth.
			if ( stagedPreviousSnapshot ) {

				applySnapshotToWindow( stagedPreviousSnapshot );

			}

			clearPendingNftImage();
			stagedPreviousSnapshot = null;
			generationStarted = false;
			activeStatusText.setValue( 'Pending image discarded. Active NFT was not changed.' );
			imageTabs.select( 'nft-active-image' );
			refreshDownloadUiState();

	});


			//Create a generic helper to show/hide any UIButton wrapper
			/* generic helper to show/hide any UIButton wrapper
			* - button : UIButton instance (must have .dom)
			* - visible: boolean
			*/
			function setButtonVisibility( button, visible ) {
				if ( !button || !button.dom ) return;
				button.dom.style.display = visible ? 'inline-block' : 'none';
				button.dom.style.pointerEvents = visible ? 'auto' : 'none';
			}

			function setCancelButtonMode( mode ) {

				const labels = {
					discard: 'Discard Image',
					cancel: 'Cancel Generation',
					canceling: 'Canceling...'
				};

				cancelBtn.dom.textContent = labels[ mode ];
				cancelBtn.dom.title = mode === 'discard'
					? 'Discard the pending image without changing the active NFT'
					: 'Stop NFT marker generation and preserve the active NFT';

			}

			//Helper Function: Check if all three NFT files are avalible
			//() Returns true only if all 3 generated files are present)
			// Returns true when the standard three NFT dataset files exist (.iset, .fset, .fset3).
			function hasNftFileTrio( imageSetFile, featureSetFile, featureSet3File ) {
				return !!imageSetFile && !!featureSetFile && !!featureSet3File;
			}


			// Returns true when either output mode produced files that can be downloaded.
			function hasDownloadableNftOutput() {

				// The download button should be enabled only when the standard three-file dataset exists.
				// The zft file is optional and may or may not exist depending on the checkbox.
				return hasNftFileTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 );

			}


			// Sanitize the output name for the Emscripten in-memory file system and for downloads
			function sanitizeOutputName( name ) {

				if ( typeof name !== 'string' ) return 'marker';

				// Trim whitespace
				let cleaned = name.trim();

				// Replace path separators and illegal characters
				cleaned = cleaned.replace( /[\/\\:?*"<>|]+/g, '_' );

				// Collapse multiple spaces/underscores
				cleaned = cleaned.replace( /\s+/g, '_' ).replace( /_+/g, '_' );

				// Remove leading/trailing underscores
				cleaned = cleaned.replace( /^_+|_+$/g, '' );

				// Fallback if empty
				if ( cleaned.length === 0 ) return 'marker';

				return cleaned;
			}


			// Helper function: Push a snapshot  of the NFT files and image blob
			// into the window globals (what Menubar.File.js reads)
			function applySnapshotToWindow( snapshot ) {

				const hasCompleteState = snapshot?.iset instanceof Uint8Array &&
					snapshot?.fset instanceof Uint8Array &&
					snapshot?.fset3 instanceof Uint8Array &&
					snapshot?.imageBlob instanceof Blob;
				const state = hasCompleteState ? {
					iset: snapshot.iset,
					fset: snapshot.fset,
					fset3: snapshot.fset3,
					zft: snapshot.zft,
					imageBlob: snapshot.imageBlob,
					dpi: snapshot.dpi,
					outputName: snapshot.outputName,
					generationSettings: snapshot.generationSettings
				} : null;

				setMarkerSystemState( 'nft', state );
				editor.signals.markerStateChanged.dispatch( 'nft' );

			}



	// Initial UI state:
	//setDownloadButtonState(false);
	//setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );
	refreshDownloadUiState();
	setButtonVisibility(downloadBtn, true); // always visible per your hint
	setButtonVisibility(cancelBtn, false);  // hidden until image loaded and generation not started
	setButtonVisibility(generateBtn, false); // hidden until image loaded

	//Insert buttons
	//content.add(downloadBtn);
	//content.add(cancelBtn);
		


	// Active and Pending image state ---------------------------------
	// loadedImage belongs to Pending; previewObjectURL belongs to Active.
	let loadedImage = null;
	let loadedImageFileName = null;
	let previewObjectURL = null;
	// Tracks the blob URL created for the currently uploaded image so we can revoke it safely.
	let uploadedImageObjectURL = null;

	let lastGoodOutputName = null; // keeps downloads in sync with the last-good generated files

	function syncActiveNftState() {

		const state = getMarkerSystemState( 'nft' );

		if ( previewObjectURL ) URL.revokeObjectURL( previewObjectURL );
		previewObjectURL = null;
		lastGoodOutputName = state?.outputName ?? null;

		if ( state?.imageBlob instanceof Blob ) {

			previewObjectURL = URL.createObjectURL( state.imageBlob );
			activePreviewImg.src = previewObjectURL;
			activeImageNameText.setValue( state.outputName || 'Generated NFT' );
			publishTargetText.setValue( `Will publish: ${ state.outputName || 'Generated NFT' }` );
			fileNameInput.setValue( state.outputName || 'generatedMarker' );
			activeStatusText.setValue( 'Using the active generated NFT marker.' );

		} else {

			showDefaultNftMarkerPreview();
			activeStatusText.setValue( 'Using the default Pineball NFT marker.' );

		}

		updateActiveSettingValues( state );

		refreshDownloadUiState();

	}

	editor.signals.markerStateChanged.add( function ( markerSystemId ) {

		if ( markerSystemId === undefined || markerSystemId === 'nft' ) syncActiveNftState();

	} );

	syncActiveNftState();

	// Capture all values that define the Active NFT so Cancel and generation errors
	// can restore one coherent marker set rather than mixing files from two runs.
	function captureActiveNftSnapshot() {

		const state = getMarkerSystemState( 'nft' );

		return {
			iset: window.NFT_Iset,
			fset: window.NFT_Fset,
			fset3: window.NFT_Fset3,
			zft: window.NFT_Zft,
			imageBlob: window.NFT_ImageBlob,
			dpi: window.NFT_Dpi,
			previewUrl: previewObjectURL,
			outputName: lastGoodOutputName,
			generationSettings: state?.generationSettings
		};

	}

	// Release only Pending resources. Active object URLs and generated globals must
	// remain valid until a later generation is promoted successfully or Reset is used.
	function clearPendingNftImage() {

		loadedImage = null;
		loadedImageFileName = null;

		if ( uploadedImageObjectURL ) {

			URL.revokeObjectURL( uploadedImageObjectURL );
			uploadedImageObjectURL = null;

		}

		try { fileInput.dom.value = ''; } catch ( error ) {}

		pendingPreviewImg.removeAttribute( 'src' );
		pendingPreviewImg.style.display = 'none';
		fileStatusText.setValue( 'No image loaded.' );
		chosenFileNameText.setValue( 'No file chosen' );
		chosenFileNameText.setColor( '#888' );
		createStatusText.setValue( 'Choose an image to make a new Natural Feature Tracker Marker.' );
		setGenerateButtonState( false );
		setButtonVisibility( generateBtn, false );
		setButtonVisibility( cancelBtn, false );
		setCancelButtonMode( 'discard' );

	}

	function resetToDefaultNftMaker() {

		if ( isGenerating ) {
			alert( 'NFT generation is currently running. Please wait for it to finish before resetting.' );
			return;
		}

		const confirmed = confirm(
			'Reset to the default NFT marker?\n\n' +
			'This clears the currently active generated NFT marker data in this session. ' +
			'Export will use the built-in default NFT marker until a new marker is generated.'
		);

		if ( !confirmed ) return;

		setMarkerSystemState( 'nft', null );
		editor.signals.markerStateChanged.dispatch( 'nft' );

		clearPendingNftImage();
		generationStarted = false;
		stagedPreviousSnapshot = null;

		imageTabs.select( 'nft-active-image' );

		activeStatusText.setValue( 'Reset to default NFT marker. Export now uses the built-in default until a new marker is generated.' );

		refreshDownloadUiState();

		alert( 'NFT marker reset to default.' );

	}

	resetToDefaultNftMakerBtn.onClick( () => {
		resetToDefaultNftMaker();
	} );


	// ---------------------------------------------------------
	// Load image event
	// ---------------------------------------------------------

	fileInput.dom.addEventListener('change', async (event) => {

		const file = event.target.files[0];
		if (!file) return;

		//loadedImage = await readImageFile(file); //before the URL blob was tracked for safe disposal
		const readResult = await readImageFile( file );
		loadedImage = readResult.img;

		// If we had a previous uploaded image URL still hanging around, revoke it now because
		// the user has successfully loaded a new uploaded image.
		if ( uploadedImageObjectURL ) {
			URL.revokeObjectURL( uploadedImageObjectURL );
			uploadedImageObjectURL = null;
		}

		uploadedImageObjectURL = readResult.objectUrl;
		loadedImageFileName = file.name;


		fileStatusText.setValue( `Loaded: ${file.name}` ); // this is the line above the chooser
		chosenFileNameText.setValue( file.name );
		chosenFileNameText.setColor( '#bbb' );

		createStatusText.setValue( 'Ready to generate.' );
		// Show the upload only in Pending. Active remains unchanged until generation succeeds.
		pendingPreviewImg.src = loadedImage.src;
		pendingPreviewImg.style.display = 'block';
		imageTabs.select( 'nft-pending-image' );

		// Capture the current exported/downloadable NFT state before this upload stages a new image.
		// Cancel uses this to restore whichever marker set was active before the user picked a replacement.
		stagedPreviousSnapshot = captureActiveNftSnapshot();

		// We have an uploaded image: show Generate, and show Cancel (since generation not started yet)
		generationStarted = false;
		setGenerateButtonState( true );
		setButtonVisibility(generateBtn, true);
		setButtonVisibility(cancelBtn, true);
		setCancelButtonMode( 'discard' );

		refreshDownloadUiState();

		// Store it so Cancel can restore (even if user hasn’t generated anything new yet)
		// If there's no trio, snapshot still matters because preview might exist.
		


	});

	// ---------------------------------------------------------
	// Generate NFT dataset
	// ---------------------------------------------------------

	generateBtn.onClick(async () => {

		if ( !loadedImage || isGenerating ) return;

		generationCancellationRequested = false;
		generationStarted = true;
		setButtonVisibility(cancelBtn, true);
		isGenerating = true;
		setCancelButtonMode( 'cancel' );
		refreshDownloadUiState();

		// Generated files stay local throughout processing. The window globals continue
		// to expose the previous Active NFT until the complete result is ready to promote.
		const rollbackSnapshot = captureActiveNftSnapshot();
		let generatedIset = null;
		let generatedFset = null;
		let generatedFset3 = null;
		let generatedZft = null;

		createStatusText.setValue('Generating NFT marker… This can take up to ten minutes');
		setButtonVisibility( generateBtn, false );
		setGenerationIndicatorVisible( true ); //Spinner on
		setGenerateButtonState( false );
		setButtonVisibility(cancelBtn, true);


		try {
			const imgData = await imageToImageData(loadedImage);
			const generatedImageBlob = await imageDataToPngBlob( imgData );

			if ( generationCancellationRequested ) throw createNftGenerationCanceledError();

			// Keep the uploaded image blob URL until the user selects a new image (or clicks Cancel).
			// This allows reliable "Regenerate" runs without requiring a re-upload.


			//=======================================
			//Start the Run WASM Generator section
			//=======================================


			// NFT Default Options
			//const options = {
			//	zft: false,
			//	dpi: 72,
			//	level: 2,
			//	leveli: 1,
			//	sd_thresh: 8,
			//	max_thresh: 0.9,
			//	min_thresh: 0.55,
			//	feature_density: 70
			//};

			//const outputName = 'tempFilename';

			//ParamStr that uses the default options
			//const paramStr =
			//	`0 ${outputName}` +
			//	` -dpi=${options.dpi}` +
			//	` -level=${options.level}` +
			//	` -leveli=${options.leveli}` +
			//	` -sd_thresh=${options.sd_thresh}` +
			//	` -max_thresh=${options.max_thresh}` +
			//	` -min_thresh=${options.min_thresh}` +
			//	` -feature_density=${options.feature_density}` +
			//	( options.zft ? ' -zft' : '' );
				

			//Instead of hardcoding the NFT generation options, call what the user has input
			
			// Pull options and outputName from the UI controls
			const settings = getMarkerSettings();
			const rawOutputName = settings.outputName;

			// Sanitize the name to prevent FS/path errors
			const outputName = sanitizeOutputName( rawOutputName );

			// Use the user-selected options from the UI
			const options = settings.options;
			const output = await generateNftMarkerInWorker( imgData, options );

			generatedIset = output.iset;
			generatedFset = output.fset;
			generatedFset3 = output.fset3;
			generatedZft = output.zft;

			//=======================================
			//End the Run WASM Generator section
			//=======================================

			setMarkerSystemState( 'nft', {
				iset: generatedIset,
				fset: generatedFset,
				fset3: generatedFset3,
				zft: generatedZft,
				imageBlob: generatedImageBlob,
				dpi: options.dpi,
				outputName: outputName,
				generationSettings: { ...options }
			} );
			editor.signals.markerStateChanged.dispatch( 'nft' );

			//Status Text's Success Message:
			activeStatusText.setValue( 'NFT marker generated successfully. It is now the active marker for the viewport, downloads, and exports.' );


			setGenerationIndicatorVisible( false ); //Spinner off
			
			generationStarted = false;
			stagedPreviousSnapshot = null;
			// The processed image is no longer pending; return the user to its Active preview.
			clearPendingNftImage();
			imageTabs.select( 'nft-active-image' );

			
		} catch ( error ) {

			const wasCanceled = error?.name === 'AbortError';

			if ( !wasCanceled ) console.error( error );

			setGenerationIndicatorVisible( false ); //Errored out -- turn spinner off.

			//Disable the download button so the user doesn't download broken files:
			//setDownloadButtonState( false ); //downloadBtn.setDisabled(true); //replaced by relaoding hte snapshot
			// A failed generation should not leave the editor in a half-generated state.
			// Restore the snapshot from before this run, keep Pending available for retry,
			// and leave publish/download connected to the previous Active NFT.
			if ( rollbackSnapshot ) {
				applySnapshotToWindow( rollbackSnapshot );

			}

			generationStarted = false;

			if ( wasCanceled ) {

				clearPendingNftImage();
				stagedPreviousSnapshot = null;
				activeStatusText.setValue( 'NFT marker generation canceled. The active NFT was preserved.' );
				imageTabs.select( 'nft-active-image' );

			} else {

				createStatusText.setValue( 'Generation failed. The active NFT was preserved and the pending image is available to retry.' );
				setButtonVisibility( generateBtn, !!loadedImage );
				setButtonVisibility( cancelBtn, !!loadedImage && stagedPreviousSnapshot !== null );
				imageTabs.select( 'nft-pending-image' );

			}

		} finally {

			// Always unlock the Generate button once this run finishes
			isGenerating = false;
			generationCancellationRequested = false;
			cancelBtn.setDisabled( false );
			setCancelButtonMode( 'discard' );

			// Re-enable Generate only if an image is still loaded
			setGenerateButtonState( !!loadedImage );
			refreshDownloadUiState();

		}

	});

	// ---------------------------------------------------------
	// Download NFT marker files (generated set when present, default set otherwise)
	// ---------------------------------------------------------
	downloadBtn.onClick( async () => {

		function triggerBinaryDownload( data, fileName ) {
			const blob = new Blob( [ data ], { type: 'application/octet-stream' } );
			const url = URL.createObjectURL( blob );

			const downloadLinkElement = document.createElement( 'a' );
			downloadLinkElement.href = url;
			downloadLinkElement.download = fileName;
			downloadLinkElement.style.display = 'none';

			document.body.appendChild( downloadLinkElement );
			downloadLinkElement.click();
			downloadLinkElement.remove();

			URL.revokeObjectURL( url );
		}

		function triggerTextDownload( text, fileName ) {
			const blob = new Blob( [ text ], { type: 'text/plain;charset=utf-8' } );
			const url = URL.createObjectURL( blob );

			const downloadLinkElement = document.createElement( 'a' );
			downloadLinkElement.href = url;
			downloadLinkElement.download = fileName;
			downloadLinkElement.style.display = 'none';

			document.body.appendChild( downloadLinkElement );
			downloadLinkElement.click();
			downloadLinkElement.remove();

			URL.revokeObjectURL( url );
		}

		async function downloadDefaultNftImage( baseName ) {
			const defaultImageUrl = new URL( '../files/ARNFTExportFiles/img/pinball.jpg', import.meta.url ).toString();
			const imageResponse = await fetch( defaultImageUrl );

			if ( !imageResponse.ok ) {
				throw new Error( 'Could not load default NFT image: pinball.jpg' );
			}

			const imageBuffer = await imageResponse.arrayBuffer();
			triggerBinaryDownload( new Uint8Array( imageBuffer ), baseName + '.jpg' );
		}

		const hasStandardTrioOutput =
		!!window.NFT_Iset &&
		!!window.NFT_Fset &&
		!!window.NFT_Fset3;

		// Generated output takes priority because it represents the currently active custom marker.
		// If that trio is missing, we intentionally fall back to the default marker packaged with the editor.
		if ( hasStandardTrioOutput ) {

			const baseName =
				( typeof lastGoodOutputName === 'string' && lastGoodOutputName.trim() )
					? lastGoodOutputName.trim()
					: 'generatedMarkerFile';

			const filesToDownload = [
				{ data: window.NFT_Iset, ext: '.iset' },
				{ data: window.NFT_Fset, ext: '.fset' },
				{ data: window.NFT_Fset3, ext: '.fset3' }
			];

			if ( window.NFT_Zft ) {
				filesToDownload.push( { data: window.NFT_Zft, ext: '.zft' } );
			}

			filesToDownload.forEach( ( { data, ext } ) => {
				triggerBinaryDownload( data, baseName + ext );
			} );

			if ( window.NFT_ImageBlob instanceof Blob ) {
				triggerBinaryDownload( window.NFT_ImageBlob, baseName + '.png' );
			} else {
				const sourceImageName = loadedImageFileName || 'unknown-image-name';
				const generatedAt = new Date().toISOString();
				const missingImageLog =
					'Generated NFT image data was missing at download time.\n' +
					`Timestamp (UTC): ${generatedAt}\n` +
					`Source image name: ${sourceImageName}\n` +
					'Custom NFT dataset files were downloaded, but no generated image blob was available.\n' +
					'No default image was downloaded because custom mode was active.\n' +
					'The downloaded marker files should still work with the image if it can be located.';
				triggerTextDownload( missingImageLog, 'log.txt' );
			}

			activeStatusText.setValue( 'Downloaded the active generated NFT marker files.' );

			return;
		}

		// Default-mode download mirrors what publish uses when no custom NFT marker has been generated:
		// ship the template dataset files and the built-in pinball reference image together.
		const defaultBaseName = 'generatedMarkerFile';
		const defaultFiles = [ '.iset', '.fset', '.fset3' ];
		const defaultNftDataUrlBase = new URL( '../files/ARNFTExportFiles/DataNFT/', import.meta.url );

		try {
			for ( const ext of defaultFiles ) {
				const defaultFileUrl = new URL( `generatedMarkerFile${ext}`, defaultNftDataUrlBase ).toString();
				const response = await fetch( defaultFileUrl );
				if ( !response.ok ) {
					throw new Error( `Could not load default NFT file: generatedMarkerFile${ext}` );
				}

				const fileBuffer = await response.arrayBuffer();
				triggerBinaryDownload( new Uint8Array( fileBuffer ), defaultBaseName + ext );
			}

			await downloadDefaultNftImage( defaultBaseName );

			activeStatusText.setValue( 'Downloaded default NFT marker files and image.' );
			refreshDownloadUiState();
		} catch ( error ) {
			console.error( error );
			activeStatusText.setValue( 'Unable to download the default NFT marker files.' );
			alert( 'Unable to download default NFT marker files. Check console for details.' );
		}

	} );



	// ---------------------------------------------------------
	// Utilities
	// ---------------------------------------------------------

	function readImageFile( file ) {
		return new Promise( ( resolve, reject ) => {

			const img = new Image();

			// The uploaded file has to pass through an <img> first because the generator works from
			// canvas/ImageData rather than directly from the File object.
			const objectUrl = URL.createObjectURL( file );

			img.onload = () => {
				resolve( { img, objectUrl } );
			};

			img.onerror = ( error ) => {
				// If the image fails to load, release the blob URL immediately.
				URL.revokeObjectURL( objectUrl );
				reject( error );
			};

			img.src = objectUrl;

		} );
	}


	async function imageToImageData(img) {
		const canvas = document.createElement('canvas');
		canvas.width = img.width;
		canvas.height = img.height;
		const ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0);
		return ctx.getImageData(0, 0, canvas.width, canvas.height);
	}


	function imageDataToPngBlob( imageData ) {

		const canvas = document.createElement( 'canvas' );
		canvas.width = imageData.width;
		canvas.height = imageData.height;

		const context = canvas.getContext( '2d' );

		if ( context === null ) return Promise.reject( new Error( 'Unable to create the NFT preview canvas.' ) );

		context.putImageData( imageData, 0, 0 );

		return new Promise( ( resolve, reject ) => {

			canvas.toBlob( ( blob ) => {

				if ( blob !== null ) resolve( blob );
				else reject( new Error( 'Unable to encode the NFT preview image.' ) );

			}, 'image/png' );

		} );

	}


	/*
	// Wait until the WASM runtime has attached Module to window
	async function waitForNftModule() {

		// fast path
		if (window.Module) return window.Module;

		// wait up to ~10s
		const timeoutMs = 10000;
		const start = performance.now();

		while (!window.Module) {

			if (performance.now() - start > timeoutMs) {
				throw new Error('NFT Module was not found on window. Check script loading order/paths.');
			}

			await new Promise((resolve) => setTimeout(resolve, 50));

		}
		return window.Module;
	}
	*/



	return container;
}

export { SidebarNFTMarkerGenerator };
