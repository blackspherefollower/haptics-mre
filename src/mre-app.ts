import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { ButtplugClient, ButtplugServer, ButtplugEmbeddedClientConnector } from 'buttplug';
import { User, Guid } from '@microsoft/mixed-reality-extension-sdk';

/**
 * BPInterfaceMRE Application - Showcasing avatar attachments.
 */
export default class BPInteractionMRE {
	// Container for preloaded hat prefabs.
	private assets: MRE.AssetContainer;

	private userMap = new Map<string, Guid>();

	/**
	 * Constructs a new instance of this class.
	 * @param context The MRE SDK context.
	 * @param baseUrl The baseUrl to this project's `./public` folder.
	 */
	constructor(private context: MRE.Context, private baseUrl: string, private bridge: Map<string, ButtplugServer>) {
		this.assets = new MRE.AssetContainer(context);

		// Hook the context events we're interested in.
		this.context.onStarted(() => this.started());
		this.context.onStopped(() => { MRE.log.info("app", "Last user has left") });
		this.context.onUserJoined( async (user: User) => {
			MRE.log.info("app", "User has joined: ", user);
			const res = await user.prompt("Got Buttplug?", true);
			if( res.submitted ) {
				MRE.log.info("app", "User has buttplug: ", res.text, user.name, user.id);
				if(res.text.length === 6) {
					if(bridge.has(res.text)) {
						this.userMap.set(res.text, user.id);
						this.createBuzzButton(user.id, res.text);
					}
				}
			} else {
				MRE.log.info("app", "User hasn't a buttplug", user.name, user.id);
			}
		});
		this.context.onUserLeft((user: User) => { MRE.log.info("app", "User has left: ", user) });
	}

	/**
	 * Called when a BPInteractionMRE application session starts up.
	 */
	private started() {
		MRE.log.info("app", "Starting up");
	}
	
	private createBuzzButton(user: Guid, room: string) {
		
		// Create a parent object for all the menu items.
		const menu = MRE.Actor.Create(this.context, {});
		const y = 0.3;

		// Create menu button
		const buttonMesh = this.assets.createBoxMesh('button', 0.3, 0.3, 0.01);

		// Create a clickable button.
		const button = MRE.Actor.Create(this.context, {
			actor: {
				parentId: menu.id,
				exclusiveToUser: user,
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
			.onClick(userId => this.buzz(userId, room));

		// Create a label for the menu entry.
		MRE.Actor.Create(this.context, {
			actor: {
				parentId: menu.id,
				exclusiveToUser: user,
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
	}
  
	private async buzz(user: User, room: string) {
		const bps = this.bridge.get(room);
		if(bps === null || bps === undefined) {
			return;
		}

		const client = new ButtplugClient("MRe VR Client");
		const conn = new ButtplugEmbeddedClientConnector();
		conn.Server = bps;
		await client.Connect(conn);
		await client.StartScanning();
		for(const dev of client.Devices) {
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
