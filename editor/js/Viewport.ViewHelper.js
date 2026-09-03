import { UIButton, UIPanel } from './libs/ui.js';

import { ViewHelper as ViewHelperBase } from '../../examples/jsm/helpers/ViewHelper.js';

// Camera values are floating-point numbers, so normal camera math can leave a
// very small difference instead of returning to exactly the original value.
// Treat values within this tolerance as equal. If the button incorrectly
// changes state while the camera appears stationary, inspect the three checks
// in isAtHome() before changing this value.
const CAMERA_POSE_EPSILON = 1e-10;

class ViewHelper extends ViewHelperBase {

	/**
	 * Adds the clickable orientation gizmo and its Home/Last Position button.
	 *
	 * A saved camera view has three parts that must always be handled together:
	 * - position: where the camera is located;
	 * - quaternion: which direction the camera is facing; and
	 * - controls.center: the point around which EditorControls rotates.
	 *
	 * Omitting controls.center may make the restored image look correct at first,
	 * but the next orbit will jump around the wrong point.
	 *
	 * @param {Object} editorCamera The editor camera being moved.
	 * @param {UIPanel} container The viewport UI panel that owns both controls.
	 * @param {Object} controls The EditorControls instance for editorCamera.
	 */
	constructor( editorCamera, container, controls ) {

		super( editorCamera, container.dom );

		const panel = new UIPanel();
		panel.setId( 'viewHelper' );
		panel.setPosition( 'absolute' );
		panel.setRight( '0px' );
		panel.setBottom( '0px' );
		panel.setHeight( '128px' );
		panel.setWidth( '128px' );

		panel.dom.addEventListener( 'pointerup', ( event ) => {

			event.stopPropagation();

			this.handleClick( event );

		} );

		panel.dom.addEventListener( 'pointerdown', function ( event ) {

			event.stopPropagation();

		} );

		container.add( panel );

		// Capture the application's starting view once. clone() is essential here:
		// Three.js vectors and quaternions are mutable, so storing the camera's
		// objects directly would cause this "saved" pose to move with the camera.
		const homePose = {
			position: editorCamera.position.clone(),
			quaternion: editorCamera.quaternion.clone(),
			center: controls.center.clone()
		};

		// null means the user has not returned home from another view yet. Keeping
		// this distinction lets the initial Last Position state remain disabled.
		let lastPose = null;

		// Place the button eight pixels to the left of the 128px-wide gizmo. The
		// width fits the longer label at the editor's 12px UI font, including on a
		// 320px-wide viewport. Recheck both labels if the font or wording changes.
		const returnButton = new UIButton();
		returnButton.setId( 'cameraHome' );
		returnButton.setPosition( 'absolute' );
		returnButton.setRight( '136px' );
		returnButton.setBottom( '50px' );
		returnButton.setWidth( '184px' );
		returnButton.setHeight( '28px' );
		returnButton.dom.type = 'button';

		// Return a detached snapshot of the current view. Every field is cloned so
		// later camera movement cannot alter the saved Last Position by reference.
		function capturePose() {

			return {
				position: editorCamera.position.clone(),
				quaternion: editorCamera.quaternion.clone(),
				center: controls.center.clone()
			};

		}

		// Compare all three pose components. distanceToSquared() avoids an
		// unnecessary square root. Quaternion q and -q describe the same rotation,
		// so the absolute dot product is used for the orientation comparison.
		function isAtHome() {

			return editorCamera.position.distanceToSquared( homePose.position ) < CAMERA_POSE_EPSILON &&
				Math.abs( editorCamera.quaternion.dot( homePose.quaternion ) ) > 1 - CAMERA_POSE_EPSILON &&
				controls.center.distanceToSquared( homePose.center ) < CAMERA_POSE_EPSILON;

		}

		// This is the button's complete state machine:
		// - Away from home: offer Camera to Home.
		// - At home with a saved pose: offer Camera to last position.
		// - At home without a saved pose: show Last Position, but disable it.
		// - Looking through a scene camera: disable this editor-camera control.
		//
		// data-camera-action is useful when troubleshooting in browser DevTools or
		// writing an automated test; it exposes the current action as home or last.
		const updateCameraState = function () {

			const atHome = isAtHome();
			const label = atHome ? 'Camera to last position' : 'Camera to Home';

			returnButton.dom.textContent = label;
			returnButton.dom.title = label;
			returnButton.dom.setAttribute( 'aria-label', label );
			returnButton.dom.dataset.cameraAction = atHome ? 'last' : 'home';
			returnButton.dom.disabled = controls.enabled === false || ( atHome && lastPose === null );

		};

		// Restore a complete pose immediately. Stop a ViewHelper axis animation
		// first so its next frame cannot overwrite the restored position. Dispatch
		// the controls' change event instead of rendering directly; Viewport.js
		// already uses that event to update the sidebar, button, and renderer.
		const applyPose = ( pose ) => {

			this.animating = false;
			editorCamera.position.copy( pose.position );
			editorCamera.quaternion.copy( pose.quaternion );
			controls.center.copy( pose.center );
			editorCamera.updateMatrixWorld();
			controls.dispatchEvent( { type: 'change' } );
			updateCameraState();

		};

		// The button overlaps the viewport's pointer-event area. Without stopping
		// pointerdown here, pressing it could also begin an EditorControls orbit.
		returnButton.dom.addEventListener( 'pointerdown', function ( event ) {

			event.stopPropagation();

		} );

		// Save the current view only when traveling home. When already home, reuse
		// that snapshot so repeated button presses toggle between the same views.
		returnButton.dom.addEventListener( 'click', ( event ) => {

			event.stopPropagation();

			if ( isAtHome() ) {

				if ( lastPose !== null ) applyPose( lastPose );

			} else {

				lastPose = capturePose();
				applyPose( homePose );

			}

		} );

		container.add( returnButton );

		// Viewport.js calls this hook after every way the camera can change. If the
		// label becomes stale after adding a new camera movement feature, call this
		// method from that feature's camera-change path.
		this.updateCameraState = updateCameraState;

		// A project load or editor reset starts a new camera-history session. Clear
		// the old snapshot so Last Position can never return to the previous file.
		this.resetCameraHistory = function () {

			lastPose = null;
			updateCameraState();

		};

		// Initialize the label and disabled state before the first user interaction.
		updateCameraState();

	}

}

export { ViewHelper };
