// Import the editor's small UI wrapper classes. They create normal HTML
// elements while providing chainable methods such as setWidth() and onChange().
import {
	UISpan, UIRow, UIText, UIInput, UISelect, UICheckbox, UIColor, UINumber, UIButton, UIHorizontalRule
} from './libs/ui.js';
import QRCode from '../../src/esmodqrcodegenerator.js';
import {
	QR_CODE_RENDER_SETTING_GROUPS,
	getQRCodeSettingConfigKey,
	getQRCodeRenderSettingValue
} from './QRCodeRenderSettings.js';

// These settings are shared by the sidebar controls and the QR publish command
// for the current editor session.
let trackSpecificQRCode = false;
let qrCodeInfo = '';
let includeQRCodeInPublishedApp = false;
let generatedQRCodeImageDataURL = '';

// Return the value in the format expected by the publish command.
// An empty string tells the exported app to keep its default QR behavior.
function getTrackedQRCodeData() {

	return trackSpecificQRCode ? qrCodeInfo : '';

}

function getQRCodeImageForPublishing() {

	if ( !includeQRCodeInPublishedApp ) return undefined;

	if ( generatedQRCodeImageDataURL === '' ) {

		throw new Error( 'Generate a QR Code before including it in the published app.' );

	}

	const separatorIndex = generatedQRCodeImageDataURL.indexOf( ',' );
	const metadata = generatedQRCodeImageDataURL.slice( 0, separatorIndex );
	const binary = atob( generatedQRCodeImageDataURL.slice( separatorIndex + 1 ) );
	const bytes = new Uint8Array( binary.length );

	for ( let index = 0; index < binary.length; index ++ ) {

		bytes[ index ] = binary.charCodeAt( index );

	}

	const mimeType = metadata.match( /^data:([^;]+)/ )?.[ 1 ] ?? 'image/png';
	return new Blob( [ bytes ], { type: mimeType } );

}

// Build the QR Code Generator panel shown in the editor sidebar.
// Sidebar.js adds the returned UI element as a tab.
function SidebarQRCodeGenerator( editor ) {

	const config = editor?.config ?? window._editor?.config;

	if ( config === undefined ) {

		throw new Error( 'The QR Code Generator requires the editor configuration.' );

	}

	// Create the outer panel. The editor's UI classes are lightweight wrappers
	// around DOM elements, and each wrapper exposes its underlying .dom node.
	const container = new UISpan();
	container.setId( 'sidebar-qr-code-generator' );
	container.setDisplay( 'block' );
	container.setWidth( '100%' );
	container.dom.style.boxSizing = 'border-box';

	const content = new UISpan();
	content.setDisplay( 'block' );
	content.setWidth( '100%' );
	content.setPaddingLeft( '14px' );
	content.setPaddingTop( '20px' );
	content.setPaddingRight( '10px' );
	content.dom.style.boxSizing = 'border-box';
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

	function makeSettingControl( setting ) {

		const value = getQRCodeRenderSettingValue( config, setting );
		let control;

		if ( setting.type === 'boolean' ) {

			control = new UICheckbox( value );

		} else if ( setting.type === 'select' ) {

			control = new UISelect().setWidth( '96px' );
			control.setOptions( setting.options );
			control.setValue( value );

		} else if ( setting.type === 'color' ) {

			control = new UIColor().setHexValue( value );

		} else {

			control = new UINumber();
			control.setPrecision( setting.precision ?? 2 );
			control.setRange( setting.min ?? -Infinity, setting.max ?? Infinity );
			control.setStep( setting.step ?? 1 );
			control.setWidth( '96px' );
			control.setValue( value );

		}

		control.dom.setAttribute( 'aria-label', setting.label );
		control.onChange( () => {

			const nextValue = setting.type === 'color' ? control.getHexValue() : control.getValue();
			config.setKey( getQRCodeSettingConfigKey( setting ), nextValue );

		} );

		return control;

	}

	function setControlValue( control, setting, value ) {

		if ( setting.type === 'color' ) control.setHexValue( value );
		else control.setValue( value );

	}

	// Add the panel heading.
	const header = new UIText( 'QR Code Generator' );
	header.setDisplay( 'block' );
	header.setFontSize( '14px' );
	header.setMarginBottom( '12px' );
	content.add( header );

	const generatedOutput = new UISpan();
	generatedOutput.setDisplay( 'none' );
	generatedOutput.setWidth( '100%' );
	generatedOutput.setMarginBottom( '8px' );

	const qrCodePreview = new UISpan();
	qrCodePreview.setDisplay( 'block' );
	qrCodePreview.dom.style.width = 'fit-content';
	qrCodePreview.dom.style.maxWidth = '100%';
	qrCodePreview.dom.style.position = 'relative';
	qrCodePreview.dom.style.aspectRatio = '1';
	qrCodePreview.dom.style.margin = '0 auto';
	qrCodePreview.dom.style.background = '#fff';
	qrCodePreview.dom.style.boxSizing = 'border-box';
	qrCodePreview.dom.setAttribute( 'aria-label', 'Generated QR Code' );
	generatedOutput.add( qrCodePreview );
	content.add( generatedOutput );

	const generatorInputLabel = new UIText( 'QR Code Content' );
	generatorInputLabel.setDisplay( 'block' );
	generatorInputLabel.setMarginBottom( '6px' );
	content.add( generatorInputLabel );

	const generatorInput = new UIInput( '' );
	generatorInput.setWidth( '100%' );
	generatorInput.setMarginBottom( '8px' );
	generatorInput.dom.placeholder = 'Enter text';
	generatorInput.dom.setAttribute( 'aria-label', 'Text to encode in the QR Code' );
	generatorInput.dom.style.boxSizing = 'border-box';
	content.add( generatorInput );

	function addGeneratorSettingRow( labelText, control, infoText, parent = content ) {

		const row = new UIRow();
		row.setMarginBottom( '6px' );
		row.dom.style.display = 'grid';
		row.dom.style.gridTemplateColumns = 'minmax(0, 1fr) 16px 96px';
		row.dom.style.gap = '6px';
		row.dom.style.alignItems = 'center';

		const label = new UIText( labelText );
		label.dom.style.whiteSpace = 'normal';
		label.dom.style.overflowWrap = 'anywhere';
		row.add( label );
		row.dom.appendChild( makeInfoButton( infoText ) );
		row.add( control );
		parent.add( row );

	}

	const generatorSettingsTitle = new UIText( 'QR Image Settings' );
	generatorSettingsTitle.setDisplay( 'block' );
	generatorSettingsTitle.setFontSize( '13px' );
	generatorSettingsTitle.setMarginBottom( '8px' );
	content.add( generatorSettingsTitle );

	const generatorSize = new UINumber( 192 );
	generatorSize.setPrecision( 0 );
	generatorSize.setRange( 64, 2048 );
	generatorSize.setStep( 16 );
	generatorSize.setWidth( '96px' );
	generatorSize.setValue( 192 );
	generatorSize.dom.setAttribute( 'aria-label', 'QR Code size in pixels' );
	addGeneratorSettingRow(
		'Code Size (px)',
		generatorSize,
		'Width and height of the QR symbol in pixels before the quiet zone is added. Larger sizes produce sharper printed codes and help dense codes scan reliably.'
	);

	const generatorForegroundColor = new UIColor().setValue( '#000000' ).setWidth( '96px' );
	generatorForegroundColor.dom.setAttribute( 'aria-label', 'QR Code foreground color' );
	addGeneratorSettingRow(
		'Foreground',
		generatorForegroundColor,
		'Color of the dark QR modules. Choose a color with strong contrast against the background.'
	);

	const generatorBackgroundColor = new UIColor().setValue( '#ffffff' ).setWidth( '96px' );
	generatorBackgroundColor.dom.setAttribute( 'aria-label', 'QR Code background color' );
	addGeneratorSettingRow(
		'Background',
		generatorBackgroundColor,
		'Color of the light QR modules and surrounding quiet zone. A light, high-contrast background is the most reliable.'
	);

	const generatorCorrectionLevel = new UISelect().setWidth( '96px' );
	generatorCorrectionLevel.setOptions( {
		L: 'Low - 7%',
		M: 'Med - 15%',
		Q: 'Quartile - 25%',
		H: 'High - 30%'
	} );
	generatorCorrectionLevel.setValue( 'H' );
	generatorCorrectionLevel.dom.setAttribute( 'aria-label', 'QR Code error correction level' );
	addGeneratorSettingRow(
		'Error Correction',
		generatorCorrectionLevel,
		'Approximate percentage of damage the QR code can recover from. Higher levels improve resilience but produce a denser code.'
	);

	const generatorQuietZone = new UINumber( 4 );
	generatorQuietZone.setPrecision( 0 );
	generatorQuietZone.setRange( 0, 16 );
	generatorQuietZone.setStep( 1 );
	generatorQuietZone.setWidth( '96px' );
	generatorQuietZone.setValue( 4 );
	generatorQuietZone.dom.setAttribute( 'aria-label', 'QR Code quiet zone in modules' );
	addGeneratorSettingRow(
		'Quiet Zone',
		generatorQuietZone,
		'Blank margin around the QR code, measured in modules. Four modules is the QR standard and is recommended for reliable scanning.'
	);

	const logoTitle = new UIText( 'Logo Overlay' );
	logoTitle.setDisplay( 'block' );
	logoTitle.setFontSize( '13px' );
	logoTitle.setMarginTop( '12px' );
	logoTitle.setMarginBottom( '8px' );
	content.add( logoTitle );

	const logoFileInput = document.createElement( 'input' );
	logoFileInput.type = 'file';
	logoFileInput.accept = 'image/png,image/jpeg,image/webp';
	logoFileInput.style.display = 'none';
	logoFileInput.setAttribute( 'aria-label', 'Choose a logo image file' );

	const chooseLogoButton = new UIButton( 'Choose Logo' );
	chooseLogoButton.setWidth( '96px' );
	chooseLogoButton.onClick( () => logoFileInput.click() );
	addGeneratorSettingRow(
		'Logo Image',
		chooseLogoButton,
		'Choose a local PNG, JPEG, or WebP image. Files are processed only in this browser; SVG files and remote URLs are not accepted.'
	);
	content.dom.appendChild( logoFileInput );

	const logoStatus = new UIText( 'No logo selected.' );
	logoStatus.setDisplay( 'block' );
	logoStatus.setColor( '#888' );
	logoStatus.setMarginBottom( '8px' );
	logoStatus.dom.style.fontSize = '11px';
	logoStatus.dom.style.overflowWrap = 'anywhere';
	logoStatus.dom.setAttribute( 'role', 'status' );
	logoStatus.dom.setAttribute( 'aria-live', 'polite' );
	content.add( logoStatus );

	const logoSettings = new UISpan();
	logoSettings.setDisplay( 'none' );
	logoSettings.setWidth( '100%' );
	content.add( logoSettings );

	const generatorLogoSize = new UINumber( 15 );
	generatorLogoSize.setPrecision( 0 );
	generatorLogoSize.setRange( 5, 20 );
	generatorLogoSize.setStep( 1 );
	generatorLogoSize.setWidth( '96px' );
	generatorLogoSize.setValue( 15 );
	generatorLogoSize.dom.setAttribute( 'aria-label', 'Logo size as a percentage of the QR Code' );
	addGeneratorSettingRow(
		'Logo Size (%)',
		generatorLogoSize,
		'Total width of the centered logo area as a percentage of the QR symbol. It is capped at 20% to limit interference with scanning.',
		logoSettings
	);

	const generatorLogoFit = new UISelect().setWidth( '96px' );
	generatorLogoFit.setOptions( { contain: 'Contain', cover: 'Cover' } );
	generatorLogoFit.setValue( 'contain' );
	generatorLogoFit.dom.setAttribute( 'aria-label', 'Logo image fit' );
	addGeneratorSettingRow(
		'Logo Fit',
		generatorLogoFit,
		'Contain preserves the complete image. Cover fills the logo area by cropping equally from the image edges.',
		logoSettings
	);

	const generatorLogoPadding = new UINumber( 12 );
	generatorLogoPadding.setPrecision( 0 );
	generatorLogoPadding.setRange( 0, 30 );
	generatorLogoPadding.setStep( 1 );
	generatorLogoPadding.setWidth( '96px' );
	generatorLogoPadding.setValue( 12 );
	generatorLogoPadding.dom.setAttribute( 'aria-label', 'Logo padding percentage' );
	addGeneratorSettingRow(
		'Logo Padding (%)',
		generatorLogoPadding,
		'Inset between the logo and its background plate, measured as a percentage of the reserved logo area. The plate uses the QR background color.',
		logoSettings
	);

	const generatorLogoRadius = new UINumber( 12 );
	generatorLogoRadius.setPrecision( 0 );
	generatorLogoRadius.setRange( 0, 50 );
	generatorLogoRadius.setStep( 1 );
	generatorLogoRadius.setWidth( '96px' );
	generatorLogoRadius.setValue( 12 );
	generatorLogoRadius.dom.setAttribute( 'aria-label', 'Logo corner radius percentage' );
	addGeneratorSettingRow(
		'Corner Radius (%)',
		generatorLogoRadius,
		'Rounds the logo and background plate corners. Zero keeps square corners; 50 creates the maximum rounding.',
		logoSettings
	);

	const removeLogoButton = new UIButton( 'Remove Logo' );
	removeLogoButton.setWidth( '100%' );
	removeLogoButton.setMarginBottom( '8px' );
	logoSettings.add( removeLogoButton );

	const maxLogoFileSize = 5 * 1024 * 1024;
	const maxLogoDimension = 4096;
	const maxLogoPixels = 16 * 1024 * 1024;
	let logoImage;
	let logoLoadRequest = 0;

	function setLogoStatus( message, isError = false ) {

		logoStatus.setValue( message );
		logoStatus.setColor( isError ? '#d44' : '#888' );

	}

	async function getRasterImageType( file ) {

		const bytes = new Uint8Array( await file.slice( 0, 12 ).arrayBuffer() );
		const isPNG = bytes.length >= 8 &&
			bytes[ 0 ] === 0x89 && bytes[ 1 ] === 0x50 && bytes[ 2 ] === 0x4e && bytes[ 3 ] === 0x47 &&
			bytes[ 4 ] === 0x0d && bytes[ 5 ] === 0x0a && bytes[ 6 ] === 0x1a && bytes[ 7 ] === 0x0a;
		const isJPEG = bytes.length >= 3 && bytes[ 0 ] === 0xff && bytes[ 1 ] === 0xd8 && bytes[ 2 ] === 0xff;
		const isWebP = bytes.length >= 12 &&
			String.fromCharCode( ...bytes.slice( 0, 4 ) ) === 'RIFF' &&
			String.fromCharCode( ...bytes.slice( 8, 12 ) ) === 'WEBP';

		if ( isPNG ) return 'image/png';
		if ( isJPEG ) return 'image/jpeg';
		if ( isWebP ) return 'image/webp';
		return undefined;

	}

	removeLogoButton.onClick( () => {

		logoLoadRequest ++;
		logoImage?.close();
		logoImage = undefined;
		logoFileInput.value = '';
		chooseLogoButton.setDisabled( false );
		logoSettings.setDisplay( 'none' );
		logoStatus.dom.title = '';
		setLogoStatus( 'No logo selected.' );

		markQRCodeStale();

	} );

	logoFileInput.addEventListener( 'change', async () => {

		const file = logoFileInput.files?.[ 0 ];
		logoFileInput.value = '';

		if ( file === undefined ) return;

		const request = ++ logoLoadRequest;
		chooseLogoButton.setDisabled( true );
		setLogoStatus( `Loading ${file.name}...` );

		try {

			if ( file.size > maxLogoFileSize ) {

				throw new Error( 'Logo files must be 5 MB or smaller.' );

			}

			if ( await getRasterImageType( file ) === undefined ) {

				throw new Error( 'Choose a valid PNG, JPEG, or WebP image.' );

			}

			if ( typeof createImageBitmap !== 'function' ) {

				throw new Error( 'This browser cannot decode logo images.' );

			}

			const decodedImage = await createImageBitmap( file );

			if ( request !== logoLoadRequest ) {

				decodedImage.close();
				return;

			}

			if ( decodedImage.width > maxLogoDimension || decodedImage.height > maxLogoDimension ||
				decodedImage.width * decodedImage.height > maxLogoPixels ) {

				decodedImage.close();
				throw new Error( 'Logo images must be at most 4096 px per side and 16 megapixels.' );

			}

			logoImage?.close();
			logoImage = decodedImage;
			generatorCorrectionLevel.setValue( 'H' );
			logoSettings.setDisplay( 'block' );
			logoStatus.dom.title = file.name;
			setLogoStatus( `Loaded: ${file.name}. High error correction selected.` );

			markQRCodeStale();

		} catch ( error ) {

			if ( request === logoLoadRequest ) {

				setLogoStatus( error instanceof Error ? error.message : 'Unable to load the logo image.', true );

			}

		} finally {

			if ( request === logoLoadRequest ) chooseLogoButton.setDisabled( false );

		}

	} );

	function addRoundedRectanglePath( context, x, y, width, height, radius ) {

		const clampedRadius = Math.min( Math.max( radius, 0 ), width / 2, height / 2 );
		context.beginPath();
		context.moveTo( x + clampedRadius, y );
		context.lineTo( x + width - clampedRadius, y );
		context.quadraticCurveTo( x + width, y, x + width, y + clampedRadius );
		context.lineTo( x + width, y + height - clampedRadius );
		context.quadraticCurveTo( x + width, y + height, x + width - clampedRadius, y + height );
		context.lineTo( x + clampedRadius, y + height );
		context.quadraticCurveTo( x, y + height, x, y + height - clampedRadius );
		context.lineTo( x, y + clampedRadius );
		context.quadraticCurveTo( x, y, x + clampedRadius, y );
		context.closePath();

	}

	function drawLogoOverlay( canvas, backgroundColor ) {

		if ( logoImage === undefined ) return;

		const context = canvas.getContext( '2d' );
		const logoAreaSize = Math.round( canvas.width * generatorLogoSize.getValue() / 100 );
		const logoAreaX = ( canvas.width - logoAreaSize ) / 2;
		const logoAreaY = ( canvas.height - logoAreaSize ) / 2;
		const padding = logoAreaSize * generatorLogoPadding.getValue() / 100;
		const innerSize = logoAreaSize - padding * 2;
		const innerX = logoAreaX + padding;
		const innerY = logoAreaY + padding;
		const plateRadius = logoAreaSize * generatorLogoRadius.getValue() / 100;
		const innerRadius = Math.max( 0, plateRadius - padding );

		context.save();
		context.fillStyle = backgroundColor;
		addRoundedRectanglePath( context, logoAreaX, logoAreaY, logoAreaSize, logoAreaSize, plateRadius );
		context.fill();

		addRoundedRectanglePath( context, innerX, innerY, innerSize, innerSize, innerRadius );
		context.clip();
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';

		if ( generatorLogoFit.getValue() === 'cover' ) {

			const sourceSize = Math.min( logoImage.width, logoImage.height );
			const sourceX = ( logoImage.width - sourceSize ) / 2;
			const sourceY = ( logoImage.height - sourceSize ) / 2;
			context.drawImage(
				logoImage,
				sourceX, sourceY, sourceSize, sourceSize,
				innerX, innerY, innerSize, innerSize
			);

		} else {

			const scale = Math.min( innerSize / logoImage.width, innerSize / logoImage.height );
			const logoWidth = logoImage.width * scale;
			const logoHeight = logoImage.height * scale;
			const logoX = innerX + ( innerSize - logoWidth ) / 2;
			const logoY = innerY + ( innerSize - logoHeight ) / 2;
			context.drawImage( logoImage, logoX, logoY, logoWidth, logoHeight );

		}

		context.restore();

	}

	function createComposedQRCodeCanvas( sourceCanvas, backgroundColor ) {

		const canvas = document.createElement( 'canvas' );
		canvas.width = sourceCanvas.width;
		canvas.height = sourceCanvas.height;

		const context = canvas.getContext( '2d' );
		context.imageSmoothingEnabled = false;
		context.drawImage( sourceCanvas, 0, 0 );
		drawLogoOverlay( canvas, backgroundColor );

		return canvas;

	}

	let generatedCanvas;
	let generatedQuietZone = 0;
	let generatedBackgroundColor = '#ffffff';

	function createDownloadCanvas() {

		if ( generatedCanvas === undefined ) return undefined;

		const downloadCanvas = document.createElement( 'canvas' );
		downloadCanvas.width = generatedCanvas.width + generatedQuietZone * 2;
		downloadCanvas.height = generatedCanvas.height + generatedQuietZone * 2;

		const context = downloadCanvas.getContext( '2d' );
		context.fillStyle = generatedBackgroundColor;
		context.fillRect( 0, 0, downloadCanvas.width, downloadCanvas.height );
		context.drawImage( generatedCanvas, generatedQuietZone, generatedQuietZone );

		return downloadCanvas;

	}

	const saveQRCodeButton = new UIButton( 'Download Current QR Code' );
	saveQRCodeButton.setWidth( '100%' );
	saveQRCodeButton.setDisplay( 'none' );
	saveQRCodeButton.setMarginTop( '8px' );
	saveQRCodeButton.setMarginBottom( '12px' );
	saveQRCodeButton.onClick( () => {

		if ( generatedQRCodeImageDataURL === '' ) return;

		const link = document.createElement( 'a' );
		link.href = generatedQRCodeImageDataURL;
		link.download = 'qrcode.png';
		document.body.appendChild( link );
		link.click();
		link.remove();

	} );
	generatedOutput.add( saveQRCodeButton );

	const generateQRCodeButton = new UIButton( 'Generate QR Code' );
	generateQRCodeButton.setWidth( '100%' );
	generateQRCodeButton.setMarginBottom( '8px' );

	const generationStatus = new UIText( 'Changes are applied when Generate QR Code is pressed.' );
	generationStatus.setDisplay( 'block' );
	generationStatus.setColor( '#888' );
	generationStatus.setMarginBottom( '8px' );
	generationStatus.dom.style.fontSize = '11px';
	generationStatus.dom.style.lineHeight = '1.35';
	generationStatus.dom.style.whiteSpace = 'normal';
	generationStatus.dom.setAttribute( 'role', 'status' );
	generationStatus.dom.setAttribute( 'aria-live', 'polite' );
	generationStatus.dom.setAttribute( 'aria-label', 'QR Code generation status' );

	const publishOptions = new UISpan();
	publishOptions.setDisplay( 'block' );
	publishOptions.setWidth( '100%' );

	const includePublishedQRCodeCheckbox = new UICheckbox( includeQRCodeInPublishedApp );
	includePublishedQRCodeCheckbox.setDisabled( generatedQRCodeImageDataURL === '' );
	includePublishedQRCodeCheckbox.dom.setAttribute( 'aria-label', 'Include marker in Published QR App' );
	includePublishedQRCodeCheckbox.onChange( function () {

		includeQRCodeInPublishedApp = this.getValue();

	} );
	addGeneratorSettingRow(
		'Include marker in Published QR App',
		includePublishedQRCodeCheckbox,
		'Adds the last successfully generated QR image to the published ZIP as qrcode.png. Generate a QR Code first; later control changes do not alter the bundled image until you generate again.',
		publishOptions
	);

	function markQRCodeStale() {

		if ( generatedCanvas === undefined ) {

			generationStatus.setValue( 'Changes are applied when Generate QR Code is pressed.' );
			generationStatus.setColor( '#888' );
			generationStatus.dom.style.fontWeight = 'normal';
			return;

		}

		generationStatus.setValue( 'Preview is out of date. Press Generate QR Code to apply changes.' );
		generationStatus.setColor( '#d89b35' );
		generationStatus.dom.style.fontWeight = 'bold';
		saveQRCodeButton.setDisabled( true );
		qrCodePreview.setOpacity( '0.65' );
		qrCodePreview.dom.setAttribute( 'aria-label', 'Generated QR Code (out of date)' );

	}

	function generateQRCode() {

		const text = generatorInput.getValue();
		generatorInput.dom.setCustomValidity( '' );

		if ( text.trim() === '' ) {

			generatorInput.dom.setCustomValidity( 'Enter text to generate a QR Code.' );
			generatorInput.dom.reportValidity();
			return;

		}

		qrCodePreview.clear();

		try {

			const size = generatorSize.getValue();
			const foregroundColor = generatorForegroundColor.getValue();
			const backgroundColor = generatorBackgroundColor.getValue();
			const quietZoneModules = generatorQuietZone.getValue();

			const qrCode = new QRCode( qrCodePreview.dom, {
				text,
				width: size,
				height: size,
				colorDark: foregroundColor,
				colorLight: backgroundColor,
				correctLevel: QRCode.CorrectLevel[ generatorCorrectionLevel.getValue() ]
			} );

			const sourceCanvas = qrCodePreview.dom.querySelector( 'canvas' );

			if ( sourceCanvas === null ) {

				throw new Error( 'Unable to create the QR Code canvas.' );

			}

			generatedCanvas = createComposedQRCodeCanvas( sourceCanvas, backgroundColor );
			qrCodePreview.clear();
			qrCodePreview.dom.appendChild( generatedCanvas );
			const moduleCount = qrCode._oQRCode.getModuleCount();
			generatedQuietZone = Math.ceil( size / moduleCount * quietZoneModules );
			generatedBackgroundColor = backgroundColor;
			generatedQRCodeImageDataURL = createDownloadCanvas().toDataURL( 'image/png' );
			includePublishedQRCodeCheckbox.setDisabled( false );

			const generatedSize = size + generatedQuietZone * 2;
			const previewQuietZone = generatedQuietZone / generatedSize * 100;
			const previewCodeSize = size / generatedSize * 100;
			qrCodePreview.dom.style.width = `${generatedSize}px`;
			qrCodePreview.dom.style.background = backgroundColor;
			qrCodePreview.dom.style.padding = '0';

			for ( const outputElement of qrCodePreview.dom.querySelectorAll( 'canvas, img' ) ) {

				outputElement.style.position = 'absolute';
				outputElement.style.left = `${previewQuietZone}%`;
				outputElement.style.top = `${previewQuietZone}%`;
				outputElement.style.width = `${previewCodeSize}%`;
				outputElement.style.height = `${previewCodeSize}%`;

			}

			generatedOutput.setDisplay( 'block' );
			saveQRCodeButton.setDisplay( '' );
			saveQRCodeButton.setDisabled( false );
			qrCodePreview.setOpacity( '1' );
			qrCodePreview.dom.setAttribute( 'aria-label', 'Generated QR Code' );
			generationStatus.setValue( 'Preview matches the current content and settings.' );
			generationStatus.setColor( '#888' );
			generationStatus.dom.style.fontWeight = 'normal';

		} catch ( error ) {

			generatedCanvas = undefined;
			generatedOutput.setDisplay( 'none' );
			saveQRCodeButton.setDisplay( 'none' );
			generationStatus.setValue( 'QR Code generation failed. Review the content or settings and try again.' );
			generationStatus.setColor( '#d44' );
			generationStatus.dom.style.fontWeight = 'bold';
			generatorInput.dom.setCustomValidity( error instanceof Error ? error.message : 'Unable to generate QR Code.' );
			generatorInput.dom.reportValidity();

		}

	}

	generateQRCodeButton.onClick( generateQRCode );
	generatorInput.onInput( () => {

		generatorInput.dom.setCustomValidity( '' );
		markQRCodeStale();

	} );
	generatorSize.onChange( markQRCodeStale );
	generatorForegroundColor.onInput( markQRCodeStale );
	generatorBackgroundColor.onInput( markQRCodeStale );
	generatorCorrectionLevel.onChange( markQRCodeStale );
	generatorQuietZone.onChange( markQRCodeStale );
	generatorLogoSize.onChange( markQRCodeStale );
	generatorLogoFit.onChange( markQRCodeStale );
	generatorLogoPadding.onChange( markQRCodeStale );
	generatorLogoRadius.onChange( markQRCodeStale );
	generatorInput.onKeyDown( ( event ) => {

		if ( event.key === 'Enter' ) {

			event.preventDefault();
			generateQRCode();

		}

	} );
	content.add( generateQRCodeButton );
	content.add( generationStatus );
	content.add( publishOptions );

	content.add( new UIHorizontalRule().setMarginBottom( '12px' ) );

	// UIRow groups the label and checkbox horizontally. The fixed label width
	// keeps this control aligned with other sidebar controls.
	const trackingRow = new UIRow();
	trackingRow.dom.style.display = 'grid';
	trackingRow.dom.style.gridTemplateColumns = 'minmax(0, 1fr) 16px 96px';
	trackingRow.dom.style.gap = '6px';
	const trackingCheckbox = new UICheckbox( trackSpecificQRCode );
	trackingCheckbox.dom.setAttribute( 'aria-label', 'Track specific QR Code' );
	trackingRow.add( new UIText( 'Track specific QR Code' ) );
	trackingRow.dom.appendChild( makeInfoButton(
		'When enabled, the exported tracker responds only to a QR code containing the exact data entered below.'
	) );
	trackingRow.add( trackingCheckbox );
	content.add( trackingRow );

	// This section is only needed when the user wants to track one particular
	// QR code. It starts hidden unless the setting is already enabled.
	const qrCodeInfoSection = new UISpan();
	qrCodeInfoSection.setDisplay( trackSpecificQRCode ? 'block' : 'none' );
	qrCodeInfoSection.setMarginTop( '8px' );

	// The user enters the text/value encoded by the QR code to track.
	const qrCodeInfoLabelRow = new UIRow();
	qrCodeInfoLabelRow.setMarginBottom( '6px' );
	qrCodeInfoLabelRow.dom.style.display = 'grid';
	qrCodeInfoLabelRow.dom.style.gridTemplateColumns = 'minmax(0, 1fr) 16px';
	qrCodeInfoLabelRow.dom.style.gap = '6px';
	qrCodeInfoLabelRow.add( new UIText( 'Enter the QR Code Info' ) );
	qrCodeInfoLabelRow.dom.appendChild( makeInfoButton(
		'Exact text or data encoded in the QR code to track. Leave specific tracking disabled to follow the first detected QR code.'
	) );
	qrCodeInfoSection.add( qrCodeInfoLabelRow );

	// UIInput wraps a normal text input. Initialize it with the shared value so
	// the visible control reflects the current editor-session state.
	const qrCodeInfoInput = new UIInput( qrCodeInfo );
	qrCodeInfoInput.setWidth( '100%' );
	qrCodeInfoInput.dom.setAttribute( 'aria-label', 'Enter the QR Code Info' );
	qrCodeInfoInput.dom.style.boxSizing = 'border-box';
	qrCodeInfoInput.onInput( function () {

		// onInput fires as the user types. Keeping this shared value updated means
		// Publish can read the latest text even if the input has not lost focus.
		qrCodeInfo = this.getValue();

	} );
	qrCodeInfoSection.add( qrCodeInfoInput );
	content.add( qrCodeInfoSection );

	content.add( new UIHorizontalRule().setMarginTop( '12px' ) );

	const settingsTitle = new UIText( 'QR Tracker Settings' );
	settingsTitle.setDisplay( 'block' );
	settingsTitle.setFontSize( '13px' );
	settingsTitle.setMarginBottom( '8px' );
	content.add( settingsTitle );

	const settingControls = [];

	for ( const group of QR_CODE_RENDER_SETTING_GROUPS ) {

		const groupElement = document.createElement( 'details' );
		groupElement.open = group.open === true;
		groupElement.style.marginBottom = '8px';
		groupElement.style.borderBottom = '1px solid #ccc';
		groupElement.style.paddingBottom = '6px';

		const groupSummary = document.createElement( 'summary' );
		groupSummary.textContent = group.title;
		groupSummary.style.cursor = 'pointer';
		groupSummary.style.fontSize = '12px';
		groupSummary.style.fontWeight = 'bold';
		groupSummary.style.marginBottom = '8px';
		groupElement.appendChild( groupSummary );

		const groupDescription = document.createElement( 'p' );
		groupDescription.textContent = group.description;
		groupDescription.style.margin = '0 0 10px 0';
		groupDescription.style.color = '#888';
		groupDescription.style.fontSize = '12px';
		groupDescription.style.lineHeight = '1.4';
		groupDescription.style.userSelect = 'text';
		groupElement.appendChild( groupDescription );

		for ( const setting of group.settings ) {

			const row = new UIRow();
			row.setMarginBottom( '6px' );
			row.dom.style.display = 'grid';
			row.dom.style.gridTemplateColumns = 'minmax(0, 1fr) 16px 96px';
			row.dom.style.gap = '6px';
			row.dom.style.alignItems = 'center';

			const label = new UIText( setting.label );
			label.dom.style.whiteSpace = 'normal';
			label.dom.style.overflowWrap = 'anywhere';
			row.add( label );
			row.dom.appendChild( makeInfoButton( setting.info ) );

			const control = makeSettingControl( setting );
			row.add( control );
			groupElement.appendChild( row.dom );
			settingControls.push( { setting, control } );

		}

		content.dom.appendChild( groupElement );

	}

	const resetSettingsButton = new UIButton( 'Reset QR Settings' );
	resetSettingsButton.setMarginBottom( '10px' );
	resetSettingsButton.onClick( () => {

		const configValues = [];

		for ( const { setting, control } of settingControls ) {

			setControlValue( control, setting, setting.defaultValue );
			configValues.push( getQRCodeSettingConfigKey( setting ), setting.defaultValue );

		}

		config.setKey( ...configValues );

	} );
	content.add( resetSettingsButton );

	// Show or hide the text field when the checkbox changes, and keep the
	// shared setting synchronized with the checkbox's boolean value.
	trackingCheckbox.onChange( function () {

		trackSpecificQRCode = this.getValue();

		if ( trackSpecificQRCode && generatedCanvas !== undefined ) {

			qrCodeInfo = generatorInput.getValue();
			qrCodeInfoInput.setValue( qrCodeInfo );

		}

		qrCodeInfoSection.setDisplay( trackSpecificQRCode ? 'block' : 'none' );

	} );

	// Sidebar.js uses this returned element as the contents of the sidebar tab.
	return container;

}

// Export the panel constructor for Sidebar.js and the getter for publishing.
export { SidebarQRCodeGenerator, getTrackedQRCodeData, getQRCodeImageForPublishing };
