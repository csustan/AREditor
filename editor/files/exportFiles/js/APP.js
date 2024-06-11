// Import AR.js related modules directly in APP.js
//import * as THREE from './path/to/three.module.js';
//import { artoolkit } from './jsartoolkit5'; // Adjust the path accordingly
//THREEx.ArToolkitContext.baseURL = './js/'

//Here's how it would work in a scene built to import a model
//markerRoot = new THREE.Group(); // create a group for the marker root
//scene(markerRoot); // add the marker root to the scene
//markerRoot.add(model); // add the model to the marker root
//So how would it work if you load in a scene instead of a model?
//Make a camera for THREEjs
//make an ArToolkitSource to connect to the webcam
//Make an ArToolkitContext to connect the camera to the webcam
//Use the ArToolkitContext and the matrix to have the camera match reality
//Use ArMarkerControls to conect the ArToolkitContext to the Marker and the pattern file so the
//virtual camera (connected to the ArToolkitContext) will spin around the scene
//to make it look like the scene is connected to the marker

//This process will be integrated into the standard template. This is made a bit tricky due to
//the way that the template handles the varible scope. The first pass will work with a 
//global object, a later version will need to convert this to be a revealing data pattern
// or Get/Set methods inside the global object.

//Create a Global Object that can store global variables to be called by address later
const globalVar = {};

//Set up a camera for ThreeJS
globalVar.camera = new THREE.PerspectiveCamera(
    //50, window.innerWidth / window.innerHeight, 0.02, 100.0 //old settings
    70, // Field of view
    window.innerWidth / window.innerHeight * window.devicePixelRatio, //window.innerWidth / window.innerHeight, // Aspect ratio
    0.05,//0.1, // Near clipping plane
    1000 // Far clipping plane
);

//add arToolkitSource to the correct scope and call it later
globalVar.arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam',
});

//add arToolkitContext to the correct scope and call it later
globalVar.arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: './js/data/camera_para.dat',
    detectionMode: 'mono',
});
globalVar.arToolkitContextReadyFlag = false;

globalVar.arMarkerControls;
globalVar.arMarkerControlsFlag = false;
globalVar.renderer;
globalVar.rendererReadyFlag = false;
//Initialize the scene variable to be a THREE.Scene();
globalVar.scene = new THREE.Scene(); //new THREE.Group();
globalVar.markerRoot = new THREE.Group();

var APP = {


    getSceneCenter: function (objects) {
        const center = new THREE.Vector3();
        let objectCount = 0;

        objects.forEach(function (object) {
            if (object instanceof THREE.Object3D) {
                center.add(object.position);
                objectCount++;
            }
        });

        // Calculate the average position (center)
        if (objectCount > 0) {
            center.divideScalar(objectCount);
        }

        return center;
    },

    Player: function () {
        globalVar.renderer = new THREE.WebGLRenderer({
			antialias : true, //Antialias to get smooth edges
			alpha: true //Alpha (transparency) support will be needed to make somethings invisible
		});

        // Set the pixel ratio of the renderer
        globalVar.renderer.setPixelRatio(window.devicePixelRatio);

        // Set the size of the renderer to match the window dimensions
        globalVar.renderer.setSize(window.innerWidth, window.innerHeight);

        // Optionally set the background color of the renderer
        // globalVar.renderer.setClearColor(0x000000); // Example: sets background color to black

        // Apply CSS styles to position the canvas element
        globalVar.renderer.domElement.style.position = 'absolute'; // Fixed position
        globalVar.renderer.domElement.style.top = '0px'; // Positioned at the top-left corner of the viewport
        globalVar.renderer.domElement.style.left = '0px';

        globalVar.rendererReadyFlag = true;

        var loader = new THREE.ObjectLoader();
        //var scene;

        var vrButton = VRButton.createButton(globalVar.renderer);

        var events = {};

        var dom = document.createElement('div');
        dom.appendChild(globalVar.renderer.domElement); // should this be renderer or globalVar.arToolkitContext ?
        dom.style.overflow = 'hidden';
        this.dom = dom;
        //this.width = 500; //test code
        //this.height = 500; //test code
        this.width = dom.innerWidth;
        this.hight = dom.innerHeight;

        //Start new resize
        function onResize() {

            console.log("Activating function onResize()");

            // Check if all necessary components are ready before resizing
            if (globalVar.rendererReadyFlag && globalVar.arMarkerControlsFlag && globalVar.arToolkitContextReadyFlag) {
                // Resize AR.js source
                globalVar.arToolkitSource.onResizeElement();
                globalVar.arToolkitSource.copyElementSizeTo(globalVar.renderer.domElement);

                // Resize AR.js context's AR controller canvas if available
                if (globalVar.arToolkitContext.arController !== null) {
                    globalVar.arToolkitSource.copyElementSizeTo(globalVar.arToolkitContext.arController.canvas);
                }
            }

        };

        this.OnResize = function(width, hight){
            onResize();
            //console.log("Activating this.OnResize"); //test code
            // Define the CSS rule needed to correct the arjs-video window size issue as a string
            var cssRule = `
                .arjs-video {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    /* Add any additional styling properties as needed */
                }
            `;

            // Create a <style> element and set its content to the CSS rule
            var styleElement = document.createElement('style');
            styleElement.textContent = cssRule;

            // Append the <style> element to the document's <head> section
            document.head.appendChild(styleElement);


        };

        globalVar.arToolkitSource.init(function onReady() {
            onResize()
        });

        //End new resize

        this.ARSetup = function (loadedScene) {


            // Create a group for the marker root
            //const markerRoot = new THREE.Group();

            //// Add the marker root to the main scene using scene.add
            //scene.add(markerRoot);

            // Add the marker root to the main scene using this.scene.add
            //this.scene.add(markerRoot);

            // Set the loaded scene
            //this.setScene(markerRoot);

            // Create a group for the children
            var childGroup = new THREE.Group();
            /*
            //Test code
            console.log("loadedScene: "); //Test code
            console.dir(loadedScene); //Test code
            markerRoot.add(loadedScene); 
            //*/

            //Loading code:
            //*
            // Loop through the children of the loaded scene and add specific types or names to markerGroup
            loadedScene.children.forEach(function (child) {
                // Example: Add only objects with the name "model" to markerGroup
                //if (child.name === "model") {
                //    markerGroup.add(child);
                //}

                // Example: Add only Mesh objects to markerRoot
                // if (child instanceof THREE.Mesh) {
                //     markerRoot.add(child);
                // }


                console.log("Child detected:"); //Test Code
                console.dir(child); //Test Code
                console.log("Loading Child to Geoup"); //Test Code

                //childGroup.add(child);

                console.log("Current Child Group content:");  //Test Code
                console.dir(childGroup);  //Test Code

                //markerRoot.add(child);
                //scene.add(child);
                globalVar.markerRoot.add(child);

            });

            //Add the entire childGroup to the markerGroup:
            //globalVar.markerRoot.add(childGroup); // no longer needed
            
            //test code:
            console.log("globalVar.markerRoot");
            console.dir(globalVar.markerRoot);

            // Check if there is a camera in the loaded scene
            var cameras = loadedScene.cameras;

            var hasCamera = cameras && cameras.length > 0;
            //Disable for now -- we're only using one ARJS camera which is in globalVar.camera
            /*
            if (!hasCamera) {
                console.error('Camera not found in the loaded scene. Generating a default camera.');
                // Generate a default perspective camera if no camera is found
                //var defaultCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
                var defaultCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.02, 100.0);
                defaultCamera.name = 'defaultCamera'; // Optional: Assign a name to the camera
                //defaultCamera = defaultCamera.rotation.y - (Math.PI/2);
                //defaultCamera.rotation.set(0, Math.PI/2,0);
                loadedScene.add(defaultCamera); // Add the default camera to the loaded scene
                camera = defaultCamera;
            } else {
                // Use the first camera found in the loaded scene
                //camera = cameras[0];
                var defaultCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.02, 100.0);
                defaultCamera.name = 'defaultCamera'; // Optional: Assign a name to the camera
                loadedScene.add(defaultCamera); // Add the default camera to the loaded scene
                camera = defaultCamera;
            }
            //*/
            //Start new code
            //globalVar.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.02, 100.0);

            //Add the marker root to the main scene using scene.add
            globalVar.scene.add(globalVar.markerRoot);

            // Initialize AR.js source
            if (globalVar.arToolkitSource) {
                console.log("globalVar.arToolkitSource detected: ");
                console.dir(globalVar.arToolkitSource);
                globalVar.arToolkitSource.init(function onReady() {

                    // Initialize AR.js context
                    globalVar.arToolkitContext.init(function onCompleted() {

                        // Copy projection matrix to the camera
                        globalVar.camera.projectionMatrix.copy(globalVar.arToolkitContext.getProjectionMatrix());

                        // Now create an AR.js marker based on the provided pattern URL
                        globalVar.arMarkerControls = new THREEx.ArMarkerControls(globalVar.arToolkitContext, globalVar.markerRoot, {
                            type: 'pattern',
                            patternUrl: './js/data/lambda.patt',

                            smooth: true, //Activate smoothing

                            smoothCount: 5, // number of matrices to smooth tracking over, more = smoother but slower follow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
                            smoothTolerance: 0.01, // distance tolerance for smoothing, if smoothThreshold # of matrices are under tolerance, tracking will stay still
                            smoothThreshold: 2 //Wobble control	// threshold for smoothing, will keep still unless enough matrices are over tolerance

                        });
                        globalVar.arMarkerControlsFlag = true; //when the arMarkerControls are actually done, the Animate function can start using it.
                        globalVar.arToolkitContextReadyFlag = true;

                        // Initialize AR.js source

                        console.log("delayed onresize");
                        setTimeout(function () {

                            onResize(); // Call the onResize function here
                            //the onResize function should do the following:
                            //arToolkitSource.onResizeElement();
                            //arToolkitSource.copyElementSizeTo(renderer.domElement);
                            //arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);

                        }, 2000);


                    });
                });
            } else {
                console.error("globalVar.arToolkitSource not loaded when expected by the globalVar.arToolkitContext");
            }

            //end new code

        };


        this.load = function (json) {
            var project = json.project;

            if (project.vr !== undefined) globalVar.renderer.xr.enabled = project.vr;
            if (project.shadows !== undefined) globalVar.renderer.shadowMap.enabled = project.shadows;
            if (project.shadowType !== undefined) globalVar.renderer.shadowMap.type = project.shadowType;
            if (project.toneMapping !== undefined) globalVar.renderer.toneMapping = project.toneMapping;
            if (project.toneMappingExposure !== undefined) globalVar.renderer.toneMappingExposure = project.toneMappingExposure;


            //Start new code:
            // Load the user provided scene from json
            var loadedScene = loader.parse(json.scene);
            // Call the AR setup function with the loaded scene
            this.ARSetup(loadedScene);

            //end new code
            events = {
                init: [],
                start: [],
                stop: [],
                keydown: [],
                keyup: [],
                pointerdown: [],
                pointerup: [],
                pointermove: [],
                update: [],
            };

            var scriptWrapParams = 'player,renderer,scene,camera';
            var scriptWrapResultObj = {};

            for (var eventKey in events) {
                scriptWrapParams += ',' + eventKey;
                scriptWrapResultObj[eventKey] = eventKey;
            }

            var scriptWrapResult = JSON.stringify(scriptWrapResultObj).replace(/\"/g, '');

            for (var uuid in json.scripts) {
                var object = loadedScene.getObjectByProperty('uuid', uuid, true);

                if (object === undefined) {
                    console.warn('APP.Player: Script without object.', uuid);
                    continue;
                }

                var scripts = json.scripts[uuid];

                for (var i = 0; i < scripts.length; i++) {
                    var script = scripts[i];
                    var functions = (new Function(scriptWrapParams, script.source + '\nreturn ' + scriptWrapResult + ';').bind(object))(
                        this,
                        globalVar.renderer,
                        loadedScene,
                        globalVar.camera
                    );

                    for (var name in functions) {
                        if (functions[name] === undefined) continue;

                        if (events[name] === undefined) {
                            console.warn('APP.Player: Event type not supported (', name, ')');
                            continue;
                        }

                        events[name].push(functions[name].bind(object));
                    }
                }
            }



            dispatch(events.init, arguments);
        };

        this.setCamera = function (value) {
            globalVar.camera = value;
            globalVar.camera.aspect = this.width / this.height;
            globalVar.camera.updateProjectionMatrix();

            // Update AR.js context on camera change
            if (globalVar.arToolkitContext && globalVar.arToolkitContext.arController) {
                globalVar.camera.aspect = this.width / this.height;
                globalVar.camera.updateProjectionMatrix();
                globalVar.camera.projectionMatrix.copy(globalVar.arToolkitContext.getProjectionMatrix());
            }
        };

        this.setScene = function (value) {

            //globalVar.scene = value;
            //Set scene would wipe out the import on the AR marker...
            console.error("Do not use the setScene function.");

        };

        this.setPixelRatio = function (pixelRatio) {
            globalVar.renderer.setPixelRatio(pixelRatio);
        };

        this.setSize = function (width, height) {
       
            //The template shouldn't need customized scaling, so just call onResize();
            onResize();

            //Custom resize example
            /*
            this.width = width;
            this.height = height;

            // Update AR.js source dimensions on resize
            if (globalVar.arToolkitSource && globalVar.arToolkitSource.domElement && globalVar.arToolkitContext && globalVar.arToolkitContext.arController) {
                console.log("activating resize");
                globalVar.arToolkitSource.onResizeElement();
                globalVar.arToolkitSource.copyElementSizeTo(globalVar.renderer.domElement);
                //arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);

                if (globalVar.arToolkitContext) {
                    // Update AR camera
                    globalVar.arToolkitSource.copyElementSizeTo(globalVar.arToolkitContext.arController.canvas);
                }
            }

            //Camera adjustments on initial APP load
            if (globalVar.camera) {
                globalVar.camera.aspect = this.width / this.height;
                globalVar.camera.updateProjectionMatrix();
            }

            globalVar.renderer.setSize(width, height);

            //*/
        };

        function dispatch(array, event) {
            for (var i = 0, l = array.length; i < l; i++) {
                array[i](event);
            }
        }


        var time, startTime, prevTime;

        function animate() {
            time = performance.now();

            //The original code uses try/catch to deal with wierd load timing, I'll just use a flag
            if (globalVar.arMarkerControlsFlag) {
                //globalVar.arMarkerControls.update(); //Update should now be handled automatically by THREEx.ArMarkerControls
                // Update AR.js context on each animation frame
                globalVar.arToolkitContext.update(globalVar.arToolkitSource.domElement);
            }

            try {
                dispatch(events.update, { time: time - startTime, delta: time - prevTime });
            } catch (e) {
                console.error((e.message || e), (e.stack || ''));
            }

            // Check if scene and camera are defined before rendering
            if (globalVar.scene && globalVar.camera) {
                globalVar.renderer.render(globalVar.scene, globalVar.camera);
            }

            // Update AR.js on each animation frame
            if (globalVar.arToolkitSource && globalVar.arToolkitSource.ready !== false) {
                globalVar.arToolkitContext.update(globalVar.arToolkitSource.domElement);
            }

            prevTime = time;
        }

        //Old animation function
        /*
      function animate() {
        time = performance.now();
 
        try {
            dispatch(events.update, { time: time - startTime, delta: time - prevTime });
        } catch (e) {
            console.error((e.message || e), (e.stack || ''));
        }
 
        renderer.render(scene, camera);
 
        // Update AR.js on each animation frame
        if (arToolkitSource && arToolkitSource.ready !== false) {
            arToolkitContext.update(arToolkitSource.domElement);
        }
 
        prevTime = time;
     }
    */

        this.play = function () {
            if (globalVar.renderer.xr.enabled) dom.append(vrButton);

            startTime = prevTime = performance.now();

            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);
            document.addEventListener('pointerdown', onPointerDown);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointermove', onPointerMove);

            dispatch(events.start, arguments);

            globalVar.renderer.setAnimationLoop(animate);
        };

        this.stop = function () {
            if (globalVar.renderer.xr.enabled) vrButton.remove();

            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointermove', onPointerMove);

            dispatch(events.stop, arguments);

            globalVar.renderer.setAnimationLoop(null);
        };

        this.render = function (time) {
            dispatch(events.update, { time: time * 1000, delta: 0 });

            globalVar.renderer.render(globalVar.scene, globalVar.camera);
        };

        this.dispose = function () {
            globalVar.renderer.dispose();

            globalVar.camera = undefined;
            globalVar.scene = undefined;
        };

        function onKeyDown(event) {
            dispatch(events.keydown, event);
        }

        function onKeyUp(event) {
            dispatch(events.keyup, event);
        }

        function onPointerDown(event) {
            dispatch(events.pointerdown, event);
        }

        function onPointerUp(event) {
            dispatch(events.pointerup, event);
        }

        function onPointerMove(event) {
            dispatch(events.pointermove, event);
        }

    },
};

export { APP };
