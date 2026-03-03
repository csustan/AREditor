
/*
// Ensure Emscripten resolves the .wasm from the correct folder (prevents doubled paths)
globalThis.Module = globalThis.Module || {};
globalThis.Module.locateFile = ( path, prefix ) => {
	if ( path.endsWith( '.wasm' ) ) return '/editor/js/libs/nft/' + path;
	return prefix + path;
};
*/

// start module imports: basics and the NFT marker creator ESM import

import { UISpan, UIRow, UIText, UIButton, UIInput, UIHorizontalRule } from './libs/ui.js';
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

	// Title -----------------------------------------------------

	const header = new UIText( 'NFT Marker Generator' );
	header.setFontSize( '14px' );
	header.setMarginBottom( '8px' );
	header.dom.style.display = 'block'; // ensures the next text does not sit on the same line
	content.add( header );


	// File input -----------------------------------------------------

	// Line 1: status text (above the chooser)
	const fileStatusText = new UIText( 'No image loaded.' );
	fileStatusText.setColor( '#888' );
	fileStatusText.setMarginBottom( '6px' );
	fileStatusText.dom.style.display = 'block';
	content.add( fileStatusText );

	// preview image to be shown above the Choose File button
	const previewImg = document.createElement('img');
	previewImg.style.maxWidth = '100%';
	previewImg.style.display = 'none';
	previewImg.style.marginBottom = '8px'; // space before the button
	// don't run fileSection.dom.appendChild(previewImg); here, run it after
	//the fileSection has been created
	// end preview image


	// Line 2: Image label, then a "Choose File" button row, then a filename row
	const fileSection = new UISpan();
	fileSection.dom.style.display = 'block';
	fileSection.dom.style.marginBottom = '8px';

	// "Image" label
	const imageLabel = new UIText( 'Image' );
	imageLabel.dom.style.display = 'block';
	imageLabel.dom.style.marginBottom = '6px';
	fileSection.add( imageLabel );

	// Row: Choose File button
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
	fileSection.add( chooseFileRow );

	//add the preview image;
	// this will be placed just after the label and before the Choose File row
	fileSection.dom.insertBefore(previewImg, chooseFileRow.dom);


	// Row: filename text (second line)
	const chosenFileNameText = new UIText( 'No file chosen' );
	chosenFileNameText.setColor( '#888' );
	chosenFileNameText.dom.style.display = 'block';
	fileSection.add( chosenFileNameText );

	content.add( fileSection );

	// End File input -----------------------------------------------------


	// Status text -----------------------------------------------------

	const statusText = new UIText( 'Load an image to begin.' );
	statusText.setColor( '#888' );
	statusText.setMarginBottom( '8px' );
	statusText.dom.style.display = 'block'; // prevents joining with other inline elements
	content.add( statusText );

	//Download Button show Generate button directly under the main status text
	const generateBtn = new UIButton( 'Generate NFT Marker' );
	generateBtn.setMarginBottom( '10px' );
	content.add( generateBtn );
	// end Download Button

	//Start Generate Button Helper
	function setGenerateButtonState( enabled ) {

		// Disable state
		generateBtn.setDisabled( !enabled );

		// Visual feedback (optional but nice)
		generateBtn.dom.style.opacity = enabled ? '1' : '0.5';
		generateBtn.dom.style.pointerEvents = enabled ? 'auto' : 'none';

		// Tooltip hint (optional)
		generateBtn.dom.title = enabled ? 'Generate NFT marker files' : 'Generation is running...';
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

	const cancelBtn = new UIButton( 'Cancel' );
	cancelBtn.setMarginBottom( '10px' );

	content.add( downloadBtn );
	content.add( cancelBtn );
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
	zftWrap.appendChild(zftCheckbox);
	zftWrap.appendChild(zftLabel);

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
	function addNumberSettingRow( labelText, defaultValue, widthPx ) {

		const row = new UIRow();
		row.setMarginBottom('8px');

		const input = new UIInput().setWidth( widthPx || '120px' );
		input.setValue( String( defaultValue ) );

		row.add( new UIText( labelText ).setWidth( '110px' ) );
		row.add( input );

		content.add( row );

		return input;
	}
	// end addNumberSettingRow functions


	const dpiInput = addNumberSettingRow('dpi', 72, '120px');
	const levelInput = addNumberSettingRow('level', 2, '120px');
	const leveliInput = addNumberSettingRow('leveli', 1, '120px');
	const sdThreshInput = addNumberSettingRow('sd_thresh', 8, '120px');
	const maxThreshInput = addNumberSettingRow('max_thresh', 0.9, '120px');
	const minThreshInput = addNumberSettingRow('min_thresh', 0.55, '120px');
	const featureDensityInput = addNumberSettingRow('feature_density', 70, '120px');
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
		let previousPreviewSrc = null;         // to restore when Cancel used
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
				? 'Download generated NFT marker files'
				: 'Generate a marker first';
		}

		//Create a helper function to control the Cancel Button's enable/disable state
		//As well as its visual stylings
		cancelBtn.onClick(() => {

		// If we have a staged snapshot (state before the user selected the new image), restore it
		if ( stagedPreviousSnapshot ) {

			// Restore staged snapshot (pre-upload state)
			applySnapshotToWindow( stagedPreviousSnapshot );

			if ( stagedPreviousSnapshot.previewUrl ) {
				previewObjectURL = stagedPreviousSnapshot.previewUrl;
				previewImg.src = previewObjectURL;
				previewImg.style.display = 'block';
			} else if ( previousPreviewSrc ) {
				previewImg.src = previousPreviewSrc;
				previewImg.style.display = 'block';
			} else {
				previewImg.src = '';
				previewImg.style.display = 'none';
			}

		} else if ( lastGoodIset && lastGoodFset && lastGoodFset3 ) {

			// NEW: Restore last successful generation
			window.NFT_Iset  = lastGoodIset;
			window.NFT_Fset  = lastGoodFset;
			window.NFT_Fset3 = lastGoodFset3;
			window.NFT_Zft = lastGoodZft; // Restore the optional zft file if it existed for the last successful generation.
			// Keep download naming in sync with the restored files:
			window.NFT_ImageBlob = lastGoodImageBlob; // Even though lastGoodOutputName is already used by downloadBtn.

			// Restore preview from last good generation
			if ( lastGoodPreviewObjectURL ) {
				previewObjectURL = lastGoodPreviewObjectURL;
				previewImg.src = previewObjectURL;
				previewImg.style.display = 'block';
			} else {
				previewImg.src = '';
				previewImg.style.display = 'none';
			}

			// Download should be enabled again
			setDownloadButtonState( true );

		} else {

			// No previous state at all — clear everything
			window.NFT_Iset = null;
			window.NFT_Fset = null;
			window.NFT_Fset3 = null;
			window.NFT_Zft = null;
			window.NFT_ImageBlob = null;

			setDownloadButtonState( false );

			previewImg.src = '';
			previewImg.style.display = 'none';
		}


		// Clear staged upload (go back to previous)
		loadedImage = null;

		// The user canceled this upload, so release the uploaded image blob URL.
		if ( uploadedImageObjectURL ) {
			URL.revokeObjectURL( uploadedImageObjectURL );
			uploadedImageObjectURL = null;
		}

		try { fileInput.dom.value = ''; } catch (e) {}

		// Hide generate/cancel
		setGenerateButtonState( false );
		setButtonVisibility(cancelBtn, false);

		// Clear staged snapshot so repeated cancel doesn't do weird things
		stagedPreviousSnapshot = null;

		fileStatusText.setValue('No image loaded.');
		chosenFileNameText.setValue( 'No file chosen' );
		chosenFileNameText.setColor( '#888' );

		statusText.setValue('Upload canceled.');
		generationStarted = false;

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

				setDownloadButtonState( hasDownloadableNftOutput() );

			}



	// Initial UI state:
	//setDownloadButtonState(false);
	//setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );
	setDownloadButtonState( hasDownloadableNftOutput() );
	setButtonVisibility(downloadBtn, true); // always visible per your hint
	setButtonVisibility(cancelBtn, false);  // hidden until image loaded and generation not started
	setButtonVisibility(generateBtn, false); // hidden until image loaded

	//Insert buttons
	//content.add(downloadBtn);
	//content.add(cancelBtn);
		


	// Preview <img> ----------------------------------------------------
	// moved to the top of the controls
	//const previewImg = document.createElement('img');
	//previewImg.style.maxWidth = '100%';
	//previewImg.style.display = 'none';
	//previewImg.style.marginTop = '10px';
	//container.dom.appendChild(previewImg);

	// Internal state
	let loadedImage = null;
	let previewObjectURL = null;
	// Tracks the blob URL created for the currently uploaded image so we can revoke it safely.
	let uploadedImageObjectURL = null;

	// Snapshot of last successful generation (for Cancel + Download sync)
	let lastGoodIset = null;
	let lastGoodFset = null;
	let lastGoodFset3 = null;
	let lastGoodImageBlob = null;
	let lastGoodZft = null;
	let lastGoodPreviewObjectURL = null;
	let lastGoodOutputName = null; // keeps downloads in sync with the last-good generated files


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


		fileStatusText.setValue( `Loaded: ${file.name}` ); // this is the line above the chooser
		chosenFileNameText.setValue( file.name );
		chosenFileNameText.setColor( '#bbb' );

		statusText.setValue( 'Ready to generate.' );        // optional, keeps the main status sane
		previousPreviewSrc = previewImg.src || null; // remember whatever the user was seeing before this upload
		previewImg.src = loadedImage.src;
		previewImg.style.display = 'block';

				// Snapshot of the current "downloadable state" so Cancel can restore to it
		const previousSnapshot = {
			iset: window.NFT_Iset,
			fset: window.NFT_Fset,
			fset3: window.NFT_Fset3,
			zft: window.NFT_Zft,
			imageBlob: window.NFT_ImageBlob,
			previewUrl: previewObjectURL // may be null if we’re just showing an uploaded image
		};

		// IMPORTANT: assign to the OUTER variable (do not redeclare with "let")
		stagedPreviousSnapshot = previousSnapshot;

		// We have an uploaded image: show Generate, and show Cancel (since generation not started yet)
		generationStarted = false;
		setButtonVisibility(generateBtn, true);
		setButtonVisibility(cancelBtn, true);

		// Download remains enabled if a trio exists from last successful run
		//setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );
		setDownloadButtonState( hasDownloadableNftOutput() );

		// Store it so Cancel can restore (even if user hasn’t generated anything new yet)
		// If there's no trio, snapshot still matters because preview might exist.
		


	});

	// ---------------------------------------------------------
	// Generate NFT dataset
	// ---------------------------------------------------------

	generateBtn.onClick(async () => {

		generationStarted = true;
		setButtonVisibility(cancelBtn, false);

		// Prevent double-click from starting a second generation run
		if ( isGenerating ) {
			return;
		}
		isGenerating = true;


		// Keep a rollback snapshot in case generation fails
		const rollbackSnapshot = {
			iset: window.NFT_Iset,
			fset: window.NFT_Fset,
			fset3: window.NFT_Fset3,
			zft: window.NFT_Zft,
			imageBlob: window.NFT_ImageBlob,
			previewUrl: previewObjectURL
		};

		setDownloadButtonState( false ); // generation in progress; prevent downloading partial/stale data
		//setDownloadButtonState( false ); //downloadBtn.setDisabled(true); //make sure that the files can't be downloaded until the generation is complete.
		

		// Clear previous results so export cannot use stale data
		window.NFT_Iset = null;
		window.NFT_Fset = null;
		window.NFT_Fset3 = null;
		window.NFT_Zft = null;
		window.NFT_ImageBlob = null;

		if ( !loadedImage ) {
			statusText.setValue('Please load an image first.');
			return;
		}

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
							` -feature_density=${options.feature_density}`;

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

					// Try the candidate paths directly first
					for (const p of candidates) {
						if (!foundIset) foundIset = tryRead(p);
						if (!foundFset) foundFset = tryRead(p.replace('.iset', '.fset'));
						if (!foundFset3) foundFset3 = tryRead(p.replace('.iset', '.fset3'));
						if (foundIset && foundFset && foundFset3) break;
					}

					// If not found yet, scan common directories for any .iset/.fset/.fset3
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

					// Assign the located buffers to the globals
					window.NFT_Iset  = foundIset;
					window.NFT_Fset  = foundFset;
					window.NFT_Fset3 = foundFset3;

					// === DEBUG: Verify dataset integrity ===
					console.log("=== NFT DATASET DEBUG ===");

					console.log("Iset instanceof Uint8Array:", window.NFT_Iset instanceof Uint8Array);
					console.log("Fset instanceof Uint8Array:", window.NFT_Fset instanceof Uint8Array);
					console.log("Fset3 instanceof Uint8Array:", window.NFT_Fset3 instanceof Uint8Array);

					console.log("Iset length:", window.NFT_Iset?.length);
					console.log("Fset length:", window.NFT_Fset?.length);
					console.log("Fset3 length:", window.NFT_Fset3?.length);

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



				// Optional: generate the zft file as a second pass so we keep the trio as well.
				window.NFT_Zft = null;

				if ( options.zft && true && false ) {

					// Use a different base path so the second run cannot interfere with the trio file names.
					const zftOutputBasePath = `${outputBasePath}_zft`;

					const paramStrForZft =
						`0 ${zftOutputBasePath}` +
						` -dpi=${options.dpi}` +
						` -level=${options.level}` +
						` -leveli=${options.leveli}` +
						` -sd_thresh=${options.sd_thresh}` +
						` -max_thresh=${options.max_thresh}` +
						` -min_thresh=${options.min_thresh}` +
						` -feature_density=${options.feature_density}` +
						' -zft';

					// Allocate and write the second parameter string into WASM memory
					const paramPtrForZft = module._malloc( paramStrForZft.length + 1 );
					try {

						module.writeStringToMemory( paramStrForZft, paramPtrForZft );

						// Run generator again to produce the zft file
						module._createImageSet(
							heapPtr,
							options.dpi,
							imgData.width,
							imgData.height,
							3,
							paramPtrForZft
						);

						// Give the Emscripten in-memory file system time to finish writing generated files
						// before attempting to read them from JavaScript.
						await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );

						// Debug: list the current working directory and its contents.
						// We chdir'd into /output earlier, so '.' should show the generated files.
						// Also attempt to list /output explicitly in case cwd wasn't changed as expected.
						try {
							console.log('[NFT] FS cwd:', module.FS.cwd());
							console.log('[NFT] FS cwd contents:', module.FS.readdir('.'));
						} catch (e) {
							console.warn('[NFT] Unable to list current working directory contents.', e);
						}

						try {
							console.log('[NFT] FS /output listing attempt:', module.FS.readdir('/output'));
						} catch (e) {
							// Not fatal — just log for diagnosis
							console.warn('[NFT] Unable to list /output directory (may not exist yet or cwd differs).', e);
						}


						// zft output (additive)
						//window.NFT_Zft = module.FS.readFile( `${zftOutputBasePath}.zft` );
						// Try to read zft from common locations without throwing errors
						window.NFT_Zft =
							tryRead( `${zftOutputBasePath}.zft` ) ||
							tryRead( `./${zftOutputBasePath}.zft` ) ||
							tryRead( `/${zftOutputBasePath}.zft` ) ||
							tryRead( `/output/${zftOutputBasePath}.zft` ) ||
							tryRead( `/tmp/${zftOutputBasePath}.zft` );


					} finally {

						module._free( paramPtrForZft );

					}

				}// This closes: if ( options.zft ) { ... }



			} finally {

				if ( paramPtr !== null ) module._free( paramPtr );
				if ( heapPtr !== null ) module._free( heapPtr );

				// We are no longer changing the module's working directory in this code-path,
				// so there is nothing to restore here. If  module.FS.chdir(...) is reintroduced later,
				//  previousWorkingDirectory must be captured first.
			}



			// PNG preview
			const canvas = document.createElement('canvas');
			canvas.width = imgData.width;
			canvas.height = imgData.height;

			const ctx = canvas.getContext('2d');
			ctx.putImageData( imgData, 0, 0 );

			//window.NFT_ImageBlob = await new Promise( ( resolve ) => canvas.toBlob( resolve, 'image/png' ) );
			//Handle Nulls
			window.NFT_ImageBlob = await new Promise( ( resolve, reject ) => {
				canvas.toBlob( ( blob ) => {
					if ( blob ) resolve( blob );
					else reject( new Error( '[NFT] canvas.toBlob returned null.' ) );
				}, 'image/png' );
			} );

			//=======================================
			//End the Run WASM Generator section
			//=======================================
			
			// Update preview image and avoid memory leaks
			if ( previewObjectURL ) {
				URL.revokeObjectURL( previewObjectURL );
			}

			previewObjectURL = URL.createObjectURL( window.NFT_ImageBlob );
			previewImg.src = previewObjectURL;
			previewImg.style.display = 'block';

			//Before alerting the user that the process is done, Save this as the 
			// "last good" snapshot so Cancel can restore to it later if the user desires
			lastGoodIset = window.NFT_Iset;
			lastGoodFset = window.NFT_Fset;
			lastGoodFset3 = window.NFT_Fset3;
			lastGoodZft = window.NFT_Zft;
			lastGoodImageBlob = window.NFT_ImageBlob;
			lastGoodOutputName = outputName;

			// Also preserve the preview URL we just created
			if ( lastGoodPreviewObjectURL ) {
				URL.revokeObjectURL( lastGoodPreviewObjectURL );
			}
			lastGoodPreviewObjectURL = previewObjectURL;

			//Status Text's Success Message:
			statusText.setValue(
			"NFT Marker Generation Successful." +
			"Exporting the AR Natural Feature" + 
			"Tracker App will now use these NFT" + 
			"Files. You can also save the new NFT" +
			"Marker Files via the Download button." +
			"You can adjust the settings and "  +
			"generate a new marker set at anytime."
			);


			setGenerationIndicatorVisible( false ); //Spinner off
			
			generationStarted = false;
			setDownloadButtonState( hasDownloadableNftOutput() );
			// Allow the user to regenerate with updated settings without re-uploading the image.
			setButtonVisibility( generateBtn, true );

			// Once the marker generation succeeds, "Cancel" isn't needed (unless a new upload is staged).
			setButtonVisibility( cancelBtn, false );

			// Clear any staged snapshot because we are now in a "stable" generated state.
			stagedPreviousSnapshot = null;

			
		} catch (err) {

			console.error(err);
			statusText.setValue('Error: see console.');

			setGenerationIndicatorVisible( false ); //Errored out -- turn spinner off.

			//Disable the download button so the user doesn't download broken files:
			//setDownloadButtonState( false ); //downloadBtn.setDisabled(true); //replaced by relaoding hte snapshot
			// Restore last known-good state so Download/export stay valid
			if ( rollbackSnapshot ) {
				applySnapshotToWindow( rollbackSnapshot );

				if ( rollbackSnapshot.previewUrl ) {
					previewObjectURL = rollbackSnapshot.previewUrl;
					previewImg.src = previewObjectURL;
					previewImg.style.display = 'block';
				}

				// Keep download naming in sync with restored "last good" files
				if ( lastGoodOutputName ) {
					// nothing else needed here as downloadBtn uses lastGoodOutputName
				}

			}

			setButtonVisibility(generateBtn, !!loadedImage);

			// If there's still a staged upload and generation is no longer running, allow Cancel.
			setButtonVisibility(cancelBtn, !!loadedImage && stagedPreviousSnapshot !== null && generationStarted === false);

			generationStarted = false;

		} finally {

			// Always unlock the Generate button once this run finishes
			isGenerating = false;

			// Re-enable Generate only if an image is still loaded
			setGenerateButtonState( !!loadedImage );

		}

	});

	// ---------------------------------------------------------
	// Download the generated NFT Marker Files
	// ---------------------------------------------------------
	downloadBtn.onClick( () => {

		const hasStandardTrioOutput =
		!!window.NFT_Iset &&
		!!window.NFT_Fset &&
		!!window.NFT_Fset3;

		if ( !hasStandardTrioOutput ) {
			alert( 'No generated NFT marker files are available yet.' );
			return;
		}

		const baseName =
			( typeof lastGoodOutputName === 'string' && lastGoodOutputName.trim() )
				? lastGoodOutputName.trim()
				: 'generatedMarkerFile';

		// Always download the standard three-file dataset
		const filesToDownload = [
			{ data: window.NFT_Iset,  ext: '.iset' },
			{ data: window.NFT_Fset,  ext: '.fset' },
			{ data: window.NFT_Fset3, ext: '.fset3' }
		];

		// Also download zft when present
		if ( window.NFT_Zft ) {
			filesToDownload.push( { data: window.NFT_Zft, ext: '.zft' } );
		}	

		filesToDownload.forEach( ( { data, ext } ) => {

			const blob = new Blob( [ data ], { type: 'application/octet-stream' } );
			const url = URL.createObjectURL( blob );

			const downloadLinkElement = document.createElement( 'a' );
			downloadLinkElement.href = url;
			downloadLinkElement.download = baseName + ext;
			downloadLinkElement.style.display = 'none';

			document.body.appendChild( downloadLinkElement );
			downloadLinkElement.click();
			downloadLinkElement.remove();

			URL.revokeObjectURL( url );

		} );

	} );



	// ---------------------------------------------------------
	// Utilities
	// ---------------------------------------------------------

	function readImageFile( file ) {
		return new Promise( ( resolve, reject ) => {

			const img = new Image();

			// Create a blob URL so the browser can load the file into an <img>.
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