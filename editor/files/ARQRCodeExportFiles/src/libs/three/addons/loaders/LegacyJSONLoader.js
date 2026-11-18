import {
	AdditiveBlending,
	BackSide,
	BufferGeometry,
	Color,
	CustomBlending,
	DoubleSide,
	FileLoader,
	Float32BufferAttribute,
	FrontSide,
	Loader,
	LoaderUtils,
	MeshBasicMaterial,
	MeshLambertMaterial,
	MeshPhongMaterial,
	MeshStandardMaterial,
	MirroredRepeatWrapping,
	MultiplyBlending,
	NoBlending,
	NormalBlending,
	RepeatWrapping,
	SRGBColorSpace,
	SubtractiveBlending,
	TextureLoader,
	Vector2
} from '../../three.module.js';

const blendingModes = {
	NoBlending,
	NormalBlending,
	AdditiveBlending,
	SubtractiveBlending,
	MultiplyBlending,
	CustomBlending
};

const materialTextureMaps = [
	{ key: 'mapDiffuse', slot: 'map', colorSpace: true },
	{ key: 'mapEmissive', slot: 'emissiveMap', colorSpace: true },
	{ key: 'mapLight', slot: 'lightMap' },
	{ key: 'mapAO', slot: 'aoMap' },
	{ key: 'mapBump', slot: 'bumpMap' },
	{ key: 'mapNormal', slot: 'normalMap' },
	{ key: 'mapSpecular', slot: 'specularMap' },
	{ key: 'mapMetalness', slot: 'metalnessMap' },
	{ key: 'mapRoughness', slot: 'roughnessMap' },
	{ key: 'mapAlpha', slot: 'alphaMap' }
];

function assertIndex( index, length, label ) {

	if ( ! Number.isInteger( index ) || index < 0 || index >= length ) {

		throw new RangeError( 'Legacy JSON contains an invalid ' + label + ' index: ' + index );

	}

}

function getColor( colors, index ) {

	assertIndex( index, colors.length, 'color' );
	return new Color( colors[ index ] );

}

function createMaterial( definition, texturePath, manager ) {

	const shading = typeof definition.shading === 'string' ? definition.shading.toLowerCase() : 'lambert';
	let MaterialConstructor = MeshLambertMaterial;

	if ( shading === 'basic' ) MaterialConstructor = MeshBasicMaterial;
	if ( shading === 'phong' ) MaterialConstructor = MeshPhongMaterial;
	if ( shading === 'standard' ) MaterialConstructor = MeshStandardMaterial;

	const diffuse = Array.isArray( definition.colorDiffuse )
		? new Color().fromArray( definition.colorDiffuse )
		: new Color( definition.colorDiffuse === undefined ? 0xffffff : definition.colorDiffuse );
	const opacityValue = definition.opacity === undefined ? definition.transparency : definition.opacity;
	const opacity = opacityValue === undefined ? 1 : Number( opacityValue );

	if ( ! Number.isFinite( opacity ) ) {

		throw new TypeError( 'Legacy JSON material has an invalid opacity value.' );

	}

	const parameters = {
		name: definition.DbgName || definition.name || '',
		color: diffuse,
		side: definition.doubleSided ? DoubleSide : definition.flipSided ? BackSide : FrontSide,
		opacity,
		transparent: definition.transparent === undefined ? opacity < 1 : definition.transparent,
		visible: definition.visible === undefined ? true : definition.visible,
		depthTest: definition.depthTest === undefined ? true : definition.depthTest,
		depthWrite: definition.depthWrite === undefined ? true : definition.depthWrite,
		colorWrite: definition.colorWrite === undefined ? true : definition.colorWrite,
		wireframe: definition.wireframe === undefined ? false : definition.wireframe,
		vertexColors: definition.vertexColors === true || definition.vertexColors === 'face'
	};

	if ( shading !== 'basic' && definition.colorEmissive !== undefined ) {

		parameters.emissive = Array.isArray( definition.colorEmissive )
			? new Color().fromArray( definition.colorEmissive )
			: new Color( definition.colorEmissive );

	}

	if ( shading === 'phong' ) {

		if ( definition.colorSpecular !== undefined ) {

			parameters.specular = Array.isArray( definition.colorSpecular )
				? new Color().fromArray( definition.colorSpecular )
				: new Color( definition.colorSpecular );

		}

		if ( definition.specularCoef !== undefined ) parameters.shininess = definition.specularCoef;

	}

	if ( shading === 'standard' ) {

		parameters.metalness = definition.metalness === undefined ? 0 : definition.metalness;
		parameters.roughness = definition.roughness === undefined ? 1 : definition.roughness;

	}

	if ( definition.reflectivity !== undefined ) parameters.reflectivity = definition.reflectivity;

	if ( typeof definition.blending === 'string' && Object.prototype.hasOwnProperty.call( blendingModes, definition.blending ) ) {

		parameters.blending = blendingModes[ definition.blending ];

	}

	const textureLoader = new TextureLoader( manager );
	textureLoader.setPath( texturePath );

	for ( const textureMap of materialTextureMaps ) {

		const textureName = definition[ textureMap.key ];
		if ( typeof textureName !== 'string' || textureName === '' ) continue;

		const texture = textureLoader.load( textureName );

		if ( textureMap.colorSpace ) texture.colorSpace = SRGBColorSpace;

		const repeat = definition[ textureMap.key + 'Repeat' ];
		if ( Array.isArray( repeat ) && repeat.length >= 2 ) {

			texture.repeat.set( repeat[ 0 ], repeat[ 1 ] );
			if ( repeat[ 0 ] !== 1 ) texture.wrapS = RepeatWrapping;
			if ( repeat[ 1 ] !== 1 ) texture.wrapT = RepeatWrapping;

		}

		const offset = definition[ textureMap.key + 'Offset' ];
		if ( Array.isArray( offset ) && offset.length >= 2 ) texture.offset.set( offset[ 0 ], offset[ 1 ] );

		const wrap = definition[ textureMap.key + 'Wrap' ];
		if ( Array.isArray( wrap ) ) {

			if ( wrap[ 0 ] === 'repeat' ) texture.wrapS = RepeatWrapping;
			if ( wrap[ 0 ] === 'mirror' ) texture.wrapS = MirroredRepeatWrapping;
			if ( wrap[ 1 ] === 'repeat' ) texture.wrapT = RepeatWrapping;
			if ( wrap[ 1 ] === 'mirror' ) texture.wrapT = MirroredRepeatWrapping;

		}

		const anisotropy = definition[ textureMap.key + 'Anisotropy' ];
		if ( Number.isFinite( anisotropy ) ) texture.anisotropy = anisotropy;

		texture.needsUpdate = true;
		parameters[ textureMap.slot ] = texture;

	}

	if ( Number.isFinite( definition.mapBumpScale ) ) parameters.bumpScale = definition.mapBumpScale;
	if ( Number.isFinite( definition.mapNormalFactor ) ) {

		parameters.normalScale = new Vector2( definition.mapNormalFactor, definition.mapNormalFactor );

	}

	return new MaterialConstructor( parameters );

}

function parseGeometry( data ) {

	const vertices = data.vertices;
	const faces = data.faces;
	const normals = Array.isArray( data.normals ) ? data.normals : [];
	const colors = Array.isArray( data.colors ) ? data.colors : [];
	const materials = Array.isArray( data.materials ) ? data.materials : [];
	const uvLayers = Array.isArray( data.uvs )
		? data.uvs.filter( function ( layer ) {

			return Array.isArray( layer ) && layer.length > 0;

		} )
		: [];

	if ( ! Array.isArray( vertices ) || vertices.length === 0 || vertices.length % 3 !== 0 ) {

		throw new TypeError( 'Legacy JSON must contain a non-empty vertex array with XYZ triples.' );

	}

	if ( ! Array.isArray( faces ) || faces.length === 0 ) {

		throw new TypeError( 'Legacy JSON must contain a non-empty face array.' );

	}

	if ( normals.length % 3 !== 0 ) throw new TypeError( 'Legacy JSON contains an invalid normal array.' );

	for ( const layer of uvLayers ) {

		if ( layer.length % 2 !== 0 ) throw new TypeError( 'Legacy JSON contains an invalid UV layer.' );

	}

	const scaleDenominator = data.scale === undefined ? 1 : Number( data.scale );
	if ( ! Number.isFinite( scaleDenominator ) || scaleDenominator === 0 ) {

		throw new TypeError( 'Legacy JSON contains an invalid scale value.' );

	}

	const scale = 1 / scaleDenominator;
	const positionValues = [];
	const normalValues = [];
	const colorValues = [];
	const uvValues = uvLayers.map( function () {

		return [];

	} );
	const hasUvs = uvLayers.map( function () {

		return false;

	} );
	let hasColors = false;
	let offset = 0;
	let currentMaterialIndex = null;
	let groupStart = 0;
	const geometry = new BufferGeometry();

	function readFaceIndex( label ) {

		if ( offset >= faces.length ) throw new TypeError( 'Legacy JSON face data ended while reading ' + label + '.' );

		const index = faces[ offset ++ ];
		if ( ! Number.isInteger( index ) || index < 0 ) throw new TypeError( 'Legacy JSON contains an invalid ' + label + ' index.' );
		return index;

	}

	function getVertex( index ) {

		assertIndex( index, vertices.length / 3, 'vertex' );
		const vertexOffset = index * 3;
		const vertex = [
			vertices[ vertexOffset ] * scale,
			vertices[ vertexOffset + 1 ] * scale,
			vertices[ vertexOffset + 2 ] * scale
		];

		if ( ! vertex.every( Number.isFinite ) ) throw new TypeError( 'Legacy JSON contains a non-finite vertex.' );
		return vertex;

	}

	function getNormal( index ) {

		assertIndex( index, normals.length / 3, 'normal' );
		const normalOffset = index * 3;
		return [ normals[ normalOffset ], normals[ normalOffset + 1 ], normals[ normalOffset + 2 ] ];

	}

	function getUv( layerIndex, index ) {

		const layer = uvLayers[ layerIndex ];
		assertIndex( index, layer.length / 2, 'UV' );
		const uvOffset = index * 2;
		return [ layer[ uvOffset ], layer[ uvOffset + 1 ] ];

	}

	function calculateFaceNormal( a, b, c ) {

		const ab = [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ];
		const ac = [ c[ 0 ] - a[ 0 ], c[ 1 ] - a[ 1 ], c[ 2 ] - a[ 2 ] ];
		const normal = [
			ab[ 1 ] * ac[ 2 ] - ab[ 2 ] * ac[ 1 ],
			ab[ 2 ] * ac[ 0 ] - ab[ 0 ] * ac[ 2 ],
			ab[ 0 ] * ac[ 1 ] - ab[ 1 ] * ac[ 0 ]
		];
		const length = Math.hypot( normal[ 0 ], normal[ 1 ], normal[ 2 ] );

		if ( length > 0 ) {

			normal[ 0 ] /= length;
			normal[ 1 ] /= length;
			normal[ 2 ] /= length;

		}

		return normal;

	}

	function emitTriangle( face, corners ) {

		const materialIndex = face.materialIndex === undefined ? 0 : face.materialIndex;
		if ( materials.length > 0 && materialIndex >= materials.length ) {

			throw new RangeError( 'Legacy JSON face references a missing material: ' + materialIndex );

		}

		if ( currentMaterialIndex === null ) {

			currentMaterialIndex = materialIndex;
			groupStart = positionValues.length / 3;

		} else if ( materialIndex !== currentMaterialIndex ) {

			geometry.addGroup( groupStart, positionValues.length / 3 - groupStart, currentMaterialIndex );
			groupStart = positionValues.length / 3;
			currentMaterialIndex = materialIndex;

		}

		const triangleVertices = corners.map( function ( corner ) {

			return getVertex( face.vertexIndices[ corner ] );

		} );
		const flatNormal = calculateFaceNormal( triangleVertices[ 0 ], triangleVertices[ 1 ], triangleVertices[ 2 ] );

		for ( let cornerIndex = 0; cornerIndex < corners.length; cornerIndex ++ ) {

			const sourceCorner = corners[ cornerIndex ];
			const vertex = triangleVertices[ cornerIndex ];
			positionValues.push( vertex[ 0 ], vertex[ 1 ], vertex[ 2 ] );

			const normal = face.vertexNormalIndices === undefined
				? flatNormal
				: getNormal( face.vertexNormalIndices[ sourceCorner ] );
			normalValues.push( normal[ 0 ], normal[ 1 ], normal[ 2 ] );

			for ( let layerIndex = 0; layerIndex < uvLayers.length; layerIndex ++ ) {

				const layerIndices = face.uvIndicesByLayer;
				if ( layerIndices !== undefined && layerIndices[ layerIndex ] !== undefined ) {

					const uv = getUv( layerIndex, layerIndices[ layerIndex ][ sourceCorner ] );
					uvValues[ layerIndex ].push( uv[ 0 ], uv[ 1 ] );
					hasUvs[ layerIndex ] = true;

				} else {

					uvValues[ layerIndex ].push( 0, 0 );

				}

			}

			const colorIndex = face.vertexColorIndices === undefined
				? face.faceColorIndex
				: face.vertexColorIndices[ sourceCorner ];

			if ( colorIndex === undefined ) {

				colorValues.push( 1, 1, 1 );

			} else {

				const color = getColor( colors, colorIndex );
				colorValues.push( color.r, color.g, color.b );
				hasColors = true;

			}

		}

	}

	while ( offset < faces.length ) {

		const type = faces[ offset ++ ];
		if ( ! Number.isInteger( type ) || type < 0 || ( type & ~ 255 ) !== 0 ) {

			throw new TypeError( 'Legacy JSON contains an unsupported face type.' );

		}

		const isQuad = ( type & 1 ) !== 0;
		const face = {
			vertexIndices: [],
			materialIndex: undefined,
			uvIndicesByLayer: undefined,
			vertexNormalIndices: undefined,
			faceColorIndex: undefined,
			vertexColorIndices: undefined
		};
		const cornerCount = isQuad ? 4 : 3;

		for ( let i = 0; i < cornerCount; i ++ ) face.vertexIndices.push( readFaceIndex( 'vertex' ) );

		if ( ( type & 2 ) !== 0 ) face.materialIndex = readFaceIndex( 'material' );

		if ( ( type & 8 ) !== 0 && uvLayers.length > 0 ) {

			face.uvIndicesByLayer = [];

			for ( let layerIndex = 0; layerIndex < uvLayers.length; layerIndex ++ ) {

				const indices = [];
				for ( let i = 0; i < cornerCount; i ++ ) {

					const uvIndex = readFaceIndex( 'UV' );
					assertIndex( uvIndex, uvLayers[ layerIndex ].length / 2, 'UV' );
					indices.push( uvIndex );

				}

				face.uvIndicesByLayer.push( indices );

			}

		}

		if ( ( type & 16 ) !== 0 ) {

			getNormal( readFaceIndex( 'normal' ) );

		}

		if ( ( type & 32 ) !== 0 ) {

			face.vertexNormalIndices = [];
			for ( let i = 0; i < cornerCount; i ++ ) {

				const normalIndex = readFaceIndex( 'normal' );
				getNormal( normalIndex );
				face.vertexNormalIndices.push( normalIndex );

			}

		}

		if ( ( type & 64 ) !== 0 ) {

			face.faceColorIndex = readFaceIndex( 'color' );
			getColor( colors, face.faceColorIndex );

		}

		if ( ( type & 128 ) !== 0 ) {

			face.vertexColorIndices = [];
			for ( let i = 0; i < cornerCount; i ++ ) {

				const colorIndex = readFaceIndex( 'color' );
				getColor( colors, colorIndex );
				face.vertexColorIndices.push( colorIndex );

			}

		}

		if ( isQuad ) {

			emitTriangle( face, [ 0, 1, 3 ] );
			emitTriangle( face, [ 1, 2, 3 ] );

		} else {

			emitTriangle( face, [ 0, 1, 2 ] );

		}

	}

	geometry.addGroup( groupStart, positionValues.length / 3 - groupStart, currentMaterialIndex );
	geometry.setAttribute( 'position', new Float32BufferAttribute( positionValues, 3 ) );
	geometry.setAttribute( 'normal', new Float32BufferAttribute( normalValues, 3 ) );

	for ( let layerIndex = 0; layerIndex < uvLayers.length; layerIndex ++ ) {

		if ( hasUvs[ layerIndex ] ) {

			const attributeName = layerIndex === 0 ? 'uv' : 'uv' + ( layerIndex + 1 );
			geometry.setAttribute( attributeName, new Float32BufferAttribute( uvValues[ layerIndex ], 2 ) );

		}

	}

	if ( hasColors ) geometry.setAttribute( 'color', new Float32BufferAttribute( colorValues, 3 ) );

	return geometry;

}

class LegacyJSONLoader extends Loader {

	load( url, onLoad, onProgress, onError ) {

		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setResponseType( 'text' );
		loader.setWithCredentials( this.withCredentials );
		loader.load( url, ( text ) => {

			let result;

			try {

				const modelUrl = this.path ? this.path + url : url;
				const resourcePath = this.resourcePath || LoaderUtils.extractUrlBase( modelUrl );
				result = this.parse( JSON.parse( text ), resourcePath );

			} catch ( error ) {

				if ( onError ) {

					onError( error );

				} else {

					console.error( 'THREE.LegacyJSONLoader:', error );

				}

				return;

			}

			onLoad( result.geometry, result.materials );

		}, onProgress, onError );

	}

	parse( json, path = '' ) {

		if ( ! json || typeof json !== 'object' ) throw new TypeError( 'Legacy JSON must be an object.' );
		if ( json.metadata && typeof json.metadata.type === 'string' && json.metadata.type.toLowerCase() === 'object' ) {

			throw new TypeError( 'Three.js object JSON must be loaded with ObjectLoader.' );

		}

		const data = json.data && typeof json.data === 'object' ? json.data : json;
		const geometry = parseGeometry( data );
		const materialDefinitions = Array.isArray( data.materials ) ? data.materials : [];
		const materials = materialDefinitions.map( function ( definition ) {

			return createMaterial( definition, path, this.manager );

		}, this );

		return { geometry, materials };

	}

}

export { LegacyJSONLoader };
