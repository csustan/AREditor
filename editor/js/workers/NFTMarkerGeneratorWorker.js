self.global = self;

const nftModuleUrl = new URL( '../libs/nft/NftMarkerCreator_wasm.js', self.location.href );
const nftBaseUrl = new URL( '../libs/nft/', self.location.href );
const outputDirectories = [ '.', '/', '/output', '/tmp' ];
const outputExtensions = [ '.iset', '.fset', '.fset3', '.zft' ];

let nftModulePromise = null;

function getNftModule() {

	if ( nftModulePromise !== null ) return nftModulePromise;

	nftModulePromise = import( nftModuleUrl.href )
		.then( ( { default: createNftModule } ) => createNftModule( {
			locateFile( path ) {

				const fileName = path.split( '/' ).pop();
				return new URL( fileName, nftBaseUrl ).toString();

			}
		} ) )
		.catch( ( error ) => {

			nftModulePromise = null;
			throw error;

		} );

	return nftModulePromise;

}

function getDirectoryEntries( module, directory ) {

	try {

		return module.FS.readdir( directory ).filter( ( entry ) => entry !== '.' && entry !== '..' );

	} catch ( error ) {

		return [];

	}

}

function getFilePath( directory, fileName ) {

	if ( directory === '.' ) return fileName;
	if ( directory === '/' ) return `/${fileName}`;
	return `${directory}/${fileName}`;

}

function clearGeneratedFiles( module ) {

	for ( const directory of outputDirectories ) {

		for ( const fileName of getDirectoryEntries( module, directory ) ) {

			if ( !outputExtensions.some( ( extension ) => fileName.endsWith( extension ) ) ) continue;

			try {

				module.FS.unlink( getFilePath( directory, fileName ) );

			} catch ( error ) {}

		}

	}

}

function readGeneratedFiles( module, preferredBaseName ) {

	const outputSets = new Map();

	for ( const directory of outputDirectories ) {

		for ( const fileName of getDirectoryEntries( module, directory ) ) {

			const extension = outputExtensions.find( ( candidate ) => fileName.endsWith( candidate ) );

			if ( extension === undefined ) continue;

			const baseName = fileName.slice( 0, - extension.length );
			const key = `${directory}:${baseName}`;
			const outputSet = outputSets.get( key ) ?? { baseName, files: {} };
			outputSet.files[ extension ] = getFilePath( directory, fileName );
			outputSets.set( key, outputSet );

		}

	}

	const completeSets = Array.from( outputSets.values() ).filter( ( outputSet ) =>
		outputSet.files[ '.iset' ] !== undefined &&
		outputSet.files[ '.fset' ] !== undefined &&
		outputSet.files[ '.fset3' ] !== undefined
	);
	const selectedSet = completeSets.find( ( outputSet ) => outputSet.baseName === preferredBaseName ) ?? completeSets[ 0 ];

	if ( selectedSet === undefined ) {

		throw new Error( 'The NFT generator did not produce a complete .iset/.fset/.fset3 dataset.' );

	}

	function readFile( extension ) {

		const path = selectedSet.files[ extension ];
		return path === undefined ? null : module.FS.readFile( path ).slice();

	}

	return {
		iset: readFile( '.iset' ),
		fset: readFile( '.fset' ),
		fset3: readFile( '.fset3' ),
		zft: readFile( '.zft' )
	};

}

async function generateNftMarker( request ) {

	const { imageBuffer, width, height, options, requestId } = request;

	if ( !( imageBuffer instanceof ArrayBuffer ) ) throw new Error( 'NFT image pixels were not transferred to the worker.' );
	if ( !Number.isInteger( width ) || width <= 0 || !Number.isInteger( height ) || height <= 0 ) {

		throw new Error( 'NFT image dimensions are invalid.' );

	}
	if ( imageBuffer.byteLength !== width * height * 4 ) throw new Error( 'NFT image pixel data is incomplete.' );

	const module = await getNftModule();
	const outputBasePath = `nft-worker-${requestId}`;
	const paramString =
		`0 ${outputBasePath}` +
		` -dpi=${options.dpi}` +
		` -level=${options.level}` +
		` -leveli=${options.leveli}` +
		` -sd_thresh=${options.sd_thresh}` +
		` -max_thresh=${options.max_thresh}` +
		` -min_thresh=${options.min_thresh}` +
		` -feature_density=${options.feature_density}` +
		( options.zft ? ' -zft' : '' );

	if ( typeof module._createImageSet !== 'function' ) {

		throw new Error( '_createImageSet is not exported by the NFT WASM module.' );

	}

	let parameterPointer = null;
	let imagePointer = null;

	clearGeneratedFiles( module );

	try {

		const parameterBytes = new TextEncoder().encode( paramString );
		parameterPointer = module._malloc( parameterBytes.length + 1 );

		if ( parameterPointer === 0 ) throw new Error( 'Unable to allocate NFT generator parameters.' );

		module.HEAPU8.set( parameterBytes, parameterPointer );
		module.HEAPU8[ parameterPointer + parameterBytes.length ] = 0;

		const rgba = new Uint8ClampedArray( imageBuffer );
		const rgbLength = width * height * 3;
		imagePointer = module._malloc( rgbLength );

		if ( imagePointer === 0 ) throw new Error( 'Unable to allocate NFT image data.' );

		const heap = module.HEAPU8;

		for ( let sourceIndex = 0, targetIndex = imagePointer; sourceIndex < rgba.length; sourceIndex += 4 ) {

			heap[ targetIndex ++ ] = rgba[ sourceIndex ];
			heap[ targetIndex ++ ] = rgba[ sourceIndex + 1 ];
			heap[ targetIndex ++ ] = rgba[ sourceIndex + 2 ];

		}

		module._createImageSet( imagePointer, options.dpi, width, height, 3, parameterPointer );
		if ( typeof module._fflush === 'function' ) module._fflush( 0 );

		return readGeneratedFiles( module, outputBasePath );

	} finally {

		if ( parameterPointer !== null ) module._free( parameterPointer );
		if ( imagePointer !== null ) module._free( imagePointer );
		clearGeneratedFiles( module );

	}

}

function serializeError( error ) {

	return {
		message: error instanceof Error ? error.message : String( error ),
		stack: error instanceof Error ? error.stack : undefined
	};

}

self.addEventListener( 'message', async ( event ) => {

	if ( event.data?.type !== 'generate' ) return;

	const requestId = event.data.requestId;

	try {

		const output = await generateNftMarker( event.data );
		const message = {
			type: 'generated',
			requestId,
			iset: output.iset.buffer,
			fset: output.fset.buffer,
			fset3: output.fset3.buffer,
			zft: output.zft?.buffer ?? null
		};
		const transfer = [ message.iset, message.fset, message.fset3 ];

		if ( message.zft !== null ) transfer.push( message.zft );

		self.postMessage( message, transfer );

	} catch ( error ) {

		self.postMessage( {
			type: 'error',
			requestId,
			error: serializeError( error )
		} );

	}

} );