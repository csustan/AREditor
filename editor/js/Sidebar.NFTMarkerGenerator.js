
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

	const container = new UISpan();

	// Title -----------------------------------------------------

	const header = new UIText('NFT Marker Generator');
	header.setFontSize('14px');
	header.setMarginBottom('8px');
	container.add(header);

	// File input -----------------------------------------------------

	const fileRow = new UIRow();
	fileRow.setMarginBottom('8px');

	const fileInput = new UIInput().setWidth('150px');
	fileInput.dom.type = 'file';
	fileInput.dom.accept = 'image/*';

	fileRow.add(new UIText('Image').setWidth('90px'));
	fileRow.add(fileInput);

	container.add(fileRow);

	// Status text -----------------------------------------------------

	const statusText = new UIText('Load an image to begin.');
	statusText.setColor('#888');
	statusText.setMarginBottom('8px');

	container.add(statusText);
	container.add(new UIHorizontalRule());

	// Generate button --------------------------------------------------

	const generateBtn = new UIButton('Generate NFT Marker');
	generateBtn.setMarginBottom('10px');
	container.add(generateBtn);

	// Download button and Cancel Button -----------------------------------------------

		//Button setup
		const downloadBtn = new UIButton('Download the NFT Files'); // Be sure to disable the button until after NFT generation is successful
		downloadBtn.setMarginBottom('10px');

		const cancelBtn = new UIButton('Cancel');
		cancelBtn.setMarginBottom('10px');

		//Button States 
		let generationStarted = false;         // true once "Generate" clicked
		let previousPreviewSrc = null;         // to restore when Cancel used
		let stagedPreviousSnapshot = null; // what Cancel restores while a new upload is staged


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

			// Restore globals (keeps Menubar export + Download in sync)
			applySnapshotToWindow( stagedPreviousSnapshot );

			// Restore preview
			// Restore preview
			if ( stagedPreviousSnapshot.previewUrl ) {

				previewObjectURL = stagedPreviousSnapshot.previewUrl;
				previewImg.src = previewObjectURL;
				previewImg.style.display = 'block';

			} else if ( previousPreviewSrc ) {

				// Restore whatever was showing before the staged upload
				previewImg.src = previousPreviewSrc;
				previewImg.style.display = 'block';

			} else {

				previewImg.src = '';
				previewImg.style.display = 'none';

			}


		} else {
			// No previous state — clear everything
			window.NFT_Iset = null;
			window.NFT_Fset = null;
			window.NFT_Fset3 = null;
			window.NFT_ImageBlob = null;
			//setDownloadButtonState(false);
			setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );

			previewImg.src = '';
			previewImg.style.display = 'none';
		}

		// Clear staged upload (go back to previous)
		loadedImage = null;
		try { fileInput.dom.value = ''; } catch (e) {}

		// Hide generate/cancel
		setButtonVisibility(generateBtn, false);
		setButtonVisibility(cancelBtn, false);

		// Clear staged snapshot so repeated cancel doesn't do weird things
		stagedPreviousSnapshot = null;

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
			function hasNftTrio( iset, fset, fset3 ) {
				return !!iset && !!fset && !!fset3;
			}

			// Helper function: Push a snapshot  of the NFT files and image blob
			// into the window globals (what Menubar.File.js reads)
			function applySnapshotToWindow( snapshot ) {

				window.NFT_Iset = snapshot.iset;
				window.NFT_Fset = snapshot.fset;
				window.NFT_Fset3 = snapshot.fset3;
				window.NFT_ImageBlob = snapshot.imageBlob;

				// the Download button should be avalible when the trio of nft files are avalible
				//setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );
				setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );

			}


	// Initial UI state:
	//setDownloadButtonState(false);
	setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );
	setButtonVisibility(downloadBtn, true); // always visible per your hint
	setButtonVisibility(cancelBtn, false);  // hidden until image loaded and generation not started
	setButtonVisibility(generateBtn, false); // hidden until image loaded

	//Insert buttons
	container.add(downloadBtn);
	container.add(cancelBtn);
		
	


	// Preview <img> ----------------------------------------------------

	const previewImg = document.createElement('img');
	previewImg.style.maxWidth = '100%';
	previewImg.style.display = 'none';
	previewImg.style.marginTop = '10px';

	container.dom.appendChild(previewImg);

	// Internal state
	let loadedImage = null;
	let previewObjectURL = null;

	// Snapshot of last successful generation (for Cancel + Download sync)
	let lastGoodIset = null;
	let lastGoodFset = null;
	let lastGoodFset3 = null;
	let lastGoodImageBlob = null;
	let lastGoodPreviewObjectURL = null;



	// ---------------------------------------------------------
	// Load image event
	// ---------------------------------------------------------

	fileInput.dom.addEventListener('change', async (event) => {

		const file = event.target.files[0];
		if (!file) return;

		loadedImage = await readImageFile(file);

		statusText.setValue(`Loaded: ${file.name}`);
		previousPreviewSrc = previewImg.src || null; // remember whatever the user was seeing before this upload
		previewImg.src = loadedImage.src;
		previewImg.style.display = 'block';

				// Snapshot of the current "downloadable state" so Cancel can restore to it
		const previousSnapshot = {
			iset: window.NFT_Iset,
			fset: window.NFT_Fset,
			fset3: window.NFT_Fset3,
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
		setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );


		// Store it so Cancel can restore (even if user hasn’t generated anything new yet)
		// If there's no trio, snapshot still matters because preview might exist.
		


	});

	// ---------------------------------------------------------
	// Generate NFT dataset
	// ---------------------------------------------------------

	generateBtn.onClick(async () => {

		generationStarted = true;
		setButtonVisibility(cancelBtn, false);

		// Keep a rollback snapshot in case generation fails
		const rollbackSnapshot = {
			iset: window.NFT_Iset,
			fset: window.NFT_Fset,
			fset3: window.NFT_Fset3,
			imageBlob: window.NFT_ImageBlob,
			previewUrl: previewObjectURL
		};

		setDownloadButtonState( false ); // generation in progress; prevent downloading partial/stale data
		//setDownloadButtonState( false ); //downloadBtn.setDisabled(true); //make sure that the files can't be downloaded until the generation is complete.
		

		// Clear previous results so export cannot use stale data
		window.NFT_Iset = null;
		window.NFT_Fset = null;
		window.NFT_Fset3 = null;
		window.NFT_ImageBlob = null;

		if ( !loadedImage ) {
			statusText.setValue('Please load an image first.');
			return;
		}

		statusText.setValue('Generating NFT marker… This can take up to ten minutes');

		setButtonVisibility(generateBtn, false);
		setButtonVisibility(cancelBtn, false);


		try {

			// Wait for WASM runtime
			//const module = await waitForNftModule();


			// Replace "Wait for WASM runtime" to get module instance via ESM loader instead
			const module = await getNftModule();

			// start debug controls: debug what the wasm module actually exports
			//console.log('[NFT] Module keys:', Object.keys(module));
			//console.log('[NFT] typeof createImageSet:', typeof module.createImageSet);
			//console.log('[NFT] typeof ccall:', typeof module.ccall);
			//console.log('[NFT] typeof cwrap:', typeof module.cwrap);
			// end debug controls



			const imgData = await imageToImageData(loadedImage);

			//=======================================
			//Start the Run WASM Generator section
			//=======================================


			const options = {
				zft: false,
				dpi: 72,
				level: 2,
				leveli: 1,
				sd_thresh: 8,
				max_thresh: 0.9,
				min_thresh: 0.55,
				feature_density: 70
			};

			const outputName = 'tempFilename';

			const paramStr =
				`0 ${outputName}` +
				` -dpi=${options.dpi}` +
				` -level=${options.level}` +
				` -leveli=${options.leveli}` +
				` -sd_thresh=${options.sd_thresh}` +
				` -max_thresh=${options.max_thresh}` +
				` -min_thresh=${options.min_thresh}` +
				` -feature_density=${options.feature_density}` +
				( options.zft ? ' -zft' : '' );

			if ( typeof module._createImageSet !== 'function' ) {
				throw new Error('[NFT] _createImageSet is not exported by this build.');
			}

			// --- Allocate + copy param string into WASM memory (C string) ---
			let paramPtr = null;
			let heapPtr = null;

			try {

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
				module._createImageSet(
					heapPtr,
					options.dpi,
					imgData.width,
					imgData.height,
					3,
					paramPtr
				);

				// Give FS time to flush like the https://github.com/webarkit/ARnft example
				await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );

				// Read outputs
				window.NFT_Iset  = module.FS.readFile( `${outputName}.iset` );
				window.NFT_Fset  = module.FS.readFile( `${outputName}.fset` );
				window.NFT_Fset3 = module.FS.readFile( `${outputName}.fset3` );

			} finally {

				if ( paramPtr !== null ) module._free( paramPtr );
				if ( heapPtr !== null ) module._free( heapPtr );

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
			lastGoodImageBlob = window.NFT_ImageBlob;

			// Also preserve the preview URL we just created
			if ( lastGoodPreviewObjectURL ) {
				URL.revokeObjectURL( lastGoodPreviewObjectURL );
			}
			lastGoodPreviewObjectURL = previewObjectURL;


			statusText.setValue( 'NFT marker generated successfully.' );
			generationStarted = false;
			setDownloadButtonState( hasNftTrio( window.NFT_Iset, window.NFT_Fset, window.NFT_Fset3 ) );
			//setDownloadButtonState( true ); //downloadBtn.setDisabled(false); //Allow the user to download the NFT Marker Files
			
			
		} catch (err) {

			console.error(err);
			statusText.setValue('Error: see console.');

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
			}

			setButtonVisibility(generateBtn, !!loadedImage);

			// If there's still a staged upload and generation is no longer running, allow Cancel.
			setButtonVisibility(cancelBtn, !!loadedImage && stagedPreviousSnapshot !== null && generationStarted === false);

			generationStarted = false;

		}

	});

	// ---------------------------------------------------------
	// Download the generated NFT Marker Files
	// ---------------------------------------------------------
	downloadBtn.onClick(() => {

	if ( !window.NFT_Iset || !window.NFT_Fset || !window.NFT_Fset3 ) {
		alert('NFT marker data is not available.');
		return;
	}

	const baseName = 'generatedMarkerFile';

	const files = [
		{ data: window.NFT_Iset,  ext: '.iset' },
		{ data: window.NFT_Fset,  ext: '.fset' },
		{ data: window.NFT_Fset3, ext: '.fset3' }
	];

	files.forEach( ( { data, ext } ) => {

		const blob = new Blob( [ data ], { type: 'application/octet-stream' } );
		const url = URL.createObjectURL( blob );

		const htmlAttributeElement = document.createElement( 'a' );
		htmlAttributeElement.href = url;
		htmlAttributeElement.download = baseName + ext;
		htmlAttributeElement.style.display = 'none';

		document.body.appendChild( htmlAttributeElement );
		htmlAttributeElement.click();
		htmlAttributeElement.remove();

		URL.revokeObjectURL( url );

	} );

});


	// ---------------------------------------------------------
	// Utilities
	// ---------------------------------------------------------

	function readImageFile(file) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = URL.createObjectURL(file);
		});
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
