import * as THREE from 'three';

import {
	getMarkerSystemState,
	markMarkerPreview,
	registerMarkerSystem
} from './MarkerSystemRegistry.js';

const AR_MARKER_PREVIEW_NAME = 'DefaultMarkerPlaneForScale';
const DEFAULT_AR_MARKER_PREVIEW_URL = 'files/markerForScale.png';

function getARMarkerPreviewURL() {

	return getMarkerSystemState( 'ar' )?.imageDataURL ||
		window.getSharedMarkerImageDataURL?.() ||
		DEFAULT_AR_MARKER_PREVIEW_URL;

}

function updateARMarkerPreview( markerPreview, onUpdate ) {

	const loadToken = ( markerPreview.userData.arMarkerPreviewLoadToken || 0 ) + 1;
	markerPreview.userData.arMarkerPreviewLoadToken = loadToken;

	new THREE.TextureLoader().load( getARMarkerPreviewURL(), function ( texture ) {

		if ( markerPreview.userData.arMarkerPreviewLoadToken !== loadToken ) {

			texture.dispose();
			return;

		}

		const previousTexture = markerPreview.material.map;
		markerPreview.material.map = texture;
		markerPreview.material.needsUpdate = true;

		if ( previousTexture !== null ) previousTexture.dispose();
		onUpdate?.( markerPreview );

	}, undefined, function ( error ) {

		console.error( '[AR Marker Preview] Unable to load marker image.', error );

	} );

}

function createARMarkerPreview( onUpdate ) {

	const markerPreview = new THREE.Mesh(
		new THREE.PlaneGeometry( 1, 1 ),
		new THREE.MeshBasicMaterial()
	);

	markerPreview.name = AR_MARKER_PREVIEW_NAME;
	markerPreview.rotation.x = - Math.PI / 2;
	markMarkerPreview( markerPreview, 'ar' );
	updateARMarkerPreview( markerPreview, onUpdate );

	return markerPreview;

}

registerMarkerSystem( {
	id: 'ar',
	label: 'AR Marker Preview',
	stateVersion: 1,
	legacyPreviewNames: [ AR_MARKER_PREVIEW_NAME ],
	createPreview: createARMarkerPreview,
	updatePreview: updateARMarkerPreview
} );

export { AR_MARKER_PREVIEW_NAME, createARMarkerPreview, updateARMarkerPreview };