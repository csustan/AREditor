
/*
// Ensure Emscripten resolves the .wasm from the correct folder (prevents doubled paths)
globalThis.Module = globalThis.Module || {};
globalThis.Module.locateFile = ( path, prefix ) => {
	if ( path.endsWith( '.wasm' ) ) return '/editor/js/libs/nft/' + path;
	return prefix + path;
};
*/

// start module imports: basics and the NFT marker creator ESM import

import { UISpan, UIRow, UIText, UIButton, UIInput, UIHorizontalRule, UITabbedPanel } from './libs/ui.js';
import nftMarkerCreator from './libs/nft/NftMarkerCreator_wasm.js';

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


// start Module Loader Helper: load + cache the WASM module once

// /editor/js/Sidebar.NFTMarkerGenerator.js

let nftModulePromise = null;

function getNftModule() {

	if ( nftModulePromise !== null ) return nftModulePromise;

	// Build an absolute URL to /editor/js/libs/nft/ based on THIS module’s location.
	const nftBaseUrl = new URL( './libs/nft/', import.meta.url );

	nftModulePromise = nftMarkerCreator( {
		// Emscripten sometimes passes a path with folders; normalize to filename to prevent double paths.
		locateFile: ( path ) => {
			const fileName = path.split( '/' ).pop();
			return new URL( fileName, nftBaseUrl ).toString();
		}
	} );

	return nftModulePromise;

}


//let nftModulePromise = null;

//function getNftModule() {
//
//	if ( nftModulePromise !== null ) return nftModulePromise;
//
//	nftModulePromise = nftMarkerCreator( {
//		//// Ensure the .wasm is loaded from /editor/js/libs/nft/
//		//locateFile: ( path ) => new URL( `./libs/nft/${ path }`, import.meta.url ).toString()
//		 Force the wasm URL to be absolute (prevents double-prefix bugs)
//		locateFile: ( path ) => `/editor/js/libs/nft/${ path }`		
//	} );
//	return nftModulePromise;
//}

/*
function getNftModule() {

	if ( nftModulePromise !== null ) return nftModulePromise;

	// Let the global Module.locateFile handle wasm resolution
	nftModulePromise = nftMarkerCreator();

	return nftModulePromise;

}
*/

// end Module Loader Helper



function SidebarNFTMarkerGenerator(editor) {

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

	// Title -----------------------------------------------------

	const header = new UIText( 'NFT Marker Generator' );
	header.setFontSize( '14px' );
	header.setMarginBottom( '8px' );
	header.dom.style.display = 'block'; // ensures the next text does not sit on the same line
	content.add( header );

	const publishButton = new UIButton( editor.strings.getKey( 'menubar/file/publish_arnft' ) );
	publishButton.setWidth( '100%' );
	publishButton.setMarginBottom( '12px' );
	publishButton.onClick( () => editor.signals.publishARNFTApp.dispatch() );
	content.add( publishButton );


	// File input -----------------------------------------------------

	// Keep the packaged Pineball marker as the initial Active NFT until a custom
	// marker has completed every generation step successfully.
	const defaultNftMarkerPreviewUrl = new URL( '../files/ARNFTExportFiles/img/pinball.jpg', import.meta.url ).toString();

	// Explain why choosing a new image does not immediately replace the marker used
	// by the viewport, downloads, and publishing.
	const imageTabsHeader = new UIRow();
	imageTabsHeader.dom.style.display = 'flex';
	imageTabsHeader.dom.style.alignItems = 'center';
	imageTabsHeader.dom.style.gap = '6px';
	imageTabsHeader.setMarginBottom( '6px' );
	imageTabsHeader.add( new UIText( 'NFT Images' ) );
	imageTabsHeader.dom.appendChild( makeInfoButton(
		'Active NFT is used by the viewport, downloads, and exports. Pending Image is awaiting processing and becomes active only after successful generation. Cancel discards the pending image.'
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

	function showDefaultNftMarkerPreview() {

		activePreviewImg.src = defaultNftMarkerPreviewUrl;
		activeImageNameText.setValue( 'Default Pineball' );

	}

	showDefaultNftMarkerPreview();

	// Pending Image tab ----------------------------------------------
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

	// Keep generation controls directly beneath the chooser and selected filename
	// so it is clear which pending image will be processed.
	const generateBtn = new UIButton( 'Generate NFT Marker' );
	generateBtn.setMarginBottom( '6px' );
	pendingImagePanel.add( generateBtn );

	const cancelBtn = new UIButton( 'Cancel' );
	cancelBtn.setMarginBottom( '10px' );
	pendingImagePanel.add( cancelBtn );

	const pendingPreviewImg = document.createElement( 'img' );
	pendingPreviewImg.alt = 'Pending NFT marker image';
	pendingPreviewImg.style.display = 'none';
	pendingPreviewImg.style.maxWidth = '100%';
	pendingPreviewImg.style.maxHeight = '180px';
	pendingPreviewImg.style.margin = '0 auto';
	pendingPreviewImg.style.objectFit = 'contain';
	pendingImagePanel.dom.appendChild( pendingPreviewImg );

	// addTab() selects each tab as it is registered, so explicitly return to Active
	// after both panels have been added for the initial view.
	imageTabs.addTab( 'nft-active-image', 'Active NFT', activeImagePanel );
	imageTabs.addTab( 'nft-pending-image', 'Pending Image', pendingImagePanel );
	imageTabs.select( 'nft-active-image' );
	content.add( imageTabs );

	// End File input -----------------------------------------------------


	// Status text -----------------------------------------------------

	const statusText = new UIText( 'Load an image to begin.' );
	statusText.setColor( '#888' );
	statusText.setMarginBottom( '8px' );
	statusText.dom.style.display = 'block'; // prevents joining with other inline elements
	content.add( statusText );

	const resetToDefaultNftMakerBtn = new UIButton( 'Reset to Default NFT Maker' );
	resetToDefaultNftMakerBtn.setMarginBottom( '10px' );
	content.add( resetToDefaultNftMakerBtn );
	// end Download Button

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
	progressRow.setMarginBottom('8px');

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
	progressRow.dom.style.display = 'none'; //Hide the spinner until you're ready to display it.

	const progressTimerText = new UIText('');
	progressTimerText.setColor('#aaa');

	progressRow.dom.appendChild(progressSpinner);
	progressRow.add(progressTimerText);

	content.add(progressRow);

	let generationTimerHandle = null;
	let generationStartMs = 0;

	
	//Control spinner visibility
	function setGenerationIndicatorVisible( visible ) {

    // Show/hide the whole row
    progressRow.dom.style.display = visible ? 'block' : 'none';

    if ( visible ) {

        // Show spinner animation
        progressSpinner.style.display = 'inline-block';

        // Initialize timer
        generationStartMs = performance.now();
        //progressTimerText.setValue('0s'); //set up text later.

        if ( generationTimerHandle ) {
			clearInterval( generationTimerHandle );
		}

        generationTimerHandle = setInterval(() => {
            const elapsedSec = Math.floor((performance.now() - generationStartMs) / 1000);
            progressTimerText.setValue(`${elapsedSec}s`);
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

	
	// start button creation: buttons placed above the generator controls
	// These buttons are created here so they can be added to the container before the control rows are built.
	const downloadBtn = new UIButton( 'Download the NFT Files' );
	downloadBtn.setMarginBottom( '10px' );

	const downloadSourceText = new UIText( 'Download source: Default NFT files' );
	downloadSourceText.setColor( '#888' );
	downloadSourceText.setMarginBottom( '8px' );
	downloadSourceText.dom.style.display = 'block';

	content.add( downloadBtn );
	content.add( downloadSourceText );
	// end button creation

	content.add(new UIHorizontalRule());
	
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
	fileNameInput.setValue('generatedMarker');
	settingsRow1.add(new UIText('Filename').setWidth('90px'));
	settingsRow1.dom.appendChild( makeInfoButton(
		'Base name for the generated NFT dataset files. File extensions are added automatically.'
	) );
	settingsRow1.add(fileNameInput);

	const zftCheckbox = document.createElement('input');
	zftCheckbox.type = 'checkbox';
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
	zftWrap.appendChild( makeInfoButton(
		'Also generates the optional .zft companion file alongside the standard NFT marker dataset.'
	) );

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

	content.add(settingsRow1);

	// zft checkbox on its own row
	const zftRow = new UIRow();
	zftRow.setMarginBottom('8px');
	zftRow.add( new UIText('').setWidth('90px') ); // spacer to align with labels
	zftRow.dom.appendChild( zftWrap );
	content.add( zftRow );
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

		content.add( row );

		return input;
	}
	// end addNumberSettingRow functions


	const dpiInput = addNumberSettingRow(
		'dpi', 72, '120px',
		'Source image resolution in dots per inch. This determines the marker\'s real-world scale during tracking.'
	);
	const levelInput = addNumberSettingRow(
		'level', 2, '120px',
		'Tracking-feature extraction level. Higher values select more features for ongoing marker tracking.'
	);
	const leveliInput = addNumberSettingRow(
		'leveli', 1, '120px',
		'Initialization-feature extraction level. Higher values select more features for initially finding the marker.'
	);
	const sdThreshInput = addNumberSettingRow(
		'sd_thresh', 8, '120px',
		'Minimum local image variation required for feature candidates. Higher values reject more low-detail areas.'
	);
	const maxThreshInput = addNumberSettingRow(
		'max_thresh', 0.9, '120px',
		'Upper similarity threshold used during feature selection. Keep this value above min_thresh.'
	);
	const minThreshInput = addNumberSettingRow(
		'min_thresh', 0.55, '120px',
		'Lower similarity threshold used during feature selection. Keep this value below max_thresh.'
	);
	const featureDensityInput = addNumberSettingRow(
		'feature_density', 70, '120px',
		'Target density of extracted feature points. Higher values retain more points and may increase generation time and dataset size.'
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
			.trim() || 'generatedMarker';

	// --- Parse numeric inputs safely ---
	let dpi = toFloat(dpiInput.dom.value, 72);
	let level = toInt(levelInput.dom.value, 2);
	let leveli = toInt(leveliInput.dom.value, 1);
	let sd_thresh = toFloat(sdThreshInput.dom.value, 8);
	let max_thresh = toFloat(maxThreshInput.dom.value, 0.9);
	let min_thresh = toFloat(minThreshInput.dom.value, 0.55);
	let feature_density = toInt(featureDensityInput.dom.value, 70);

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

		min_thresh = 0.55;
		max_thresh = 0.9;
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

			// Restore the snapshot captured before this upload, then discard only the
			// Pending Image. The current Active NFT remains the source of truth.
			if ( stagedPreviousSnapshot ) {

				applySnapshotToWindow( stagedPreviousSnapshot );
				showActiveNftSnapshot( stagedPreviousSnapshot );

			}

			clearPendingNftImage();
			stagedPreviousSnapshot = null;
			generationStarted = false;
			statusText.setValue( 'Pending image discarded. Active NFT was not changed.' );
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

				window.NFT_Iset = snapshot.iset;
				window.NFT_Fset = snapshot.fset;
				window.NFT_Fset3 = snapshot.fset3;
				window.NFT_Zft = snapshot.zft;

				window.NFT_ImageBlob = snapshot.imageBlob;
				window.NFT_Dpi = snapshot.dpi;

				refreshDownloadUiState();
				editor.signals.nftMarkerChanged.dispatch();

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

	// Snapshot of last successful generation (for Cancel + Download sync)
	let lastGoodIset = null;
	let lastGoodFset = null;
	let lastGoodFset3 = null;
	let lastGoodImageBlob = null;
	let lastGoodDpi = null;
	let lastGoodZft = null;
	let lastGoodPreviewObjectURL = null;
	let lastGoodOutputName = null; // keeps downloads in sync with the last-good generated files

	// Capture all values that define the Active NFT so Cancel and generation errors
	// can restore one coherent marker set rather than mixing files from two runs.
	function captureActiveNftSnapshot() {

		return {
			iset: window.NFT_Iset,
			fset: window.NFT_Fset,
			fset3: window.NFT_Fset3,
			zft: window.NFT_Zft,
			imageBlob: window.NFT_ImageBlob,
			dpi: window.NFT_Dpi,
			previewUrl: previewObjectURL,
			outputName: lastGoodOutputName
		};

	}

	// Keep the Active tab's image and displayed name synchronized with its restored data.
	function showActiveNftSnapshot( snapshot ) {

		if ( snapshot && snapshot.previewUrl ) {

			previewObjectURL = snapshot.previewUrl;
			activePreviewImg.src = previewObjectURL;
			activeImageNameText.setValue( snapshot.outputName || 'Generated NFT' );

		} else {

			showDefaultNftMarkerPreview();

		}

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
		setGenerateButtonState( false );
		setButtonVisibility( generateBtn, false );
		setButtonVisibility( cancelBtn, false );

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

		// Clear the active NFT dataset globals so publish/download code paths fall back to the
		// default packaged marker files instead of any previously generated custom set.
		window.NFT_Iset = null;
		window.NFT_Fset = null;
		window.NFT_Fset3 = null;
		window.NFT_Zft = null;
		window.NFT_ImageBlob = null;
		window.NFT_Dpi = null;

		lastGoodIset = null;
		lastGoodFset = null;
		lastGoodFset3 = null;
		lastGoodZft = null;
		lastGoodImageBlob = null;
		lastGoodDpi = null;
		lastGoodOutputName = null;
		editor.signals.nftMarkerChanged.dispatch();

		if ( previewObjectURL ) {
			URL.revokeObjectURL( previewObjectURL );
			previewObjectURL = null;
		}

		if ( lastGoodPreviewObjectURL ) {
			URL.revokeObjectURL( lastGoodPreviewObjectURL );
			lastGoodPreviewObjectURL = null;
		}

		clearPendingNftImage();
		generationStarted = false;
		stagedPreviousSnapshot = null;

		showDefaultNftMarkerPreview();
		imageTabs.select( 'nft-active-image' );

		statusText.setValue( 'Reset to default NFT marker. Export now uses the built-in default until a new marker is generated.' );

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

		statusText.setValue( 'Ready to generate.' );        // optional, keeps the main status sane
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

		refreshDownloadUiState();

		// Store it so Cancel can restore (even if user hasn’t generated anything new yet)
		// If there's no trio, snapshot still matters because preview might exist.
		


	});

	// ---------------------------------------------------------
	// Generate NFT dataset
	// ---------------------------------------------------------

	generateBtn.onClick(async () => {

		if ( !loadedImage || isGenerating ) return;

		generationStarted = true;
		setButtonVisibility(cancelBtn, false);
		isGenerating = true;
		refreshDownloadUiState();

		// Generated files stay local throughout processing. The window globals continue
		// to expose the previous Active NFT until the complete result is ready to promote.
		const rollbackSnapshot = captureActiveNftSnapshot();
		let generatedIset = null;
		let generatedFset = null;
		let generatedFset3 = null;
		let generatedZft = null;

		statusText.setValue('Generating NFT marker… This can take up to ten minutes');
		setGenerationIndicatorVisible( true ); //Spinner on
		setGenerateButtonState( false );
		setButtonVisibility(cancelBtn, false);


		try {

			// Wait for WASM runtime
			//const module = await waitForNftModule();


			// Replace "Wait for WASM runtime" to get module instance via ESM loader instead
			const module = await getNftModule();

			// Helper: safely read a file from the Emscripten FS without throwing.
			function tryRead( path ) {
				try {
					return module.FS.readFile( path );
				} catch ( error ) {
					return null;
				}
			}


			// start debug controls: debug what the wasm module actually exports
			//console.log('[NFT] Module keys:', Object.keys(module));
			//console.log('[NFT] typeof createImageSet:', typeof module.createImageSet);
			//console.log('[NFT] typeof ccall:', typeof module.ccall);
			//console.log('[NFT] typeof cwrap:', typeof module.cwrap);
			// end debug controls



			const imgData = await imageToImageData(loadedImage);

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

			
			// Ensure a known output directory exists in MEMFS
			// const outputDir = '/output'; // no longer used — generator writes to module FS cwd, keep outputBasePath as base filename
			
			// The generator will append extensions, so outputBasePath must be a plain base filename.
			// Use already-sanitized output name for internal WASM generation
			const outputBasePath = outputName;
			//const outputBasePath = "generatedMarker"; //outputName;
			//const outputBasePath = sanitizeOutputName(settings.outputName);

			const paramStr =
                `0 ${outputBasePath}` +
                ` -dpi=${options.dpi}` +
                ` -level=${options.level}` +
                ` -leveli=${options.leveli}` +
                ` -sd_thresh=${options.sd_thresh}` +
                ` -max_thresh=${options.max_thresh}` +
                ` -min_thresh=${options.min_thresh}` +
                ` -feature_density=${options.feature_density}` +
                ( options.zft ? ' -zft' : '' );

			console.log("NFT base name:", outputBasePath);
			console.log("NFT param string:", paramStr);

			if ( typeof module._createImageSet !== 'function' ) {
				throw new Error('[NFT] _createImageSet is not exported by this build.');
			}

			// --- Allocate + copy param string into WASM memory (C string) ---
			let paramPtr = null;
			let heapPtr = null;

			try {

				console.log("FINAL PARAM STRING:", paramStr); //test code
				// Allocate + copy param string into WASM memory (matches the working example)
				paramPtr = module._malloc( paramStr.length + 1 );

				if ( typeof module.writeStringToMemory !== 'function' ) {
					throw new Error('[NFT] writeStringToMemory is not available on this Emscripten build.');
				}

				module.writeStringToMemory( paramStr, paramPtr );


				// Convert RGBA -> RGB to match channels=3
				const rgba = imgData.data;
				const rgb = new Uint8Array( imgData.width * imgData.height * 3 );

				for ( let i = 0, j = 0; i < rgba.length; i += 4 ) {
					rgb[ j++ ] = rgba[ i ];
					rgb[ j++ ] = rgba[ i + 1 ];
					rgb[ j++ ] = rgba[ i + 2 ];
				}

				heapPtr = module._malloc( rgb.length );
				module.HEAPU8.set( rgb, heapPtr );

				// Run generator
				
				// Run generator for the standard three-file dataset (.iset/.fset/.fset3)
				module._createImageSet(
					heapPtr,
					options.dpi,
					imgData.width,
					imgData.height,
					3,
					paramPtr
				);

				// Give the Emscripten in-memory file system time to finish writing generated files
				// before attempting to read them from JavaScript.
				//await new Promise( ( resolve ) => setTimeout( resolve, 300 ) ); // duplicate delay removed here — keep the post-generator delay and debug listing below

				// Debug: list the current working directory contents.
				// We previously changed into /output, so '.' reflects the actual output files.

				// Give FS time to flush like the working example
				await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );

				// --- debug + robust read attempt ---
				try {
					// wait a short moment for FS to flush (keeps the working behaviour from the example)
					//await new Promise((resolve) => setTimeout(resolve, 300));

					// Basic diagnostics
					const cwd = module.FS.cwd();
					console.log('[NFT] FS cwd:', cwd);

					// List cwd and root for diagnosis
					let cwdListing = [];
					let rootListing = [];
					try { cwdListing = module.FS.readdir('.'); } catch (e) { console.warn('[NFT] readdir(.) failed', e); }
					try { rootListing = module.FS.readdir('/'); } catch (e) { console.warn('[NFT] readdir(/) failed', e); }

					console.log('[NFT] FS cwd contents:', cwdListing);
					console.log('[NFT] FS / contents:', rootListing);

					// Log expected base so logs are clearer
					console.log('[NFT] expecting base:', outputBasePath);

					

					// Candidate paths in order of preference
					const candidates = [
						`${outputBasePath}.iset`,
						`./${outputBasePath}.iset`,
						`/${outputBasePath}.iset`,
						`/output/${outputBasePath}.iset`,
						`/tmp/${outputBasePath}.iset`
					];

					let foundIset = null, foundFset = null, foundFset3 = null;

					// First try the exact output paths we expect the module to use for this run.
					// This is the fast path when the tool writes files exactly where we asked it to.
					for (const p of candidates) {
						if (!foundIset) foundIset = tryRead(p);
						if (!foundFset) foundFset = tryRead(p.replace('.iset', '.fset'));
						if (!foundFset3) foundFset3 = tryRead(p.replace('.iset', '.fset3'));
						if (foundIset && foundFset && foundFset3) break;
					}

					// Some builds write to a different in-memory directory than expected, so fall back
					// to scanning a few likely locations before treating the run as failed.
					if ( !( foundIset && foundFset && foundFset3 ) ) {

						const scanDirs = [ '.', '/', '/output', '/tmp' ];

						for ( const dir of scanDirs ) {

							let list = [];
							try { list = module.FS.readdir( dir ); } catch ( e ) { continue; }

							const baseDir = ( dir === '.' ) ? '.' : dir.replace( /\/$/, '' );

							for ( const entry of list ) {

								const fullPath = ( baseDir === '.' ) ? `./${entry}` : `${baseDir}/${entry}`;

								if ( entry.endsWith( '.iset' ) && !foundIset ) { foundIset = tryRead( fullPath ); }
								if ( entry.endsWith( '.fset' ) && !foundFset ) { foundFset = tryRead( fullPath ); }
								if ( entry.endsWith( '.fset3' ) && !foundFset3 ) { foundFset3 = tryRead( fullPath ); }

								if ( foundIset && foundFset && foundFset3 ) break;

							}

							if ( foundIset && foundFset && foundFset3 ) break;

						}

					}


					if (!foundIset || !foundFset || !foundFset3) {
						console.error('[NFT] Could not locate generated NFT files. Diagnostics follow.');
						console.error('[NFT] cwd:', cwd);
						console.error('[NFT] cwd contents:', cwdListing);
						console.error('[NFT] / contents:', rootListing);
						throw new Error('[NFT] Generated files not found in module FS (look above for listings).');
					}

					// Stage the required trio locally instead of publishing a partial result through
					// the globals consumed by download, viewport, and export code.
					generatedIset = foundIset;
					generatedFset = foundFset;
					generatedFset3 = foundFset3;

					// The optional .zft file only exists when the user asked for it, so treat it as
					// a best-effort companion file rather than part of the required trio.

					if ( options.zft ) {

						const zftCandidates = [
							`${outputBasePath}.zft`,
							`./${outputBasePath}.zft`,
							`/${outputBasePath}.zft`,
							`/output/${outputBasePath}.zft`,
							`/tmp/${outputBasePath}.zft`
						];

						for ( const candidatePath of zftCandidates ) {

							const zftFile = tryRead( candidatePath );

							if ( zftFile ) {
								generatedZft = zftFile;
								break;
							}

						}

					} //end ZFT creation/export

					// === DEBUG: Verify dataset integrity ===
					console.log("=== NFT DATASET DEBUG ===");

					console.log("Iset instanceof Uint8Array:", generatedIset instanceof Uint8Array);
					console.log("Fset instanceof Uint8Array:", generatedFset instanceof Uint8Array);
					console.log("Fset3 instanceof Uint8Array:", generatedFset3 instanceof Uint8Array);

					console.log("Iset length:", generatedIset?.length);
					console.log("Fset length:", generatedFset?.length);
					console.log("Fset3 length:", generatedFset3?.length);

					try {
						const statIset = module.FS.stat(`${outputBasePath}.iset`);
						const statFset = module.FS.stat(`${outputBasePath}.fset`);
						const statFset3 = module.FS.stat(`${outputBasePath}.fset3`);

						console.log("FS stat iset size:", statIset.size);
						console.log("FS stat fset size:", statFset.size);
						console.log("FS stat fset3 size:", statFset3.size);
					} catch (e) {
						console.warn("FS stat failed:", e);
					}

					console.log("=== END NFT DATASET DEBUG ===");


				} catch (error) {
					console.error('[NFT] Read/locate block error:', error);
					throw error;
				}
			} finally {

				if ( paramPtr !== null ) module._free( paramPtr );
				if ( heapPtr !== null ) module._free( heapPtr );

				// We are no longer changing the module's working directory in this code-path,
				// so there is nothing to restore here. If  module.FS.chdir(...) is reintroduced later,
				//  previousWorkingDirectory must be captured first.
			}



			// Build a PNG preview from the uploaded image so the sidebar, publish flow, and download
			// behavior all reference the same user-visible marker image for this generated dataset.
			const canvas = document.createElement('canvas');
			canvas.width = imgData.width;
			canvas.height = imgData.height;

			const ctx = canvas.getContext('2d');
			ctx.putImageData( imgData, 0, 0 );

			const generatedImageBlob = await new Promise( ( resolve, reject ) => {
				canvas.toBlob( ( blob ) => {
					if ( blob ) resolve( blob );
					else reject( new Error( '[NFT] canvas.toBlob returned null.' ) );
				}, 'image/png' );
			} );

			//=======================================
			//End the Run WASM Generator section
			//=======================================

			// Promotion boundary: every required dataset file and the PNG preview now exist.
			// Assign the full result together so all consumers switch to the same marker run.
			window.NFT_Iset = generatedIset;
			window.NFT_Fset = generatedFset;
			window.NFT_Fset3 = generatedFset3;
			window.NFT_Zft = generatedZft;
			window.NFT_ImageBlob = generatedImageBlob;
			window.NFT_Dpi = options.dpi;

			if ( previewObjectURL ) {
				URL.revokeObjectURL( previewObjectURL );
			}

			// Update the Active tab only after the generated globals have been promoted.
			previewObjectURL = URL.createObjectURL( generatedImageBlob );
			activePreviewImg.src = previewObjectURL;
			activeImageNameText.setValue( outputName );

			// Persist this successful run as the new "last good" state. Later uploads can be canceled
			// back to this marker set, and download/export should continue to use it until replaced.
			lastGoodIset = generatedIset;
			lastGoodFset = generatedFset;
			lastGoodFset3 = generatedFset3;
			lastGoodZft = generatedZft;
			lastGoodImageBlob = generatedImageBlob;
			lastGoodDpi = options.dpi;
			lastGoodOutputName = outputName;
			editor.signals.nftMarkerChanged.dispatch();

			lastGoodPreviewObjectURL = previewObjectURL;

			//Status Text's Success Message:
			statusText.setValue( 'NFT marker generated successfully. It is now the active marker for the viewport, downloads, and exports.' );


			setGenerationIndicatorVisible( false ); //Spinner off
			
			generationStarted = false;
			stagedPreviousSnapshot = null;
			// The processed image is no longer pending; return the user to its Active preview.
			clearPendingNftImage();
			imageTabs.select( 'nft-active-image' );

			
		} catch (err) {

			console.error(err);
			statusText.setValue( 'Generation failed. The active NFT was preserved and the pending image is available to retry.' );

			setGenerationIndicatorVisible( false ); //Errored out -- turn spinner off.

			//Disable the download button so the user doesn't download broken files:
			//setDownloadButtonState( false ); //downloadBtn.setDisabled(true); //replaced by relaoding hte snapshot
			// A failed generation should not leave the editor in a half-generated state.
			// Restore the snapshot from before this run, keep Pending available for retry,
			// and leave publish/download connected to the previous Active NFT.
			if ( rollbackSnapshot ) {
				applySnapshotToWindow( rollbackSnapshot );
				showActiveNftSnapshot( rollbackSnapshot );

			}

			generationStarted = false;
			setButtonVisibility( generateBtn, !!loadedImage );
			setButtonVisibility( cancelBtn, !!loadedImage && stagedPreviousSnapshot !== null );
			imageTabs.select( 'nft-pending-image' );

		} finally {

			// Always unlock the Generate button once this run finishes
			isGenerating = false;

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

			statusText.setValue( 'Downloaded default NFT marker files and image.' );
			refreshDownloadUiState();
		} catch ( error ) {
			console.error( error );
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
