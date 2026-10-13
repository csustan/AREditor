# Adding marker systems

Marker systems register their viewport and persistence behavior with `MarkerSystemRegistry.js`. Registration gives the system one managed viewport preview, IndexedDB restoration, legacy-preview cleanup, and automatic exclusion from saved and exported scenes.

Register the adapter when the marker module is imported:

```js
registerMarkerSystem( {
	id: 'example',
	label: 'Example Marker Preview',
	stateVersion: 1,
	legacyPreviewNames: [ 'OldExampleMarkerPreviewName' ],
	createPreview: createExampleMarkerPreview,
	updatePreview: updateExampleMarkerPreview,
	validateState: ( state ) => state?.imageBlob instanceof Blob,
	applyState: ( state ) => {
		// Synchronize compatibility globals or module state used by publishing.
	},
	migrateState: ( state, storedVersion ) => state
} );
```

`createPreview( onUpdate )` returns a Three.js object. `updatePreview( preview, onUpdate )` refreshes that object from the active registry state. Call `onUpdate( preview )` after asynchronous texture or geometry changes. The viewport manager tags returned objects automatically, although factories may also call `markMarkerPreview()`.

Commit only complete, successfully generated output:

```js
setMarkerSystemState( 'example', activeState );
editor.signals.markerStateChanged.dispatch( 'example' );
```

Reset through the same path:

```js
setMarkerSystemState( 'example', null );
editor.signals.markerStateChanged.dispatch( 'example' );
```

Active state must support the browser structured-clone algorithm. Use values such as strings, numbers, `Blob`, `ArrayBuffer`, and typed arrays. Do not store DOM elements, Three.js textures, `ImageBitmap` objects, or object URLs. Keep pending uploads outside the registry so browser restoration always returns the last complete active marker.

Increment `stateVersion` when the stored shape changes and provide `migrateState()` for older versions. Add previous preview object names to `legacyPreviewNames`; the editor removes those objects when loading older autosaves.