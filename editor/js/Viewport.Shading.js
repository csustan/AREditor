import { UIPanel, UISelect } from './libs/ui.js';
import { getMarkerSystems } from './MarkerSystemRegistry.js';

function ViewportShading( editor ) {

	const container = new UIPanel();

	const shadingSelect = new UISelect();
	shadingSelect.setId( 'viewport-shading-select' );
	shadingSelect.setPosition( 'absolute' );
	shadingSelect.setRight( '10px' );
	shadingSelect.setTop( '10px' );
	shadingSelect.setOptions( { 'default': 'default', 'normals': 'normals', 'wireframe': 'wireframe' } );
	shadingSelect.setValue( 'default' );
	shadingSelect.onChange( function () {

		editor.setViewportShading( this.getValue() );

	} );

	container.add( shadingSelect );

	const lightingPreviewSelect = new UISelect();
	lightingPreviewSelect.setId( 'viewport-lighting-preview-select' );
	lightingPreviewSelect.setPosition( 'absolute' );
	lightingPreviewSelect.setRight( '120px' );
	lightingPreviewSelect.setTop( '10px' );
	lightingPreviewSelect.setWidth( '220px' );
	lightingPreviewSelect.setOptions( {
		'off': 'Lighting Preview Off',
		'nft': 'Lighting Preview NFT',
		'qr': 'Lighting Preview QR',
		'ar': 'Lighting Preview AR'
	} );
	lightingPreviewSelect.setValue( editor.viewportLightingPreview );
	lightingPreviewSelect.onChange( function () {

		editor.setViewportLightingPreview( this.getValue() );

	} );

	container.add( lightingPreviewSelect );

	const markerPreviewSelect = new UISelect();
	markerPreviewSelect.setId( 'viewport-marker-preview-select' );
	markerPreviewSelect.setPosition( 'absolute' );
	markerPreviewSelect.setLeft( '52px' );
	markerPreviewSelect.setTop( '10px' );
	markerPreviewSelect.setWidth( '190px' );
	const markerPreviewOptions = { 'off': 'Marker Preview Off' };

	for ( const markerSystem of getMarkerSystems() ) {

		markerPreviewOptions[ markerSystem.previewMode || markerSystem.id ] = markerSystem.label || markerSystem.id;

	}

	markerPreviewSelect.setOptions( markerPreviewOptions );
	markerPreviewSelect.setValue( editor.viewportMarkerPreview );
	markerPreviewSelect.onChange( function () {

		editor.setViewportMarkerPreview( this.getValue() );

	} );

	container.add( markerPreviewSelect );

	const markerRulerControls = document.createElement( 'div' );
	markerRulerControls.id = 'viewport-marker-ruler-controls';
	markerRulerControls.title = 'Ruler ticks use marker-width units. Enter a positive width in centimeters to add centimeter labels; clear the field or enter 0 to hide them.';

	function updateMarkerRulerControlsVisibility() {

		const showControls = editor.viewportMarkerPreview === 'ar' || editor.viewportMarkerPreview === 'nft';
		markerRulerControls.style.display = showControls ? '' : 'none';

	}

	updateMarkerRulerControlsVisibility();

	const markerRulerLabel = document.createElement( 'label' );
	markerRulerLabel.htmlFor = 'viewport-marker-ruler-toggle';
	markerRulerLabel.textContent = 'Ruler';

	const markerRulerToggle = document.createElement( 'input' );
	markerRulerToggle.id = 'viewport-marker-ruler-toggle';
	markerRulerToggle.type = 'checkbox';
	markerRulerToggle.checked = editor.viewportMarkerRulerEnabled;
	markerRulerToggle.setAttribute( 'aria-label', 'Show marker ruler' );
	markerRulerToggle.addEventListener( 'change', function () {

		editor.setViewportMarkerRulerEnabled( markerRulerToggle.checked );

	} );

	function stopViewportInteraction( event ) {

		event.stopPropagation();

	}

	for ( const eventType of [ 'pointerdown', 'mousedown', 'touchstart', 'wheel' ] ) {

		markerRulerControls.addEventListener( eventType, stopViewportInteraction );

	}

	markerRulerLabel.prepend( markerRulerToggle );
	markerRulerControls.appendChild( markerRulerLabel );

	const markerWidthLabel = document.createElement( 'label' );
	markerWidthLabel.htmlFor = 'viewport-marker-width-cm';
	markerWidthLabel.textContent = 'Width (cm)';

	const markerWidthInput = document.createElement( 'input' );
	markerWidthInput.id = 'viewport-marker-width-cm';
	markerWidthInput.type = 'number';
	markerWidthInput.min = '0';
	markerWidthInput.step = 'any';
	markerWidthInput.placeholder = 'e.g. 10';
	markerWidthInput.value = editor.viewportMarkerWidthCm;
	markerWidthInput.setAttribute( 'aria-label', 'Marker width in centimeters' );
	markerWidthInput.addEventListener( 'input', function () {

		editor.setViewportMarkerWidthCm( markerWidthInput.value );

	} );

	const markerWidthClearButton = document.createElement( 'button' );
	markerWidthClearButton.type = 'button';
	markerWidthClearButton.className = 'marker-width-clear';
	markerWidthClearButton.textContent = '×';
	markerWidthClearButton.title = 'Clear marker width';
	markerWidthClearButton.setAttribute( 'aria-label', 'Clear marker width in centimeters' );
	markerWidthClearButton.addEventListener( 'click', function () {

		markerWidthInput.value = '';
		editor.setViewportMarkerWidthCm( '' );

	} );

	markerRulerControls.appendChild( markerWidthLabel );
	markerRulerControls.appendChild( markerWidthInput );
	markerRulerControls.appendChild( markerWidthClearButton );
	container.dom.appendChild( markerRulerControls );

	editor.signals.viewportLightingPreviewChanged.add( function () {

		lightingPreviewSelect.setValue( editor.viewportLightingPreview );

	} );

	editor.signals.viewportMarkerPreviewChanged.add( function () {

		markerPreviewSelect.setValue( editor.viewportMarkerPreview );
		updateMarkerRulerControlsVisibility();

	} );

	editor.signals.viewportMarkerRulerChanged.add( function () {

		markerRulerToggle.checked = editor.viewportMarkerRulerEnabled;

		if ( markerWidthInput.value !== editor.viewportMarkerWidthCm ) {

			markerWidthInput.value = editor.viewportMarkerWidthCm;

		}

	} );

	editor.signals.viewportShadingChanged.add( function () {

		shadingSelect.setValue( editor.viewportShading );

	} );

	return container;

}

export { ViewportShading };
