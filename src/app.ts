import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { ButtplugClient } from 'buttplug';
import { ButtplugNodeWebsocketClientConnector } from 'buttplug-node-websockets';
import { User } from '@microsoft/mixed-reality-extension-sdk';

MRE.log.enable("app");

/**
 * BPInterfaceMRE Application - Showcasing avatar attachments.
 */
export default class BPInteractionMRE {
	// Container for preloaded hat prefabs.
	private assets: MRE.AssetContainer;

	// Client buttplug connection
	private client: ButtplugClient;

	/**
	 * Constructs a new instance of this class.
	 * @param context The MRE SDK context.
	 * @param baseUrl The baseUrl to this project's `./public` folder.
	 */
	constructor(private context: MRE.Context, private baseUrl: string) {
		this.assets = new MRE.AssetContainer(context);

		this.client = new ButtplugClient("AltSpaceVR");
	

		// Hook the context events we're interested in.
		this.context.onStarted(() => this.started());
		this.context.onStopped(() => { MRE.log.info("app", "Last user has left") });
		this.context.onUserJoined( async (user: User) => {
			MRE.log.info("app", "User has joined: ", user);
			const res = await user.prompt("Got Buttplug?", true);
			if( res.submitted ) {
				MRE.log.info("app", "User has buttplug: ", res.text, user.name, user.id);
			} else {
				MRE.log.info("app", "User hasn't a buttplug", user.name, user.id);
			}
		});
		this.context.onUserLeft((user: User) => { MRE.log.info("app", "User has left: ", user) });
	}

	/**
	 * Called when a BPInteractionMRE application session starts up.
	 */
	private async started() {
		MRE.log.info("app", "Starting up");
		// Currently only connecting to localhost.
		//TODO: UI for selecting the Buttplug server URI on a per-user basis
		const conn = new ButtplugNodeWebsocketClientConnector("wss://magnificent-eastern-ninja.glitch.me", false);
		await this.client.Connect(conn);
		await this.client.StartScanning();

		// Quick hack to make sure we only show the buzz control once buttplug is connected and a device is connected
		this.client.addListener('deviceadded', () => {
			// Create a parent object for all the menu items.
			const menu = MRE.Actor.Create(this.context, {});
			const y = 0.3;

			// Create menu button
			const buttonMesh = this.assets.createBoxMesh('button', 0.3, 0.3, 0.01);

			// Create a clickable button.
			const button = MRE.Actor.Create(this.context, {
				actor: {
					parentId: menu.id,
					name: "gfg0",
					appearance: { meshId: buttonMesh.id },
					collider: { geometry: { shape: MRE.ColliderType.Auto } },
					transform: {
						local: { position: { x: 0, y, z: 0 } }
					}
				}
			});

			// Set a click handler on the button.
			button.setBehavior(MRE.ButtonBehavior)
			.onClick(user => this.buzz());

			// Create a label for the menu entry.
			MRE.Actor.Create(this.context, {
				actor: {
					parentId: menu.id,
					name: 'label',
					text: {
						contents: "Buzz",
						height: 0.5,
						anchor: MRE.TextAnchorLocation.MiddleLeft
					},
					transform: {
						local: { position: { x: 0.5, y, z: 0 } }
					}
				}
			});
		});
	}
  
	private async buzz() {
		for(const dev of this.client.Devices) {
			if (dev.AllowedMessages.includes("VibrateCmd")) {
				await dev.SendVibrateCmd(1.0);
				
				// Now we set a timeout for 3 seconds in the future, to stop the device.
				setTimeout(async () => {
					await dev.SendStopDeviceCmd();
				}, 3000);
			}
		}
	}
}
