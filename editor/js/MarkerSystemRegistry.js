const markerSystems = new Map();
const markerStateEntries = new Map();

function normalizeLegacyNames( markerSystem, existingMarkerSystem ) {

	return Array.from( new Set( [
		... ( existingMarkerSystem?.legacyPreviewNames || [] ),
		... ( markerSystem.legacyPreviewNames || [] )
	] ) );

}

function applyStoredMarkerState( markerSystem ) {

	const entry = markerStateEntries.get( markerSystem.id );
	let state = entry?.state ?? null;

	if ( state !== null && markerSystem.migrateState !== undefined ) {

		state = markerSystem.migrateState( state, entry.version );
		markerStateEntries.set( markerSystem.id, {
			version: markerSystem.stateVersion || 1,
			state: state
		} );

	}

	if ( state !== null && markerSystem.validateState !== undefined && markerSystem.validateState( state ) === false ) {

		markerStateEntries.delete( markerSystem.id );
		state = null;

	}

	markerSystem.applyState?.( state );

}

function registerMarkerSystem( markerSystem ) {

	if ( typeof markerSystem?.id !== 'string' || markerSystem.id === '' ) {

		throw new Error( 'Marker systems require a non-empty id.' );

	}

	const existingMarkerSystem = markerSystems.get( markerSystem.id );
	const registeredMarkerSystem = {
		... existingMarkerSystem,
		... markerSystem,
		legacyPreviewNames: normalizeLegacyNames( markerSystem, existingMarkerSystem )
	};

	markerSystems.set( markerSystem.id, registeredMarkerSystem );
	applyStoredMarkerState( registeredMarkerSystem );

	return registeredMarkerSystem;

}

function getMarkerSystem( markerSystemId ) {

	return markerSystems.get( markerSystemId );

}

function getMarkerSystems() {

	return Array.from( markerSystems.values() );

}

function setMarkerSystemState( markerSystemId, state ) {

	const markerSystem = markerSystems.get( markerSystemId );

	if ( markerSystem === undefined ) {

		throw new Error( `Unknown marker system: ${markerSystemId}` );

	}

	if ( state === null || state === undefined ) {

		markerStateEntries.delete( markerSystemId );
		markerSystem.applyState?.( null );
		return null;

	}

	if ( markerSystem.validateState !== undefined && markerSystem.validateState( state ) === false ) {

		throw new Error( `Invalid active marker state for: ${markerSystemId}` );

	}

	markerStateEntries.set( markerSystemId, {
		version: markerSystem.stateVersion || 1,
		state: state
	} );
	markerSystem.applyState?.( state );

	return state;

}

function getMarkerSystemState( markerSystemId ) {

	return markerStateEntries.get( markerSystemId )?.state ?? null;

}

function createMarkerStateSnapshot() {

	const snapshot = {};

	for ( const [ markerSystemId, entry ] of markerStateEntries ) {

		snapshot[ markerSystemId ] = entry;

	}

	return snapshot;

}

function restoreMarkerStateSnapshot( snapshot = {} ) {

	markerStateEntries.clear();

	for ( const [ markerSystemId, markerSystem ] of markerSystems ) {

		markerSystem.applyState?.( null );

	}

	for ( const [ markerSystemId, value ] of Object.entries( snapshot || {} ) ) {

		const hasEntryShape = value !== null && typeof value === 'object' && 'state' in value;
		markerStateEntries.set( markerSystemId, hasEntryShape ? value : { version: 1, state: value } );

	}

	for ( const markerSystem of markerSystems.values() ) {

		applyStoredMarkerState( markerSystem );

	}

}

function markMarkerPreview( markerPreview, markerSystemId ) {

	markerPreview.userData.editorMarkerPreview = true;
	markerPreview.userData.markerSystemId = markerSystemId;

	return markerPreview;

}

function getMarkerPreviewSystemId( object ) {

	if ( object?.userData?.editorMarkerPreview === true ) {

		return object.userData.markerSystemId || null;

	}

	for ( const markerSystem of markerSystems.values() ) {

		if ( markerSystem.legacyPreviewNames.includes( object?.name ) ) return markerSystem.id;

	}

	return null;

}

function isMarkerPreviewObject( object ) {

	return getMarkerPreviewSystemId( object ) !== null;

}

function removeMarkerPreviewsFromScene( scene ) {

	const markerPreviews = [];

	scene.traverse( function ( object ) {

		if ( object !== scene && isMarkerPreviewObject( object ) ) markerPreviews.push( object );

	} );

	for ( const markerPreview of markerPreviews ) {

		markerPreview.parent?.remove( markerPreview );

	}

	return markerPreviews;

}

function preserveObjectUUIDs( sourceObject, clonedObject ) {

	clonedObject.uuid = sourceObject.uuid;

	for ( let index = 0; index < sourceObject.children.length; index ++ ) {

		preserveObjectUUIDs( sourceObject.children[ index ], clonedObject.children[ index ] );

	}

}

function cloneSceneWithoutMarkerPreviews( scene ) {

	const sceneClone = scene.clone( true );
	preserveObjectUUIDs( scene, sceneClone );
	removeMarkerPreviewsFromScene( sceneClone );

	return sceneClone;

}

export {
	cloneSceneWithoutMarkerPreviews,
	createMarkerStateSnapshot,
	getMarkerPreviewSystemId,
	getMarkerSystem,
	getMarkerSystems,
	getMarkerSystemState,
	isMarkerPreviewObject,
	markMarkerPreview,
	registerMarkerSystem,
	removeMarkerPreviewsFromScene,
	restoreMarkerStateSnapshot,
	setMarkerSystemState
};