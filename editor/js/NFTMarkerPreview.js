import * as THREE from 'three';

const NFT_MARKER_PREVIEW_NAME = 'DefaultNFTMarkerPlaneForScale';
// pinball.jpg and the bundled 120-DPI tracker scale describe the same physical marker at different resolutions.
const DEFAULT_NFT_MARKER_PREVIEW_DPI = 220;
const NFT_TRACKER_MILLIMETERS_PER_EDITOR_UNIT = 80;
const MILLIMETERS_PER_INCH = 25.4;
const DEFAULT_NFT_MARKER_PREVIEW_URL = new URL( '../files/ARNFTExportFiles/img/pinball.jpg', import.meta.url ).toString();

function getNFTMarkerPreviewSource() {

	const generatedImage = window.NFT_ImageBlob instanceof Blob ? window.NFT_ImageBlob : null;
	const generatedDPI = Number( window.NFT_Dpi );

	return {
		url: generatedImage === null ? DEFAULT_NFT_MARKER_PREVIEW_URL : URL.createObjectURL( generatedImage ),
		dpi: generatedImage !== null && Number.isFinite( generatedDPI ) && generatedDPI > 0 ? generatedDPI : DEFAULT_NFT_MARKER_PREVIEW_DPI,
		revokeURL: generatedImage !== null
	};

}

function updateNFTMarkerPreview( markerPreview, onUpdate ) {

	const source = getNFTMarkerPreviewSource();
	const loadToken = ( markerPreview.userData.nftMarkerPreviewLoadToken || 0 ) + 1;
	markerPreview.userData.nftMarkerPreviewLoadToken = loadToken;

	new THREE.TextureLoader().load( source.url, function ( texture ) {

		if ( source.revokeURL ) URL.revokeObjectURL( source.url );

		if ( markerPreview.userData.nftMarkerPreviewLoadToken !== loadToken ) {

			texture.dispose();
			return;

		}

		const imageWidth = texture.image.naturalWidth || texture.image.width;
		const imageHeight = texture.image.naturalHeight || texture.image.height;
		const editorUnitsPerPixel = MILLIMETERS_PER_INCH / source.dpi / NFT_TRACKER_MILLIMETERS_PER_EDITOR_UNIT;
		const geometry = new THREE.PlaneGeometry(
			imageWidth * editorUnitsPerPixel,
			imageHeight * editorUnitsPerPixel
		);
		const previousTexture = markerPreview.material.map;

		markerPreview.geometry.dispose();
		markerPreview.geometry = geometry;
		markerPreview.material.map = texture;
		markerPreview.material.needsUpdate = true;
		markerPreview.userData.nftMarkerPreview = {
			dpi: source.dpi,
			imageWidth: imageWidth,
			imageHeight: imageHeight
		};

		if ( previousTexture !== null ) previousTexture.dispose();
		if ( onUpdate !== undefined ) onUpdate( markerPreview );

	}, undefined, function ( error ) {

		if ( source.revokeURL ) URL.revokeObjectURL( source.url );
		console.error( '[NFT Marker Preview] Unable to load marker image.', error );

	} );

}

function createNFTMarkerPreview( onUpdate ) {

	const markerPreview = new THREE.Mesh(
		new THREE.PlaneGeometry( 1, 1 ),
		new THREE.MeshBasicMaterial()
	);

	markerPreview.name = NFT_MARKER_PREVIEW_NAME;
	markerPreview.rotation.x = - Math.PI / 2;
	updateNFTMarkerPreview( markerPreview, onUpdate );

	return markerPreview;

}

export { NFT_MARKER_PREVIEW_NAME, createNFTMarkerPreview, updateNFTMarkerPreview };
