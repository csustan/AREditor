import { UIPanel, UISelect } from './libs/ui.js';

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
	markerPreviewSelect.setRight( '350px' );
	markerPreviewSelect.setTop( '10px' );
	markerPreviewSelect.setWidth( '190px' );
	markerPreviewSelect.setOptions( {
		'off': 'Marker Preview Off',
		'ar': 'AR Marker Preview'
	} );
	markerPreviewSelect.setValue( editor.viewportMarkerPreview );
	markerPreviewSelect.onChange( function () {

		editor.setViewportMarkerPreview( this.getValue() );

	} );

	container.add( markerPreviewSelect );

	editor.signals.viewportLightingPreviewChanged.add( function () {

		lightingPreviewSelect.setValue( editor.viewportLightingPreview );

	} );

	editor.signals.viewportMarkerPreviewChanged.add( function () {

		markerPreviewSelect.setValue( editor.viewportMarkerPreview );

	} );

	editor.signals.viewportShadingChanged.add( function () {

		shadingSelect.setValue( editor.viewportShading );

	} );

	return container;

}

export { ViewportShading };
