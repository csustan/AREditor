import * as THREE from 'three';

const MARKER_MIN = - 0.5;
const MARKER_MAX = 0.5;
const MARKER_WIDTH = MARKER_MAX - MARKER_MIN;
const RULER_EXTENT_MARKER_WIDTHS = 3;
const TICKS_PER_MARKER_WIDTH = 10;
const MAJOR_TICK_INTERVAL = 0.5;
const RULER_MIN = MARKER_MIN - RULER_EXTENT_MARKER_WIDTHS * MARKER_WIDTH;
const RULER_MAX = MARKER_MIN + RULER_EXTENT_MARKER_WIDTHS * MARKER_WIDTH;
const RULER_Z = 0.01;

function addRulerQuad( positions, startX, startY, endX, endY, thickness ) {

	const directionX = endX - startX;
	const directionY = endY - startY;
	const length = Math.hypot( directionX, directionY );
	const normalX = - directionY / length * thickness / 2;
	const normalY = directionX / length * thickness / 2;

	const firstX = startX + normalX;
	const firstY = startY + normalY;
	const secondX = startX - normalX;
	const secondY = startY - normalY;
	const thirdX = endX - normalX;
	const thirdY = endY - normalY;
	const fourthX = endX + normalX;
	const fourthY = endY + normalY;

	positions.push(
		firstX, firstY, RULER_Z,
		secondX, secondY, RULER_Z,
		thirdX, thirdY, RULER_Z,
		firstX, firstY, RULER_Z,
		thirdX, thirdY, RULER_Z,
		fourthX, fourthY, RULER_Z
	);

}

function addRulerQuadXZ( positions, startX, startZ, endX, endZ, y, thickness ) {

	const directionX = endX - startX;
	const directionZ = endZ - startZ;
	const length = Math.hypot( directionX, directionZ );
	const normalX = - directionZ / length * thickness / 2;
	const normalZ = directionX / length * thickness / 2;

	const firstX = startX + normalX;
	const firstZ = startZ + normalZ;
	const secondX = startX - normalX;
	const secondZ = startZ - normalZ;
	const thirdX = endX - normalX;
	const thirdZ = endZ - normalZ;
	const fourthX = endX + normalX;
	const fourthZ = endZ + normalZ;

	positions.push(
		firstX, y, firstZ,
		secondX, y, secondZ,
		thirdX, y, thirdZ,
		firstX, y, firstZ,
		thirdX, y, thirdZ,
		fourthX, y, fourthZ
	);

}

function formatRulerNumber( value ) {

	return Number( value.toFixed( 2 ) ).toString();

}

function createLabelSprite( text, x, y, alignment = 'center', positionZ = RULER_Z ) {

	const canvas = document.createElement( 'canvas' );
	const context = canvas.getContext( '2d' );

	if ( context === null ) throw new Error( 'Unable to create marker ruler labels: canvas 2D context is unavailable.' );

	const font = 'bold 48px Arial, sans-serif';
	context.font = font;

	canvas.width = Math.ceil( context.measureText( text ).width + 24 );
	canvas.height = 72;

	context.font = font;
	context.lineWidth = 8;
	context.lineJoin = 'round';
	context.strokeStyle = 'rgba(0, 0, 0, 0.9)';
	context.strokeText( text, 12, 54 );
	context.fillStyle = '#ffffff';
	context.fillText( text, 12, 54 );

	const texture = new THREE.CanvasTexture( canvas );
	texture.colorSpace = THREE.SRGBColorSpace;

	const material = new THREE.SpriteMaterial( {
		map: texture,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		toneMapped: false
	} );

	const sprite = new THREE.Sprite( material );
	const aspectRatio = canvas.width / canvas.height;
	const labelHeight = Math.min( 0.1, 0.42 / aspectRatio );

	sprite.center.set( alignment === 'right' ? 1 : 0.5, 0.5 );
	sprite.position.set( x, y, positionZ );
	sprite.scale.set( aspectRatio * labelHeight, labelHeight, 1 );
	sprite.renderOrder = 1001;
	sprite.userData.markerRulerLabel = true;

	return sprite;

}

function removeRulerLabels( ruler ) {

	for ( const label of ruler.userData.markerRulerLabels ) {

		ruler.remove( label );
		label.material.map?.dispose();
		label.material.dispose();

	}

	ruler.userData.markerRulerLabels = [];

}

function updateMarkerRulerLabels( ruler, markerWidthCm ) {

	const markerWidthText = String( markerWidthCm ?? '' ).trim();
	const parsedWidthCm = markerWidthText === '' ? NaN : Number( markerWidthText );
	const widthCm = Number.isFinite( parsedWidthCm ) && parsedWidthCm > 0 ? parsedWidthCm : null;

	if ( ruler.userData.markerWidthCm === widthCm ) return;

	removeRulerLabels( ruler );

	function addLabel( text, x, y, alignment = 'center', positionZ = RULER_Z ) {

		const label = createLabelSprite( text, x, y, alignment, positionZ );
		ruler.add( label );
		ruler.userData.markerRulerLabels.push( label );

	}

	function getTickLabel( markerWidths ) {

		const markerValue = formatRulerNumber( markerWidths );

		return widthCm === null ?
			markerValue :
			`${ markerValue } (${ formatRulerNumber( markerWidths * widthCm ) } cm)`;

	}

	const rulerTickCount = RULER_EXTENT_MARKER_WIDTHS * TICKS_PER_MARKER_WIDTH;
	const majorTickInterval = MAJOR_TICK_INTERVAL * TICKS_PER_MARKER_WIDTH;

	for ( let tick = - rulerTickCount; tick <= rulerTickCount; tick += majorTickInterval ) {

		const markerWidths = tick / TICKS_PER_MARKER_WIDTH;
		const coordinate = MARKER_MIN + markerWidths * MARKER_WIDTH;

		addLabel( getTickLabel( Math.abs( markerWidths ) ), coordinate, - 0.70 );
		addLabel( getTickLabel( Math.abs( markerWidths ) ), - 0.62, coordinate, 'right' );

	}

	addLabel( 'X', RULER_MAX + 0.12, MARKER_MIN );
	addLabel( 'Z', MARKER_MIN, RULER_MAX + 0.12 );

	const yAxisBaseX = MARKER_MIN;
	const yAxisBaseY = MARKER_MIN;
	const yAxisLabelX = yAxisBaseX + 0.14;

	for ( let tick = 0; tick <= rulerTickCount; tick += majorTickInterval ) {

		const markerWidths = tick / TICKS_PER_MARKER_WIDTH;
		const coordinateZ = RULER_Z + markerWidths * MARKER_WIDTH;

		addLabel( getTickLabel( markerWidths ), yAxisLabelX, yAxisBaseY, 'center', coordinateZ );

	}

	addLabel(
		'Y',
		yAxisLabelX,
		yAxisBaseY,
		'center',
		RULER_Z + RULER_EXTENT_MARKER_WIDTHS * MARKER_WIDTH + 0.12
	);

	ruler.userData.markerWidthCm = widthCm;

}

function createMarkerRuler() {

	const ruler = new THREE.Group();
	const xAxisPositions = [];
	const zAxisPositions = [];
	const yAxisPositions = [];
	const horizontalAxisY = MARKER_MIN;
	const verticalAxisX = MARKER_MIN;
	const yAxisBaseX = MARKER_MIN;
	const yAxisBaseY = MARKER_MIN;
	const rulerTickCount = RULER_EXTENT_MARKER_WIDTHS * TICKS_PER_MARKER_WIDTH;
	const majorTickInterval = MAJOR_TICK_INTERVAL * TICKS_PER_MARKER_WIDTH;

	addRulerQuad( xAxisPositions, RULER_MIN, horizontalAxisY, RULER_MAX, horizontalAxisY, 0.006 );
	addRulerQuad( zAxisPositions, verticalAxisX, RULER_MIN, verticalAxisX, RULER_MAX, 0.006 );
	addRulerQuadXZ(
		yAxisPositions,
		yAxisBaseX,
		RULER_Z,
		yAxisBaseX,
		RULER_Z + RULER_EXTENT_MARKER_WIDTHS * MARKER_WIDTH,
		yAxisBaseY,
		0.006
	);

	for ( let tick = - rulerTickCount; tick <= rulerTickCount; tick ++ ) {

		const markerWidths = tick / TICKS_PER_MARKER_WIDTH;
		const coordinate = MARKER_MIN + markerWidths * MARKER_WIDTH;
		const isMajorTick = tick % majorTickInterval === 0;
		const tickLength = isMajorTick ? 0.08 : 0.045;
		const tickThickness = isMajorTick ? 0.005 : 0.003;

		addRulerQuad( xAxisPositions, coordinate, horizontalAxisY, coordinate, horizontalAxisY + tickLength, tickThickness );
		addRulerQuad( zAxisPositions, verticalAxisX, coordinate, verticalAxisX + tickLength, coordinate, tickThickness );

		if ( tick >= 0 ) {

			const coordinateZ = RULER_Z + markerWidths * MARKER_WIDTH;
			addRulerQuadXZ(
				yAxisPositions,
				yAxisBaseX,
				coordinateZ,
				yAxisBaseX + tickLength,
				coordinateZ,
				yAxisBaseY,
				tickThickness
			);

		}

	}

	function createAxisMarks( name, positions, color ) {

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );

		const material = new THREE.MeshBasicMaterial( {
			color: color,
			side: THREE.DoubleSide,
			depthTest: false,
			depthWrite: false,
			toneMapped: false
		} );

		const marks = new THREE.Mesh( geometry, material );
		marks.name = name;
		marks.renderOrder = 1000;

		return marks;

	}

	ruler.name = 'Editor Marker Ruler';
	ruler.userData.editorOnly = true;
	ruler.userData.markerRulerLabels = [];
	ruler.add( createAxisMarks( 'Marker Ruler X Axis', xAxisPositions, 0xff0000 ) );
	// The upright marker previews map local X/Y/Z to viewport X/-Z/Y.
	ruler.add( createAxisMarks( 'Marker Ruler Z Axis', zAxisPositions, 0x00e5ff ) );
	ruler.add( createAxisMarks( 'Marker Ruler Y Axis', yAxisPositions, 0x00ff00 ) );

	updateMarkerRulerLabels( ruler, '' );

	return ruler;

}

export { createMarkerRuler, updateMarkerRulerLabels };
