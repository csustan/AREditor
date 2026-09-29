import * as THREE from 'three';

const AR_MARKER_PREVIEW_NAME = 'DefaultMarkerPlaneForScale';
const DEFAULT_AR_MARKER_PREVIEW_URL = 'files/markerForScale.png';

function createARMarkerPreview() {

	const markerImageURL = window.getSharedMarkerImageDataURL?.() || DEFAULT_AR_MARKER_PREVIEW_URL;
	const markerTexture = new THREE.TextureLoader().load( markerImageURL );
	const markerMaterial = new THREE.MeshBasicMaterial( { map: markerTexture } );
	const markerPreview = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), markerMaterial );

	markerPreview.name = AR_MARKER_PREVIEW_NAME;
	markerPreview.rotation.x = - Math.PI / 2;

	return markerPreview;

}

export { AR_MARKER_PREVIEW_NAME, createARMarkerPreview };