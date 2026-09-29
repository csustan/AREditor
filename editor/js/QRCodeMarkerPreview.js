import * as THREE from 'three';

const QR_CODE_MARKER_PREVIEW_NAME = 'DefaultQRCodeMarkerPlaneForScale';
const DEFAULT_QR_CODE_MARKER_PREVIEW_URL = new URL( '../files/ARQRCodeExportFiles/StanStateFabLab.png', import.meta.url ).toString();

let generatedQRCodeMarkerImageDataURL = '';

function setGeneratedQRCodeMarkerImage( imageDataURL ) {

	generatedQRCodeMarkerImageDataURL = imageDataURL;

}

function updateQRCodeMarkerPreview( markerPreview, onUpdate ) {

	const generatedImage = generatedQRCodeMarkerImageDataURL !== '';
	const sourceURL = generatedImage ? generatedQRCodeMarkerImageDataURL : DEFAULT_QR_CODE_MARKER_PREVIEW_URL;
	const loadToken = ( markerPreview.userData.qrCodeMarkerPreviewLoadToken || 0 ) + 1;
	markerPreview.userData.qrCodeMarkerPreviewLoadToken = loadToken;

	new THREE.TextureLoader().load( sourceURL, function ( texture ) {

		if ( markerPreview.userData.qrCodeMarkerPreviewLoadToken !== loadToken ) {

			texture.dispose();
			return;

		}

		const previousTexture = markerPreview.material.map;
		markerPreview.material.map = texture;
		markerPreview.material.needsUpdate = true;
		markerPreview.userData.qrCodeMarkerPreview = {
			source: generatedImage ? 'generated' : 'default',
			imageWidth: texture.image.naturalWidth || texture.image.width,
			imageHeight: texture.image.naturalHeight || texture.image.height
		};

		if ( previousTexture !== null ) previousTexture.dispose();
		if ( onUpdate !== undefined ) onUpdate( markerPreview );

	}, undefined, function ( error ) {

		console.error( '[QR Code Marker Preview] Unable to load marker image.', error );

	} );

}

function createQRCodeMarkerPreview( onUpdate ) {

	const markerPreview = new THREE.Mesh(
		new THREE.PlaneGeometry( 1, 1 ),
		new THREE.MeshBasicMaterial()
	);

	markerPreview.name = QR_CODE_MARKER_PREVIEW_NAME;
	markerPreview.rotation.x = - Math.PI / 2;
	updateQRCodeMarkerPreview( markerPreview, onUpdate );

	return markerPreview;

}

export {
	QR_CODE_MARKER_PREVIEW_NAME,
	createQRCodeMarkerPreview,
	setGeneratedQRCodeMarkerImage,
	updateQRCodeMarkerPreview
};