// Import the editor's small UI wrapper classes. They create normal HTML
// elements while providing chainable methods such as setWidth() and onChange().
import {
	UISpan, UIRow, UIText, UIInput, UISelect, UICheckbox, UIColor, UINumber, UIButton, UIHorizontalRule
} from './libs/ui.js';
import {
	QR_CODE_RENDER_SETTING_GROUPS,
	getQRCodeSettingConfigKey,
	getQRCodeRenderSettingValue
} from './QRCodeRenderSettings.js';

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
function SidebarQRCodeGenerator( editor ) {

	const config = editor?.config ?? window._editor?.config;

	if ( config === undefined ) {

		throw new Error( 'The QR Code Generator requires the editor configuration.' );

	}

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

	function makeInfoButton( infoText ) {

		const wrapper = document.createElement( 'span' );
		wrapper.style.position = 'relative';
		wrapper.style.display = 'inline-flex';
		wrapper.style.alignItems = 'center';

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.textContent = 'i';
		button.setAttribute( 'aria-label', `Information: ${infoText}` );
		button.style.width = '16px';
		button.style.height = '16px';
		button.style.padding = '0';
		button.style.border = '1px solid currentColor';
		button.style.borderRadius = '50%';
		button.style.background = 'transparent';
		button.style.color = 'inherit';
		button.style.font = 'bold 12px/14px sans-serif';
		button.style.cursor = 'help';
		button.setAttribute( 'aria-pressed', 'false' );

		const tooltip = document.createElement( 'span' );
		tooltip.textContent = infoText;
		tooltip.style.display = 'none';
		tooltip.style.position = 'fixed';
		tooltip.style.width = '220px';
		tooltip.style.maxWidth = 'calc(100vw - 16px)';
		tooltip.style.boxSizing = 'border-box';
		tooltip.style.padding = '7px 9px';
		tooltip.style.background = '#fff';
		tooltip.style.color = '#444';
		tooltip.style.border = '1px solid #aaa';
		tooltip.style.borderRadius = '3px';
		tooltip.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
		tooltip.style.font = '12px/1.35 sans-serif';
		tooltip.style.whiteSpace = 'normal';
		tooltip.style.textAlign = 'left';
		tooltip.style.zIndex = '2147483647';
		tooltip.style.pointerEvents = 'none';

		let pinned = false;
		const positionTooltip = () => {

			const buttonRect = button.getBoundingClientRect();
			const tooltipRect = tooltip.getBoundingClientRect();
			const viewportPadding = 8;
			const gap = 5;
			const maxLeft = Math.max( viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding );
			const left = Math.min( maxLeft, Math.max( viewportPadding, buttonRect.right - tooltipRect.width ) );
			let top = buttonRect.bottom + gap;

			if ( top + tooltipRect.height > window.innerHeight - viewportPadding ) {

				top = buttonRect.top - tooltipRect.height - gap;

			}

			tooltip.style.left = `${left}px`;
			tooltip.style.top = `${Math.max( viewportPadding, top )}px`;

		};
		const showTooltip = () => {

			if ( !tooltip.isConnected ) document.body.appendChild( tooltip );
			tooltip.style.display = 'block';
			positionTooltip();
			window.addEventListener( 'resize', positionTooltip );
			window.addEventListener( 'scroll', positionTooltip, true );

		};
		const removeTooltip = () => {

			tooltip.remove();
			window.removeEventListener( 'resize', positionTooltip );
			window.removeEventListener( 'scroll', positionTooltip, true );

		};
		const hideTooltip = () => {

			if ( !pinned ) removeTooltip();

		};

		button.addEventListener( 'mouseenter', showTooltip );
		button.addEventListener( 'mouseleave', hideTooltip );
		button.addEventListener( 'focus', showTooltip );
		button.addEventListener( 'blur', hideTooltip );
		button.addEventListener( 'click', ( event ) => {

			event.stopPropagation();
			pinned = !pinned;
			button.setAttribute( 'aria-pressed', String( pinned ) );
			button.style.filter = pinned ? 'invert(1)' : 'none';
			if ( pinned ) showTooltip();
			else removeTooltip();

		} );

		wrapper.appendChild( button );
		return wrapper;

	}

	function makeSettingControl( setting ) {

		const value = getQRCodeRenderSettingValue( config, setting );
		let control;

		if ( setting.type === 'boolean' ) {

			control = new UICheckbox( value );

		} else if ( setting.type === 'select' ) {

			control = new UISelect().setWidth( '96px' );
			control.setOptions( setting.options );
			control.setValue( value );

		} else if ( setting.type === 'color' ) {

			control = new UIColor().setHexValue( value );

		} else {

			control = new UINumber();
			control.setPrecision( setting.precision ?? 2 );
			control.setRange( setting.min ?? -Infinity, setting.max ?? Infinity );
			control.setStep( setting.step ?? 1 );
			control.setWidth( '96px' );
			control.setValue( value );

		}

		control.dom.setAttribute( 'aria-label', setting.label );
		control.onChange( () => {

			const nextValue = setting.type === 'color' ? control.getHexValue() : control.getValue();
			config.setKey( getQRCodeSettingConfigKey( setting ), nextValue );

		} );

		return control;

	}

	function setControlValue( control, setting, value ) {

		if ( setting.type === 'color' ) control.setHexValue( value );
		else control.setValue( value );

	}

	// Add the panel heading.
	const header = new UIText( 'QR Code Generator' );
	header.setDisplay( 'block' );
	header.setFontSize( '14px' );
	header.setMarginBottom( '12px' );
	content.add( header );

	// UIRow groups the label and checkbox horizontally. The fixed label width
	// keeps this control aligned with other sidebar controls.
	const trackingRow = new UIRow();
	trackingRow.dom.style.display = 'grid';
	trackingRow.dom.style.gridTemplateColumns = 'minmax(0, 1fr) 16px 96px';
	trackingRow.dom.style.gap = '6px';
	const trackingCheckbox = new UICheckbox( trackSpecificQRCode );
	trackingCheckbox.dom.setAttribute( 'aria-label', 'Track specific QR Code' );
	trackingRow.add( new UIText( 'Track specific QR Code' ) );
	trackingRow.dom.appendChild( makeInfoButton(
		'When enabled, the exported tracker responds only to a QR code containing the exact data entered below.'
	) );
	trackingRow.add( trackingCheckbox );
	content.add( trackingRow );

	// This section is only needed when the user wants to track one particular
	// QR code. It starts hidden unless the setting is already enabled.
	const qrCodeInfoSection = new UISpan();
	qrCodeInfoSection.setDisplay( trackSpecificQRCode ? 'block' : 'none' );
	qrCodeInfoSection.setMarginTop( '8px' );

	// The user enters the text/value encoded by the QR code to track.
	const qrCodeInfoLabelRow = new UIRow();
	qrCodeInfoLabelRow.setMarginBottom( '6px' );
	qrCodeInfoLabelRow.dom.style.display = 'grid';
	qrCodeInfoLabelRow.dom.style.gridTemplateColumns = 'minmax(0, 1fr) 16px';
	qrCodeInfoLabelRow.dom.style.gap = '6px';
	qrCodeInfoLabelRow.add( new UIText( 'Enter the QR Code Info' ) );
	qrCodeInfoLabelRow.dom.appendChild( makeInfoButton(
		'Exact text or data encoded in the QR code to track. Leave specific tracking disabled to follow the first detected QR code.'
	) );
	qrCodeInfoSection.add( qrCodeInfoLabelRow );

	// UIInput wraps a normal text input. Initialize it with the shared value so
	// the visible control reflects the current editor-session state.
	const qrCodeInfoInput = new UIInput( qrCodeInfo );
	qrCodeInfoInput.setWidth( '100%' );
	qrCodeInfoInput.dom.setAttribute( 'aria-label', 'Enter the QR Code Info' );
	qrCodeInfoInput.dom.style.boxSizing = 'border-box';
	qrCodeInfoInput.onInput( function () {

		// onInput fires as the user types. Keeping this shared value updated means
		// Publish can read the latest text even if the input has not lost focus.
		qrCodeInfo = this.getValue();

	} );
	qrCodeInfoSection.add( qrCodeInfoInput );
	content.add( qrCodeInfoSection );

	content.add( new UIHorizontalRule().setMarginTop( '12px' ) );

	const settingsTitle = new UIText( 'QR Tracker Settings' );
	settingsTitle.setDisplay( 'block' );
	settingsTitle.setFontSize( '13px' );
	settingsTitle.setMarginBottom( '8px' );
	content.add( settingsTitle );

	const settingControls = [];

	for ( const group of QR_CODE_RENDER_SETTING_GROUPS ) {

		const groupElement = document.createElement( 'details' );
		groupElement.open = group.open === true;
		groupElement.style.marginBottom = '8px';
		groupElement.style.borderBottom = '1px solid #ccc';
		groupElement.style.paddingBottom = '6px';

		const groupSummary = document.createElement( 'summary' );
		groupSummary.textContent = group.title;
		groupSummary.style.cursor = 'pointer';
		groupSummary.style.fontSize = '12px';
		groupSummary.style.fontWeight = 'bold';
		groupSummary.style.marginBottom = '8px';
		groupElement.appendChild( groupSummary );

		const groupDescription = document.createElement( 'p' );
		groupDescription.textContent = group.description;
		groupDescription.style.margin = '0 0 10px 0';
		groupDescription.style.color = '#888';
		groupDescription.style.fontSize = '12px';
		groupDescription.style.lineHeight = '1.4';
		groupDescription.style.userSelect = 'text';
		groupElement.appendChild( groupDescription );

		for ( const setting of group.settings ) {

			const row = new UIRow();
			row.setMarginBottom( '6px' );
			row.dom.style.display = 'grid';
			row.dom.style.gridTemplateColumns = 'minmax(0, 1fr) 16px 96px';
			row.dom.style.gap = '6px';
			row.dom.style.alignItems = 'center';

			const label = new UIText( setting.label );
			label.dom.style.whiteSpace = 'normal';
			label.dom.style.overflowWrap = 'anywhere';
			row.add( label );
			row.dom.appendChild( makeInfoButton( setting.info ) );

			const control = makeSettingControl( setting );
			row.add( control );
			groupElement.appendChild( row.dom );
			settingControls.push( { setting, control } );

		}

		content.dom.appendChild( groupElement );

	}

	const resetSettingsButton = new UIButton( 'Reset QR Settings' );
	resetSettingsButton.setMarginBottom( '10px' );
	resetSettingsButton.onClick( () => {

		const configValues = [];

		for ( const { setting, control } of settingControls ) {

			setControlValue( control, setting, setting.defaultValue );
			configValues.push( getQRCodeSettingConfigKey( setting ), setting.defaultValue );

		}

		config.setKey( ...configValues );

	} );
	content.add( resetSettingsButton );

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
