function Config() {

	const name = 'threejs-editor';

	const storage = {
		'language': 'en',

		'autosave': true,

		'project/title': '',
		'project/editable': false,
		'project/vr': false,

		'project/renderer/antialias': true,
		'project/renderer/shadows': true,
		'project/renderer/shadowType': 1, // PCF
		'project/renderer/toneMapping': 0, // NoToneMapping
		'project/renderer/toneMappingExposure': 1,
		'project/arMarkerApp/camera/fov': 70,
		'project/arMarkerApp/camera/near': 0.05,
		'project/arMarkerApp/camera/far': 1000,
		'project/arMarkerApp/source/sourceType': 'webcam',
		'project/arMarkerApp/context/cameraParametersUrl': './js/data/camera_para.dat',
		'project/arMarkerApp/context/detectionMode': 'mono',
		'project/arMarkerApp/marker/type': 'pattern',
		'project/arMarkerApp/marker/patternUrl': './js/data/lambda.patt',
		'project/arMarkerApp/marker/smooth': true,
		'project/arMarkerApp/marker/smoothCount': 5,
		'project/arMarkerApp/marker/smoothTolerance': 0.01,
		'project/arMarkerApp/marker/smoothThreshold': 2,

		'settings/history': false,
		'settings/viewport/lightingPreview': 'off',

		'settings/shortcuts/translate': 'w',
		'settings/shortcuts/rotate': 'e',
		'settings/shortcuts/scale': 'r',
		'settings/shortcuts/undo': 'z',
		'settings/shortcuts/focus': 'f'
	};

	if ( window.localStorage[ name ] === undefined ) {

		window.localStorage[ name ] = JSON.stringify( storage );

	} else {

		const data = JSON.parse( window.localStorage[ name ] );

		for ( const key in data ) {

			storage[ key ] = data[ key ];

		}

	}

	return {

		getKey: function ( key ) {

			return storage[ key ];

		},

		setKey: function () { // key, value, key, value ...

			for ( let i = 0, l = arguments.length; i < l; i += 2 ) {

				storage[ arguments[ i ] ] = arguments[ i + 1 ];

			}

			window.localStorage[ name ] = JSON.stringify( storage );

			console.log( '[' + /\d\d\:\d\d\:\d\d/.exec( new Date() )[ 0 ] + ']', 'Saved config to LocalStorage.' );

		},

		clear: function () {

			delete window.localStorage[ name ];

		}

	};

}

export { Config };
