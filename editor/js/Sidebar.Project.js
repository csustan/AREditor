import { UIPanel, UIRow, UIInput, UICheckbox, UIText, UISpan } from './libs/ui.js';

/* import { SidebarProjectMaterials } from './Sidebar.Project.Materials.js'; */
import { SidebarProjectRenderer } from './Sidebar.Project.Renderer.js';
import { SidebarProjectVideo } from './Sidebar.Project.Video.js';

function createProjectTitleRow( editor ) {

	const strings = editor.strings;
	const title = new UIInput( editor.config.getKey( 'project/title' ) ).setLeft( '100px' ).setWidth( '150px' );
	const titleLabel = strings.getKey( 'sidebar/project/title' );
	const titleRow = new UIRow();

	title.dom.setAttribute( 'aria-label', titleLabel );
	title.onChange( function () {

		editor.setProjectTitle( this.getValue() );

	} );

	editor.signals.projectTitleChanged.add( function ( value ) {

		if ( title.getValue() !== value ) title.setValue( value );

	} );

	titleRow.add( new UIText( titleLabel ).setWidth( '90px' ) );
	titleRow.add( title );

	return titleRow;

}

function SidebarProject( editor ) {

	const config = editor.config;
	const signals = editor.signals;
	const strings = editor.strings;

	const container = new UISpan();

	const settings = new UIPanel();
	settings.setBorderTop( '0' );
	settings.setPaddingTop( '20px' );
	container.add( settings );

	// Title

	settings.add( createProjectTitleRow( editor ) );

	// Editable

	const editableRow = new UIRow();
	const editable = new UICheckbox( config.getKey( 'project/editable' ) ).setLeft( '100px' ).onChange( function () {

		config.setKey( 'project/editable', this.getValue() );

	} );

	editableRow.add( new UIText( strings.getKey( 'sidebar/project/editable' ) ).setWidth( '90px' ) );
	editableRow.add( editable );

	settings.add( editableRow );

	// WebVR

	const vrRow = new UIRow();
	const vr = new UICheckbox( config.getKey( 'project/vr' ) ).setLeft( '100px' ).onChange( function () {

		config.setKey( 'project/vr', this.getValue() );

	} );

	vrRow.add( new UIText( strings.getKey( 'sidebar/project/vr' ) ).setWidth( '90px' ) );
	vrRow.add( vr );

	settings.add( vrRow );

	//

	/* container.add( new SidebarProjectMaterials( editor ) ); */
	container.add( new SidebarProjectRenderer( editor ) );

	if ( 'SharedArrayBuffer' in window ) {

		container.add( new SidebarProjectVideo( editor ) );

	}

	// Signals

	signals.editorCleared.add( function () {

		editor.setProjectTitle( '' );

	} );

	return container;

}

export { SidebarProject, createProjectTitleRow };
