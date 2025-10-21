import * as THREE from 'three';

import { zipSync, strToU8, ZipPassThrough } from 'three/addons/libs/fflate.module.js';// use Uint8Array(content); for the binary camera_para.dat file
import { AddObjectCommand } from './commands/AddObjectCommand.js'; //needed for creating the objects in the default template
//For now, import on the index.html
////import * as JSZip from './libs/jszip.js' //'../examples/jsm/libs/jszip.js'; // replacing fflate.module.js with JSZip since fflate doesn't support binary files, like the camera_para.dat
//import JSZip from './libs/jszip.js' ; 
////import JSZip from './libs/jszip.min.js' ; 

//SaveAs for saving the JSZip zipped file
//import { saveAs } from './libs/FileSaver.js';
import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js';

function MenubarFile(editor) {

	const config = editor.config;
	const strings = editor.strings;

	const container = new UIPanel();
	container.setClass('menu');

	const title = new UIPanel();
	title.setClass('title');
	title.setTextContent(strings.getKey('menubar/file'));
	container.add(title);

	const options = new UIPanel();
	options.setClass('options');
	container.add(options);

	// New Default Template menu option

	let option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/new'));
	option.onClick(function () {

		if (confirm('Any unsaved data will be lost, and the Default Template will be loaded. Are you sure?')) {

			editor.clear(); //flaging that this is a New rather than a Clear //removing the flag and moving the scene objects/light generation to this function

			const markerPlaneGeometry = new THREE.PlaneGeometry(1, 1);

			// Load the image texture
			const markerTextureLoader = new THREE.TextureLoader();
			const markerTexture = markerTextureLoader.load('files/markerForScale.png');

			// Create a material with the image texture
			const markerMaterial = new THREE.MeshBasicMaterial({ map: markerTexture });

			// Create a mesh using the plane geometry and material
			const markerPlane = new THREE.Mesh(markerPlaneGeometry, markerMaterial);

			//Add a "isPreloaded" tag to filter tag the mesh to be filtered out at export
			//markerPlane.isPreloaded = true;

			//Name the plane something that can be tracked:
			markerPlane.name = "DefaultMarkerPlaneForScale"

			// Rotate the plane to make it face up (parallel to the ground)
			markerPlane.rotation.x = -Math.PI / 2;

			//	editor.execute( new AddObjectCommand( editor, mesh ) );
			//this.scene.add(markerPlane);
			editor.execute(new AddObjectCommand(editor, markerPlane));

			//Add all the lights
			//Set up light so the WebGL rendered objects will be visible
			//Gnerarate the light.
			//in this case, an ambient liight with the color set to Gray80  (hex code CC CC CC), and a mid-level intensity -- 50%
			const defaultAmbientLight1 = new THREE.AmbientLight(0xcccccc, .25);
			//Name the light:
			defaultAmbientLight1.name = "Default Ambient Light 1";

			//Add the light to the scene so it will exisit in the same space as the rendered objects
			//this.scene.add( defaultAmbientLight1 );
			editor.execute(new AddObjectCommand(editor, defaultAmbientLight1));

			const defaultAmbientLight2 = new THREE.AmbientLight(0xffffff, 0.25);
			defaultAmbientLight2.name = "Default Ambient Light 2";
			// Add the ambient light to the scene
			//this.scene.add(defaultAmbientLight2);
			editor.execute(new AddObjectCommand(editor, defaultAmbientLight2));

			// Create a new directional light to simulate sunlight
			// Parameters:
			// - color: The color of the light
			// - intensity: The strength of the light

			const defaultDirectionalLight1 = new THREE.DirectionalLight(0xffffff, .25);

			//Name the default directional light:
			defaultDirectionalLight1.name = "Default Directional Light 1"

			// Set the direction of the light
			defaultDirectionalLight1.position.set(1, 1, 1).normalize();

			// Add the direcyional light to the scene
			//this.scene.add(defaultDirectionalLight1);
			editor.execute(new AddObjectCommand(editor, defaultDirectionalLight1));

		}

	});
	options.add(option);

	//

	options.add(new UIHorizontalRule());

	// New Blank menu option

	option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/newBlank'));
	option.onClick(function () {

		if (confirm('Any unsaved data will be lost. Are you sure?')) {

			editor.clear(); //do not pass the true flag to simply Clear everything

		}

	});
	options.add(option);

	//

	options.add(new UIHorizontalRule());

	// Import

	// Import

	const form = document.createElement('form');
	form.style.display = 'none';
	document.body.appendChild(form);

	const fileInput = document.createElement('input');
	fileInput.multiple = true;
	fileInput.type = 'file';
	fileInput.addEventListener('change', function () {

		editor.loader.loadFiles(fileInput.files);
		form.reset();

	});
	form.appendChild(fileInput);

	option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/import'));
	option.onClick(function () {

		fileInput.click();

	});
	options.add(option);

	//

	options.add(new UIHorizontalRule());

	// Export Geometry

	option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/export/geometry'));
	option.onClick(function () {

		const object = editor.selected;

		if (object === null) {

			alert('No object selected.');
			return;

		}

		const geometry = object.geometry;

		if (geometry === undefined) {

			alert('The selected object doesn\'t have geometry.');
			return;

		}

		let output = geometry.toJSON();

		try {

			output = JSON.stringify(output, null, '\t');
			output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, '$1');

		} catch (e) {

			output = JSON.stringify(output);

		}

		saveString(output, 'geometry.json');

	});
	options.add(option);

	// Export Object

	option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/export/object'));
	option.onClick(function () {

		const object = editor.selected;

		if (object === null) {

			alert('No object selected');
			return;

		}

		let output = object.toJSON();

		try {

			output = JSON.stringify(output, null, '\t');
			output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, '$1');

		} catch (e) {

			output = JSON.stringify(output);

		}

		saveString(output, 'model.json');

	});
	options.add(option);

	// Export Scene

	option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/export/scene'));
	option.onClick(function () {

		let output = editor.scene.toJSON();

		try {

			output = JSON.stringify(output, null, '\t');
			output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, '$1');

		} catch (e) {

			output = JSON.stringify(output);

		}

		saveString(output, 'scene.json');

	});
	options.add(option);

	//

	options.add(new UIHorizontalRule());

	//The AR Template needs either GLBs or GLTFs. Diabling all other exports.
	// Export DRC
	/*
	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/file/export/drc' ) );
	option.onClick( async function () {

		const object = editor.selected;

		if ( object === null || object.isMesh === undefined ) {

			alert( 'No mesh selected' );
			return;

		}

		const { DRACOExporter } = await import( 'three/addons/exporters/DRACOExporter.js' );

		const exporter = new DRACOExporter();

		const options = {
			decodeSpeed: 5,
			encodeSpeed: 5,
			encoderMethod: DRACOExporter.MESH_EDGEBREAKER_ENCODING,
			quantization: [ 16, 8, 8, 8, 8 ],
			exportUvs: true,
			exportNormals: true,
			exportColor: object.geometry.hasAttribute( 'color' )
		};

		// TODO: Change to DRACOExporter's parse( geometry, onParse )?
		const result = exporter.parse( object, options );
		saveArrayBuffer( result, 'model.drc' );

	} );
	options.add( option );
	//*/

	// Export GLB

	option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/export/glb'));
	option.onClick(async function () {

		const scene = editor.scene;
		const animations = getAnimations(scene);

		const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

		const exporter = new GLTFExporter();

		exporter.parse(scene, function (result) {

			saveArrayBuffer(result, 'scene.glb');

		}, undefined, { binary: true, animations: animations });

	});
	options.add(option);

	// Export GLTF

	option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/export/gltf'));
	option.onClick(async function () {

		const scene = editor.scene;
		const animations = getAnimations(scene);

		const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

		//Start test code
		// Get the current script element
		// Get the current script element

		//document.currentScript is not reliable. It can return null, especially when the code is asynchronously executed or the script is dynamically imported.
		//Replace:
		//const scriptElement = document.currentScript;
		//
		//// Get the source attribute of the script element
		//const scriptSource = scriptElement.getAttribute('src');
		//
		//// Get the directory of the script by extracting the path
		//const scriptDirectory = scriptSource.substring(0, scriptSource.lastIndexOf('/'));
		//
		//console.log('Script directory:', scriptDirectory);

		//With this defensive version:

		// Attempt to retrieve the currently executing <script> element.
		// This works in synchronous, non-module script execution contexts.
		const scriptElement = document.currentScript;

		// Check if the script element was found.
		if (scriptElement) {

			// Get the value of the "src" attribute from the script tag.
			// This is the full path to the JS file (e.g., "js/Menubar.File.js").
			const scriptSource = scriptElement.getAttribute('src');

			// Extract the directory portion of the script's path.
			// For example, if scriptSource is "js/Menubar.File.js", this gives "js".
			const scriptDirectory = scriptSource.substring(0, scriptSource.lastIndexOf('/'));

			// Output the directory to the console for debugging or logging purposes.
			console.log('Script directory:', scriptDirectory);

		} else {

			// If document.currentScript returned null, log a warning.
			// This typically happens when the code is running asynchronously or in a module context.
			console.warn('Unable to determine script directory: document.currentScript is null.');

		}


		//End test code

		const exporter = new GLTFExporter();

		exporter.parse(scene, function (result) {

			saveString(JSON.stringify(result, null, 2), 'scene.gltf');

		}, undefined, { animations: animations });


	});
	options.add(option);

	//The AR Template needs either GLBs or GLTFs. Diabling all other exports.
	// Export OBJ 
	/*
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/file/export/obj' ) );
		option.onClick( async function () {
	
			const object = editor.selected;
	
			if ( object === null ) {
	
				alert( 'No object selected.' );
				return;
	
			}
	
			const { OBJExporter } = await import( 'three/addons/exporters/OBJExporter.js' );
	
			const exporter = new OBJExporter();
	
			saveString( exporter.parse( object ), 'model.obj' );
	
		} );
		options.add( option );
	
		// Export PLY (ASCII)
	
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/file/export/ply' ) );
		option.onClick( async function () {
	
			const { PLYExporter } = await import( 'three/addons/exporters/PLYExporter.js' );
	
			const exporter = new PLYExporter();
	
			exporter.parse( editor.scene, function ( result ) {
	
				saveArrayBuffer( result, 'model.ply' );
	
			} );
	
		} );
		options.add( option );
	
		// Export PLY (Binary)
	
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/file/export/ply_binary' ) );
		option.onClick( async function () {
	
			const { PLYExporter } = await import( 'three/addons/exporters/PLYExporter.js' );
	
			const exporter = new PLYExporter();
	
			exporter.parse( editor.scene, function ( result ) {
	
				saveArrayBuffer( result, 'model-binary.ply' );
	
			}, { binary: true } );
	
		} );
		options.add( option );
	
		// Export STL (ASCII)
	
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/file/export/stl' ) );
		option.onClick( async function () {
	
			const { STLExporter } = await import( 'three/addons/exporters/STLExporter.js' );
	
			const exporter = new STLExporter();
	
			saveString( exporter.parse( editor.scene ), 'model.stl' );
	
		} );
		options.add( option );
	
		// Export STL (Binary)
	
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/file/export/stl_binary' ) );
		option.onClick( async function () {
	
			const { STLExporter } = await import( 'three/addons/exporters/STLExporter.js' );
	
			const exporter = new STLExporter();
	
			saveArrayBuffer( exporter.parse( editor.scene, { binary: true } ), 'model-binary.stl' );
	
		} );
		options.add( option );
	
		// Export USDZ
	
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/file/export/usdz' ) );
		option.onClick( async function () {
	
			const { USDZExporter } = await import( 'three/addons/exporters/USDZExporter.js' );
	
			const exporter = new USDZExporter();
	
			saveArrayBuffer( await exporter.parse( editor.scene ), 'model.usdz' );
	
		} );
		options.add( option );
	
		//
	
		options.add( new UIHorizontalRule() );
		//*/ //End diabling of file menu options

//Start Publish AR App
	//Edited to export as an ARJS Template
	option = new UIRow();
	option.setClass('option');
	option.setTextContent(strings.getKey('menubar/file/publish_ar'));
	//option.onClick(function () {
	option.onClick(async function () { //The use of the improved AR Marker generator requires await, which means the function needs to be an async
		//Setup a storage location for the index.html and the json.app file content
		const toZip = {};



		//prepare to build the app.json file for export
		let output = editor.toJSON();
		output.metadata.type = 'App';
		delete output.history;

		output = JSON.stringify(output, null, '\t');
		output = output.replace(/[\n\t]+([\d\.e\-\[\]]+)/g, '$1');

		//toZip['app.json'] = strToU8(output); //originally, the output needed to be encoded with a libarary. Now, we're using the JSZip.js Library, which can handle the encoding itself.
		toZip['app.json'] = output; //store the raw output

		const appTitle = config.getKey('project/title') || 'AR Web App';

		//Adjust the template index.html to have the corrected title, etc.

		//This is the process for the "publish" zip
		//const loader = new THREE.FileLoader(manager); no longer using the THREE.LoadingManager with THREE.FileLoader
		const loader = new THREE.FileLoader();

		//loader.load('js/libs/app/index.html', function (content) {
		loader.load('../editor/files/exportFiles/index.html', function (content) {

			content = content.replace('<!-- title -->', appTitle);

			const includes = [];

			content = content.replace('<!-- includes -->', includes.join('\n\t\t'));

			let editButton = '';

			if (config.getKey('project/editable')) {

				editButton = [
					'			let button = document.createElement( \'a\' );',
					'			button.href = \'https://threejs.org/editor/#file=\' + location.href.split( \'/\' ).slice( 0, - 1 ).join( \'/\' ) + \'/app.json\';',
					'			button.style.cssText = \'position: absolute; bottom: 20px; right: 20px; padding: 10px 16px; color: #fff; border: 1px solid #fff; border-radius: 20px; text-decoration: none;\';',
					'			button.target = \'_blank\';',
					'			button.textContent = \'EDIT\';',
					'			document.body.appendChild( button );',
				].join('\n');

			}

			content = content.replace('\t\t\t/* edit button ', editButton);

			//toZip['index.html'] = strToU8(content);
			toZip['index.html'] = content;

		});


		//Building a JSZip
		//Test that JZZip Loaded:
		// Function to probe the JSZip library
		function probeJSZip() {
			if (typeof JSZip !== 'undefined') {
				console.log('JSZip is defined.');
				console.log('Type of JSZip:', typeof JSZip);
				try {
					var zip = new JSZip();
					console.log('JSZip instance created successfully:', zip);
				} catch (error) {
					console.error('Error creating JSZip instance:', error);
				}
			} else {
				console.error('JSZip is not defined.');
			}
		}

		// Run the probe function
		probeJSZip();

		// Create a new JSZip instance
		var zip = new JSZip();


		// Define the relative base path
		const basePath = "../editor/files/exportFiles/";

		// Define the directory structure that will contain the file data.
		//use new ArrayBuffer( file data here ) for data fed in from a variable,
		//and null as a placeholder for files that will be brought in from the server
		//later using 'fetch'
		/**
			* Represents the directory structure of files to be added to the ZIP archive.
		* @typedef {Object} DirectoryStructure
			* @property {null} app.json - The app configuration file.
			* @property {null} newindex.html - The new index HTML file.
			* @property {Object} data - The data directory.
			* @property {null} data.largeLambda.patt - The large lambda pattern file.
			* @property {Object} img - The img directory.
			* @property {null} img.favicon.ico - The favicon image file.
			* @property {Object} js - The js directory.
			* @property {null} js.APP.js - The main JavaScript application file.
			* @property {null} js.GLTFLoader.js - The GLTF loader JavaScript file.
			* @property {null} js.LegacyJSONLoader.js - The legacy JSON loader JavaScript file.
			* @property {null} js.OrbitControls.js - The OrbitControls JavaScript file.
			* @property {null} js.VRButton.js - The VRButton JavaScript file.
			* @property {null} js.ar-threex.js - The AR-THREEx JavaScript file.
			* @property {null} js.ar.js - The AR JavaScript file.
			* @property {null} js.es-module-shims.js - The ES module shims JavaScript file.
			* @property {null} js.stats.min.js - The stats minified JavaScript file.
			* @property {null} js.three.js - The Three.js library file.
			* @property {null} js.three.module.js - The Three.js module file.
			* @property {Object} js.jsartoolkit5 - The jsartoolkit5 directory.
			* @property {null} js.jsartoolkit5.artoolkit.api.d.ts - The ARToolkit API declaration file.
			* @property {null} js.jsartoolkit5.artoolkit.api.js - The ARToolkit API JavaScript file.
		* @property {null} js.jsartoolkit5.artoolkit.min.js - The ARToolkit minified JavaScript file.
			* @property {null} js.jsartoolkit5.artoolkit.three.d.ts - The ARToolkit Three.js declaration file.
			* @property {null} js.jsartoolkit5.artoolkit.three.js - The ARToolkit Three.js JavaScript file.
			* @property {null} js.jsartoolkit5.artoolkit.worker.js - The ARToolkit worker JavaScript file.
			* @property {null} js.jsartoolkit5.index.d.ts - The index declaration file.
			* @property {null} js.jsartoolkit5.index.js - The index JavaScript file.
			* @property {Object} js.data - The data directory within the js directory.
			* @property {null} js.data.camera_para.dat - The camera parameters data file.
			* @property {null} js.data.lambda-old.patt - The old lambda pattern file.
			* @property {null} js.data.lambda.patt - The lambda pattern file.
			* @property {Object} resources - The resources directory.
			* @property {Object} resources.images - The images directory within the resources directory.
		* @property {null} resources.images.Large Lambda AR Marker.png - The large lambda AR marker image file.
			*/

		/**
		* This code demonstrates how to fetch multiple files of different types (including binary data and blobs),
		* organize them into directories, and create a ZIP file using JSZip.
		* 
		* It includes functions to fetch data from URLs, fetch multiple files concurrently,
		* and create directories in the ZIP file structure based on file paths.
		* 
		* The usage example at the bottom illustrates how to use the createZip function to generate and save the ZIP file.
		* 
		* Dependencies: JSZip (https://stuk.github.io/jszip/)
		* 
		* @version 1.0.0
		*/

		/**
		 * Fetches data from the specified URL and handles it accordingly.
		 * @param {string} url - The URL from which to fetch the data.
		 * @returns {Promise<Blob|ArrayBuffer>} A promise that resolves with the fetched data as a Blob or ArrayBuffer.
		 */
		function fetchData(url) {
			return fetch(url)
				.then(function (response) {
					if (response.ok) {
						if (response.headers.get('Content-Type').startsWith('application/octet-stream')) {
							// Handle binary data
							return response.arrayBuffer();
						} else {
							// Handle other types of files
							return response.blob();
						}
					} else {
						throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
					}
				});
		}


		/**
		 * Fetches multiple files from the specified URLs and returns a promise that resolves with an array of fetched data.
		 * @param {Object[]} files - An array of objects containing the URL, the desired file name, and the directory path.
		 * @returns {Promise<Array<{name: string, path: string, data: Blob|ArrayBuffer}>>} A promise that resolves with an array of fetched data.
		 */
		function fetchFiles(files) {
			//return Promise.all(files.map(function (file) {
			//	return fetchData(file.url).then(function (data) {
			//		return { name: file.name, path: file.path, data: data };
			//	});
			//}));
			
			return Promise.all(files.map(function (file) {
				// Skip fetch if file already has data via a Marker Generation
				if (file.data) {
				return Promise.resolve(file);
				}

				// Otherwise, fetch from URL as normal
				return fetchData(file.url).then(function (data) {
				return { name: file.name, path: file.path, data: data };
				});
			}));

		}

		/**
		 * Fetches multiple files from the specified URLs, organizes them into directories, and creates a ZIP file.
		 * @param {Object[]} filesToFetch - An array of objects containing file information (URL, name, and path).
		 * @returns {Promise<Blob>} A promise that resolves with the generated ZIP file as a Blob.
		 */
		//disble redundant code
		// function createZip(filesToFetch) {
		// 	if (!Array.isArray(filesToFetch) || filesToFetch.length === 0) {
		// 		return Promise.reject(new Error('Invalid filesToFetch parameter. It should be a non-empty array.'));
		// 	}

		// 	var zip = new JSZip();

		// 	return fetchFiles(filesToFetch)
		// 		.then(function (dataArray) {
		// 			dataArray.forEach(function (file) {
		// 				var directoryPath = file.path.trim();
		// 				if (directoryPath !== '') {
		// 					var directory = zip.folder(directoryPath);
		// 				}
		// 				console.log("directoryPath + file.name, file.data, { binary: typeof file.data !== 'string' }: "); //Test code
		// 				console.log("directoryPath + file.name: " + directoryPath + file.name); //Test code
		// 				console.log("file.data" + file.data); //Test code
		// 				console.log("binary: " + (typeof file.data !== 'string')); //Test code

		// 				zip.file(directoryPath + file.name, file.data, { binary: typeof file.data !== 'string' });
		// 			});

		// 			//In this case, we need to inject the generated app.json
		// 			//This should be abstracted out to be a function call's return.
		// 			console.log("toZip['app.json']"); //Test code
		// 			console.dir(toZip['app.json']); //Test code

		// 			zip.file("app.json", toZip['app.json'], { binary: false });

		// 			//Additionally, the index.html page needed to be adjusted, so it must be added seperatly
		// 			console.log("toZip['index.html']"); //Test code
		// 			console.dir(toZip['index.html']); //Test code

		// 			zip.file("index.html", toZip['index.html'], { binary: false });
					

		// 			//Return the completed zip content.
		// 			return zip.generateAsync({ type: 'blob' });
		// 		})
		// 		.catch(function (error) {
		// 			// Throw error to be handled by the caller
		// 			throw new Error('Error creating ZIP file: ' + error.message);
		// 		});
		// }


		/*
		// Convert the directory structure to the required file array format
		var filesToFetch = processDirectory(directoryStructure);
		*/


		
		var filesToFetch = [
			//{url: '../editor/files/exportFiles/index.html', name: 'index.html', path: ''}, //this file needs to be edited before it's added in
			{ url: '../editor/files/exportFiles/data/largeLambda.patt', name: 'largeLambda.patt', path: 'data/' },
			{ url: '../editor/files/exportFiles/data/camera_para.dat', name: 'camera_para.dat', path: 'data/' },
			{ url: '../editor/files/exportFiles/img/favicon.ico', name: 'favicon.ico', path: 'img/' },
			{ url: '../editor/files/exportFiles/js/APP.js', name: 'APP.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/GLTFLoader.js', name: 'GLTFLoader.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/LegacyJSONLoader.js', name: 'LegacyJSONLoader.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/OrbitControls.js', name: 'OrbitControls.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/VRButton.js', name: 'VRButton.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/ar-threex.js', name: 'ar-threex.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/ar.js', name: 'ar.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/es-module-shims.js', name: 'es-module-shims.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/stats.min.js', name: 'stats.min.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/three.js', name: 'three.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/three.module.js', name: 'three.module.js', path: 'js/' },
			{ url: '../editor/files/exportFiles/js/jsartoolkit5/artoolkit.api.d.ts', name: 'artoolkit.api.d.ts', path: 'js/jsartoolkit5/' },
			{ url: '../editor/files/exportFiles/js/jsartoolkit5/artoolkit.api.js', name: 'artoolkit.api.js', path: 'js/jsartoolkit5/' },
			{ url: '../editor/files/exportFiles/js/jsartoolkit5/artoolkit.min.js', name: 'artoolkit.min.js', path: 'js/jsartoolkit5/' },
			{ url: '../editor/files/exportFiles/js/jsartoolkit5/artoolkit.three.d.ts', name: 'artoolkit.three.d.ts', path: 'js/jsartoolkit5/' },
			{ url: '../editor/files/exportFiles/js/jsartoolkit5/artoolkit.three.js', name: 'artoolkit.three.js', path: 'js/jsartoolkit5/' },
			{ url: '../editor/files/exportFiles/js/jsartoolkit5/artoolkit.worker.js', name: 'artoolkit.worker.js', path: 'js/jsartoolkit5/' },
			{ url: '../editor/files/exportFiles/js/jsartoolkit5/index.d.ts', name: 'index.d.ts', path: 'js/jsartoolkit5/' },
			{ url: '../editor/files/exportFiles/js/jsartoolkit5/index.js', name: 'index.js', path: 'js/jsartoolkit5/' },
			{ url: '../editor/files/exportFiles/js/data/camera_para.dat', name: 'camera_para.dat', path: 'js/data/' },
			{ url: '../editor/files/exportFiles/js/data/lambda-old.patt', name: 'lambda-old.patt', path: 'js/data/' }//, //comment out the AR Markers and generate them instead
			//{ url: '../editor/files/exportFiles/js/data/lambda.patt', name: 'lambda.patt', path: 'js/data/' },
			//{ url: '../editor/files/exportFiles/resources/images/Large Lambda AR Marker.png', name: 'Large Lambda AR Marker.png', path: 'resources/images/' }
		
		]

		console.dir(filesToFetch);//test code
//The code to create the zip
function createZip(filesToFetch) {
  if (!Array.isArray(filesToFetch) || filesToFetch.length === 0) {
    return Promise.reject(new Error('Invalid filesToFetch parameter. It should be a non-empty array.'));
  }

  var zip = new JSZip();

  return fetchFiles(filesToFetch)
    .then(function (dataArray) {
      dataArray.forEach(function (file) {
        var directoryPath = file.path.trim();
        if (directoryPath !== '') {
          zip.folder(directoryPath);
        }

        zip.file(directoryPath + file.name, file.data, {
          binary: typeof file.data !== 'string'
        });
      });

      // Inject app.json
      zip.file("app.json", toZip['app.json'], { binary: false });

      // Inject index.html
      zip.file("index.html", toZip['index.html'], { binary: false });

      return zip.generateAsync({ type: 'blob' });
    })
    .catch(function (error) {
      throw new Error('Error creating ZIP file: ' + error.message);
    });
}


		//Generate the marker .patt and .png then append it to the filesToFetch:

		// start new ARMarker configuration code
		let markerPatternFile;
		let markerImageFile;

		function configureCustomMarkerFiles() {
			
			try {
				const customPatt = getSharedMarkerPattern?.();
				const customPng = getSharedMarkerImageDataURL?.();

				console.log("customPatt:"); // test code
				console.dir(customPatt); // test code

				console.log("customPng:"); // test code
				console.dir(customPng); // test code

				// Pattern
				if (customPatt) {
					console.log("Custom pattern found. Using Custom Pattern.");
					markerPatternFile = {
						name: 'lambda.patt',
						path: 'js/data/',
						data: new Blob([customPatt], { type: 'text/plain' })
					};
				} else {
					console.log("Custom pattern not found. Switching to Default.");
					markerPatternFile = {
						url: '../editor/files/exportFiles/data/largeLambda.patt',
						name: 'lambda.patt',
						path: 'js/data/'
					};
				}

				// Image
				if (customPng) {
					console.log("Custom PNG found. Using Custom PNG.");
					try {
						const byteString = atob(customPng.split(',')[1]);
						const byteArray = new Uint8Array(byteString.length);
						for (let i = 0; i < byteString.length; i++) {
							byteArray[i] = byteString.charCodeAt(i);
						}
						markerImageFile = {
							name: 'marker-image.png',
							path: 'resources/images/',
							data: new Blob([byteArray], { type: 'image/png' })
						};
					} catch (err) {
						console.warn("Failed to decode custom PNG. Using default instead.", err);
						markerImageFile = {
							url: '../editor/files/exportFiles/resources/images/Large Lambda AR Marker.png',
							name: 'Large Lambda AR Marker.png',
							path: 'resources/images/'
						};
					}
				} else {
					console.log("Custom image not found. Switching to Default.");
					markerImageFile = {
						url: '../editor/files/exportFiles/resources/images/Large Lambda AR Marker.png',
						name: 'Large Lambda AR Marker.png',
						path: 'resources/images/'
					};
				}
			} catch (e) {
				console.error('[AR Marker] Unexpected error during marker configuration:', e);
				// Final fallback in case *everything* fails (safe to keep)
				markerPatternFile = {
					url: '../editor/files/exportFiles/data/largeLambda.patt',
					name: 'lambda.patt',
					path: 'js/data/'
				};
				markerImageFile = {
					url: '../editor/files/exportFiles/resources/images/Large Lambda AR Marker.png',
					name: 'Large Lambda AR Marker.png',
					path: 'resources/images/'
				};
			}

		
		}

		console.log("[Publish AR App] Generating AR Marker Assets...");



		await generateMarkerImage();   // must come first to get the framed PNG
		await generateMarkerPattern(); // then generate the pattern without frame

			if (typeof generateMarkerImage === 'function' && typeof generateMarkerPattern === 'function') {
				Promise.all([
					generateMarkerImage(),   // With border (PNG)
					generateMarkerPattern()  // Without border (.patt)
				]).then(() => {
					console.log("[Publish AR App] Marker files generated. Proceeding to configuration.");
					configureCustomMarkerFiles(); // <-- now safe to call AFTER marker files exist

					// inject into filesToFetch, etc...
					filesToFetch.push(markerPatternFile);
					filesToFetch.push(markerImageFile);

					//Prepare the export file name...
					const zipFileName = appTitle + ".zip";

					// continue to zip...
					createZip(filesToFetch)
					.then(function (content) {
						console.log("============");
						console.log("passed content: ");
						console.dir(content);
						console.log("============");

						save(content, zipFileName);
					})
					.catch(function (error) {
						console.error("Error creating ZIP file:", error);
					});
				}).catch((error) => {
					console.error("Marker generation failed:", error);
				});
				} else {
				console.warn('[Publish AR App] Required marker generation functions are missing.');
				}

//Disabling redundant code
		// console.log("[Publish AR App] Reached marker configuration step");
		// configureCustomMarkerFiles();
		// console.log("[Publish AR App] Marker files configured:", markerPatternFile, markerImageFile);
		//
		//		
		//
		// // end new ARMarker configuration code
		//
		// // start new ARMarker injection
		// filesToFetch.push(markerPatternFile);
		// filesToFetch.push(markerImageFile);
		// // end new ARMarker injection
		//
		// console.log("filesToFetch");//test code
		// console.dir(filesToFetch);//test code

		/*
		// start new ARMarker Generation code
			(function () {
			try {
				const customPatt = getSharedMarkerPattern?.();
				const customPng = getSharedMarkerImageDataURL?.();

				if (customPatt) {
				filesToFetch.push({ name: 'lambda.patt', path: 'data/', data: new Blob([customPatt], { type: 'text/plain' }) });
				} else {
				filesToFetch.push({ url: '../editor/files/exportFiles/data/largeLambda.patt', name: 'lambda.patt', path: 'data/' });
				}

				if (customPng) {
				const byteString = atob(customPng.split(',')[1]);
				const byteArray = new Uint8Array(byteString.length);
				for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
				filesToFetch.push({ name: 'marker-image.png', path: 'resources/images/', data: new Blob([byteArray], { type: 'image/png' }) });
				} else {
				filesToFetch.push({ url: '../editor/files/exportFiles/resources/images/Large Lambda AR Marker.png', name: 'Large Lambda AR Marker.png', path: 'resources/images/' });
				}
			} catch (e) {
				console.warn('Could not inject marker files:', e);
			}
			})();
			// end new ARMarker code
		*/


		/*
		createZip(filesToFetch)
			.then(function(content) {
				saveAs(content, 'example.zip');
			})
			.catch(function(error) {
				console.error(error);
			});
			*/

		
//Old code -- the new code handles the Markers better.

		// // Add files to the ZIP archive and generate the ZIP file
		// const zipFileName = appTitle + ".zip"
		
		// createZip(filesToFetch)
		// 	//.then(function() {
		// 	//	return zip.generateAsync({ type: "blob" });
		// 	//}) 
		// 	.then(function (content) {
		// 		// Save the ZIP file locally
		// 		//saveAs(content, "files.zip");
		// 		//Need to inject the app.json file before Ziping the file
		// 		//zip.file(directoryPath + file.name, file.data, { binary: typeof file.data !== 'string' });
		// 		console.log("============"); //Test code
		// 		console.log("passed content: "); //Test code
		// 		console.dir(content); //Test code
		// 		console.log("============"); //Test code

		// 		save(content, zipFileName);
		// 		//save(content, "files.zip");
		// 	})
		// 	.catch(function (error) {
		// 		console.error("Error creating ZIP file:", error);
		// 	});


	});
	options.add(option);
//End Publish AR App

	/////////////---------------------------------------//////////////
	/////////////---------------------------------------//////////////
/////////////---------------------------------------//////////////
/////////////---------------------------------------//////////////
/////////////---------------------------------------//////////////

//Start Publish AR NFT App
// Publish an AR NFT App
//Edited to export as an ARJS NFT Template
option = new UIRow();
option.setClass('option');
option.setTextContent(strings.getKey('menubar/file/publish_arnft'));
option.onClick(async function () {

	//Setup a storage location for the index.html and the json.app file content
	const toZipForARNFT = {};

	// Create a new JSZip instance
	var zip = new JSZip();

	//prepare to build the model.gltf file for export
	const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

	const exporter = new GLTFExporter();

	// Export the scene as GLTF (non-binary)
	exporter.parse(editor.scene, function (gltfOutput) {

		//Step 1: Stringify the GLTF result
		// This gltfOutput is a plain JS object — you can JSON.stringify it
		const gltfString = JSON.stringify(gltfOutput, null, 2);

		// Assign to content for zipping
		toZipForARNFT['model.gltf'] = gltfString;

		const appTitle = config.getKey('project/title') || 'AR Natural Feature Tracker Web App';

		//Adjust the template index.html to have the corrected title, etc.
		const loader = new THREE.FileLoader();
		loader.load('../editor/files/ARNFTExportFiles/index.html', function (content) {

			content = content.replace('<!-- title -->', appTitle);

			const theNFTModelName = "model";

			const modelNameToInsert = "nftAddTJS.addModel('./Data/models/" + theNFTModelName + ".gltf', 'generatedMarkerFile', 80, false);"

			content = content.replace('//<!-- insert model -->', modelNameToInsert);

			const includes = [];

			content = content.replace('<!-- includes -->', includes.join('\n\t\t'));

			let editButton = '';
			/*
			if (config.getKey('project/editable')) {

				editButton = [
					'			let button = document.createElement( \'a\' );',
					'			button.href = \'https://threejs.org/editor/#file=\' + location.href.split( \'/\' ).slice( 0, - 1 ).join( \'/\' ) + \'/app.json\';',
					'			button.style.cssText = \'position: absolute; bottom: 20px; right: 20px; padding: 10px 16px; color: #fff; border: 1px solid #fff; border-radius: 20px; text-decoration: none;\';',
					'			button.target = \'_blank\';',
					'			button.textContent = \'EDIT\';',
					'			document.body.appendChild( button );',
				].join('\n');

			}
			*/
			/*
			content = content.replace('\t\t\t/* edit button ', editButton);
			*/

			//toZipForARNFT['index.html'] = strToU8(content);
			toZipForARNFT['index.html'] = content;
			//Building a JSZip
			//Test that JZZip Loaded:
			// Function to probe the JSZip library
			function probeJSZipForARNFT() {
				if (typeof JSZip !== 'undefined') {
					console.log('JSZip is defined.');
					console.log('Type of JSZip:', typeof JSZip);
					try {
						var zip = new JSZip();
						console.log('JSZip instance created successfully:', zip);
					} catch (error) {
						console.error('Error creating JSZip instance:', error);
					}
				} else {
					console.error('JSZip is not defined.');
				}
			}

			// Run the probe function
			probeJSZipForARNFT();

			// Define the relative base path
			const basePath = "../editor/files/ARNFTExportFiles/";

			/**
			 * Fetches data from the specified URL and handles it accordingly.
			 * @param {string} url - The URL from which to fetch the data.
			 * @returns {Promise<Blob|ArrayBuffer>} A promise that resolves with the fetched data as a Blob or ArrayBuffer.
			 */
			function fetchData(url) {
				return fetch(url)
					.then(function (response) {
						if (response.ok) {
							if (response.headers.get('Content-Type').startsWith('application/octet-stream')) {
								// Handle binary data
								return response.arrayBuffer();
							} else {
								// Handle other types of files
								return response.blob();
							}
						} else {
							throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
						}
					});
			}

			/**
			 * Fetches multiple files from the specified URLs and returns a promise that resolves with an array of fetched data.
			 * @param {Object[]} files - An array of objects containing the URL, the desired file name, and the directory path.
			 * @returns {Promise<Array<{name: string, path: string, data: Blob|ArrayBuffer}>>} A promise that resolves with an array of fetched data.
			 */
			function fetchFilesForARNFT(files) {
				return Promise.all(files.map(function (file) {
					return fetchData(file.url).then(function (data) {
						return { name: file.name, path: file.path, data: data };
					});
				}));
			}

			/**
			 * Fetches multiple files from the specified URLs, organizes them into directories, and creates a ZIP file.
			 * @param {Object[]} filesToFetch - An array of objects containing file information (URL, name, and path).
			 * @returns {Promise<Blob>} A promise that resolves with the generated ZIP file as a Blob.
			 */
			function createZipForARNFT(filesToFetch) {
				if (!Array.isArray(filesToFetch) || filesToFetch.length === 0) {
					return Promise.reject(new Error('Invalid filesToFetch parameter. It should be a non-empty array.'));
				}

				var zip = new JSZip();

				return fetchFilesForARNFT(filesToFetch)
					.then(function (dataArray) {
						dataArray.forEach(function (file) {
							var directoryPath = file.path.trim();
							if (directoryPath !== '') {
								var directory = zip.folder(directoryPath);
							}
							console.log("directoryPath + file.name, file.data, { binary: typeof file.data !== 'string' }: "); //Test code
							console.log("directoryPath + file.name: " + directoryPath + file.name); //Test code
							console.log("file.data" + file.data); //Test code
							console.log("binary: " + (typeof file.data !== 'string')); //Test code

							zip.file(directoryPath + file.name, file.data, { binary: typeof file.data !== 'string' });
						});

						//In this case, we need to inject the generated app.json
						//This should be abstracted out to be a function call's return.
						console.log("toZipForARNFT['model.gltf']"); //Test code
						console.dir(toZipForARNFT['model.gltf']); //Test code

						zip.file("Data/models/model.gltf", toZipForARNFT['model.gltf'], { binary: false });

						//Additionally, the index.html page needed to be adjusted, so it must be added separately
						console.log("toZipForARNFT['index.html']"); //Test code
						//console.dir(toZipForARNFT['index.html']); //Test code

						zip.file("index.html", toZipForARNFT['index.html'], { binary: false });

						//zip.file("index.html", toZipForARNFT['../editor/files/exportFiles/index.html'], { binary: false });


						//Return the completed zip content.
						return zip.generateAsync({ type: 'blob' });
					})
					.catch(function (error) {
						// Throw error to be handled by the caller
						throw new Error('Error creating ZIP file: ' + error.message);
					});
			}
			/*
			// Usage example:
			var filesToFetch = [
				{ url: 'https://example.com/index.html', name: 'index.html', path: '' },
				{ url: 'https://example.com/banner.jpg', name: 'banner.jpg', path: '' },
				{ url: 'https://example.com/index.js', name: 'index.js', path: '' },
				{ url: 'https://example.com/binaryfile1', name: 'binaryfile1.bin', path: 'binaries/' },
				{ url: 'https://example.com/binaryfile2', name: 'binaryfile2.bin', path: 'binaries/' },
				{ url: 'https://example.com/binaryfile3', name: 'binaryfile3.bin', path: 'binaries/' }
			];
			*/

			/*
			// Convert the directory structure to the required file array format
			var filesToFetch = processDirectory(directoryStructure);
			*/

			var filesToFetch = [
			//{url: '../editor/files/ARNFTExportFiles/index.html', name: 'index.html', path: ''}, //this file needs to be edited before it's added in
			{ url: '../editor/files/ARNFTExportFiles/CODE_OF_CONDUCT.md', name: 'CODE_OF_CONDUCT.md', path: '' },
			{ url: '../editor/files/ARNFTExportFiles/config-StanState.json', name: 'config-StanState.json', path: '' },
			{ url: '../editor/files/ARNFTExportFiles/CONTRIBUTING.md', name: 'CONTRIBUTING.md', path: '' },
			{ url: '../editor/files/ARNFTExportFiles/credits.html', name: 'credits.html', path: '' },
			{ url: '../editor/files/ARNFTExportFiles/css/nft-style.css', name: 'nft-style.css', path: 'css/' },
			{ url: '../editor/files/ARNFTExportFiles/Data/camera_para.dat', name: 'camera_para.dat', path: 'Data/' },
			{ url: '../editor/files/ARNFTExportFiles/Data/models/Model_ReadMe.txt', name: 'Model_ReadMe.txt', path: 'Data/models/' },
			{ url: '../editor/files/ARNFTExportFiles/Data/StanState-logo.png', name: 'StanState-logo.png', path: 'Data/' },
			{ url: '../editor/files/ARNFTExportFiles/DataNFT/generatedMarkerFile.fset', name: 'generatedMarkerFile.fset', path: 'DataNFT/' },
			{ url: '../editor/files/ARNFTExportFiles/DataNFT/generatedMarkerFile.fset3', name: 'generatedMarkerFile.fset3', path: 'DataNFT/' },
			{ url: '../editor/files/ARNFTExportFiles/DataNFT/generatedMarkerFile.iset', name: 'generatedMarkerFile.iset', path: 'DataNFT/' },
			{ url: '../editor/files/ARNFTExportFiles/favicon.ico', name: 'favicon.ico', path: 'ARNFTExportFiles/' },
			{ url: '../editor/files/ARNFTExportFiles/img/pinball.jpg', name: 'pinball.jpg', path: 'img/' },
			{ url: '../editor/files/ARNFTExportFiles/img/ReadMe.txt', name: 'ReadMe.txt', path: 'img/' },
			{ url: '../editor/files/ARNFTExportFiles/js/ARnftThreejs.js', name: 'ARnftThreejs.js', path: 'js/' },
			{ url: '../editor/files/ARNFTExportFiles/js/cameraViewRenderer.js', name: 'cameraViewRenderer.js', path: 'js/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/ARnft.js', name: 'ARnft.js', path: 'js/third_party/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/artoolkitNFT.js', name: 'artoolkitNFT.js', path: 'js/third_party/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/config/ConfigData.js', name: 'ConfigData.js', path: 'js/third_party/config/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/index.js', name: 'index.js', path: 'js/third_party/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/NFTWorker.js', name: 'NFTWorker.js', path: 'js/third_party/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/renderers/CameraViewRenderer.js', name: 'CameraViewRenderer.js', path: 'js/third_party/renderers/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/three.js/LICENSE.txt', name: 'LICENSE.txt', path: 'js/third_party/three.js/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/three.js/stats.min.js', name: 'stats.min.js', path: 'js/third_party/three.js/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/three.js/three.min.js', name: 'three.min.js', path: 'js/third_party/three.js/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/three.js/threeJS R151.3.js', name: 'threeJS R151.3.js', path: 'js/third_party/three.js/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/utils/ARnftUtils.js', name: 'ARnftUtils.js', path: 'js/third_party/utils/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/utils/html/Container.js', name: 'Container.js', path: 'js/third_party/utils/html/' },
			{ url: '../editor/files/ARNFTExportFiles/js/third_party/Worker.js', name: 'Worker.js', path: 'js/third_party/' },
			{ url: '../editor/files/ARNFTExportFiles/LICENSE', name: 'LICENSE', path: '' }
		]

			console.dir(filesToFetch);//test code

			/*
			createZipForARNFT(filesToFetch)
				.then(function(content) {
					saveAs(content, 'example.zip');
				})
				.catch(function(error) {
					console.error(error);
				});
			*/

			const zipFileName = appTitle + ".zip"

			// Add files to the ZIP archive and generate the ZIP file
			createZipForARNFT(filesToFetch)
				.then(function (content) {
					console.log("============"); //Test code
					console.log("passed content: "); //Test code
					console.dir(content); //Test code
					console.log("============"); //Test code

					save(content, zipFileName);
				})
				.catch(function (error) {
					console.error("Error creating ZIP file:", error);
				});
		});
	}, undefined, {
		binary: false,
		animations: getAnimations(editor.scene)
	});
});

options.add(option);

//End Publish AR NFT App

/////////////---------------------------------------//////////////
/////////////---------------------------------------//////////////
/////////////---------------------------------------//////////////
/////////////---------------------------------------//////////////

	/////////////---------------------------------------//////////////


	const link = document.createElement('a');
	function save(blob, filename) {

		if (link.href) {

			URL.revokeObjectURL(link.href);

		}

		link.href = URL.createObjectURL(blob);
		link.download = filename || 'data.json';
		link.dispatchEvent(new MouseEvent('click'));

	}

	function saveArrayBuffer(buffer, filename) {

		save(new Blob([buffer], { type: 'application/octet-stream' }), filename);

	}

	function saveString(text, filename) {

		save(new Blob([text], { type: 'text/plain' }), filename);

	}

	function getAnimations(scene) {

		const animations = [];

		scene.traverse(function (object) {

			animations.push(...object.animations);

		});

		return animations;

	}

	return container;

}

export { MenubarFile };
