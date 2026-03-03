import { UITabbedPanel, UISpan } from './libs/ui.js';

import { SidebarScene } from './Sidebar.Scene.js';
import { SidebarProperties } from './Sidebar.Properties.js';
import { SidebarScript } from './Sidebar.Script.js';
import { SidebarAnimation } from './Sidebar.Animation.js';
import { SidebarProject } from './Sidebar.Project.js';
import { SidebarSettings } from './Sidebar.Settings.js';
import { SidebarMarkerGenerator } from './Sidebar.MarkerGenerator.js'; //Added to import the Marker Generator
import { SidebarNFTMarkerGenerator } from './Sidebar.NFTMarkerGenerator.js'; //Added to import the Natural Feature Tracking Marker Generator

function Sidebar( editor ) {

	const strings = editor.strings;

	const container = new UITabbedPanel();
	container.setId( 'sidebar' );

	const scene = new UISpan().add(
		new SidebarScene( editor ),
		new SidebarProperties( editor ),
		new SidebarAnimation( editor ),
		new SidebarScript( editor )
	);
	const project = new SidebarProject( editor );
	const settings = new SidebarSettings( editor );

	const markerGenerator = new SidebarMarkerGenerator(editor); //Declare the marker generator before calling it
	const nftGenerator = new SidebarNFTMarkerGenerator(editor); //Declare the Natural Feature Marker Generator before calling it

	container.addTab( 'scene', strings.getKey( 'sidebar/scene' ), scene );
	container.addTab( 'project', strings.getKey( 'sidebar/project' ), project );
	container.addTab( 'settings', strings.getKey( 'sidebar/settings' ), settings );
	container.addTab('nft', 'NFT Marker Generator', nftGenerator); //Calling the Natural Feature Marker Generator
	container.addTab('marker', 'Marker Generator', markerGenerator); //Calling the marker generator
	
	// Force Scene tab to be selected after all tabs are registered
	container.select( 'scene' );

	return container;

}

export { Sidebar };
