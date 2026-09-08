// Import the editor's small UI wrapper classes. They create normal HTML
// elements while providing chainable methods such as setWidth() and onChange().
import { UISpan, UIRow, UIText, UIInput, UICheckbox } from './libs/ui.js';

// These settings are shared by the sidebar controls and the QR publish command
// for the current editor session.
let trackSpecificQRCode = false;
let qrCodeInfo = '';

// Return the value in the format expected by the publish command.
// An empty string tells the exported app to keep its default QR behavior.
function getTrackedQRCodeData() {

	return trackSpecificQRCode ? qrCodeInfo : '';

}

// Build the QR Code Generator panel shown in the editor sidebar.
// Sidebar.js adds the returned UI element as a tab.
function SidebarQRCodeGenerator() {

	// Create the outer panel. The editor's UI classes are lightweight wrappers
	// around DOM elements, and each wrapper exposes its underlying .dom node.
	const container = new UISpan();
	container.setId( 'sidebar-qr-code-generator' );
	container.setDisplay( 'block' );
	container.setWidth( '100%' );
	container.dom.style.boxSizing = 'border-box';

	const content = new UISpan();
	content.setDisplay( 'block' );
	content.setWidth( '100%' );
	content.setPaddingLeft( '14px' );
	content.setPaddingTop( '20px' );
	content.setPaddingRight( '10px' );
	content.dom.style.boxSizing = 'border-box';
	container.add( content );

	// Add the panel heading.
	const header = new UIText( 'QR Code Generator' );
	header.setDisplay( 'block' );
	header.setFontSize( '14px' );
	header.setMarginBottom( '12px' );
	content.add( header );

	// UIRow groups the label and checkbox horizontally. The fixed label width
	// keeps this control aligned with other sidebar controls.
	const trackingRow = new UIRow();
	const trackingCheckbox = new UICheckbox( trackSpecificQRCode );
	trackingRow.add( new UIText( 'Track specific QR Code' ).setWidth( '170px' ) );
	trackingRow.add( trackingCheckbox );
	content.add( trackingRow );

	// This section is only needed when the user wants to track one particular
	// QR code. It starts hidden unless the setting is already enabled.
	const qrCodeInfoSection = new UISpan();
	qrCodeInfoSection.setDisplay( trackSpecificQRCode ? 'block' : 'none' );
	qrCodeInfoSection.setMarginTop( '8px' );

	// The user enters the text/value encoded by the QR code to track.
	const qrCodeInfoLabel = new UIText( 'Enter the QR Code Info' );
	qrCodeInfoLabel.setDisplay( 'block' );
	qrCodeInfoLabel.setMarginBottom( '6px' );
	qrCodeInfoSection.add( qrCodeInfoLabel );

	// UIInput wraps a normal text input. Initialize it with the shared value so
	// the visible control reflects the current editor-session state.
	const qrCodeInfoInput = new UIInput( qrCodeInfo );
	qrCodeInfoInput.setWidth( '100%' );
	qrCodeInfoInput.dom.style.boxSizing = 'border-box';
	qrCodeInfoInput.onInput( function () {

		// onInput fires as the user types. Keeping this shared value updated means
		// Publish can read the latest text even if the input has not lost focus.
		qrCodeInfo = this.getValue();

	} );
	qrCodeInfoSection.add( qrCodeInfoInput );
	content.add( qrCodeInfoSection );

	// Show or hide the text field when the checkbox changes, and keep the
	// shared setting synchronized with the checkbox's boolean value.
	trackingCheckbox.onChange( function () {

		trackSpecificQRCode = this.getValue();
		qrCodeInfoSection.setDisplay( trackSpecificQRCode ? 'block' : 'none' );

	} );

	// Sidebar.js uses this returned element as the contents of the sidebar tab.
	return container;

}

// Export the panel constructor for Sidebar.js and the getter for publishing.
export { SidebarQRCodeGenerator, getTrackedQRCodeData };
