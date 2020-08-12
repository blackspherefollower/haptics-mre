import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { User, Guid } from '@microsoft/mixed-reality-extension-sdk';
import { Room } from './Room';
import { isNullOrUndefined } from 'util';

/**
 * BPInterfaceMRE Application - Haptics from VR
 */
export default class BPInteractionMRE {
	// Container for preloaded hat prefabs.
	private assets: MRE.AssetContainer;

	private uplinker: MRE.Actor = null;

	private userMap = new Map<string, Guid>();

	private roomMap = new Map<Guid, Room>();
	private colliderMap = new Map<Guid, Map<MRE.AttachPoint, MRE.Actor>>();

	/**
	 * Constructs a new instance of this class.
	 * @param context The MRE SDK context.
	 * @param baseUrl The baseUrl to this project's `./public` folder.
	 * @param bridge The mappings between room IDs and Buttplug connection objects
	 */
	constructor(private context: MRE.Context, private baseUrl: string, private bridge: Map<string, Room>) {
		this.assets = new MRE.AssetContainer(context);

		// Hook the context events we're interested in.
		this.context.onStarted(() => this.started());
		this.context.onStopped(() => this.stopped());
		this.context.onUserJoined((user: User) => this.userJoined(user));
		this.context.onUserLeft((user: User) => this.userLeft(user));
	}

	/**
	 * Called when a BPInteractionMRE application session starts up.
	 * 
	 * Creates the Haptics Uplink object with rotating text above it.
	 * Clicking on the object prompts the user for the room ID/pairing code.
	 */
	private started() {
		MRE.log.info("app", "Starting up");
		this.assets = new MRE.AssetContainer(this.context);

		// Load a glTF model
		this.uplinker = MRE.Actor.CreateFromGltf(this.assets, {
			// at the given URL
			uri: `${this.baseUrl}/uplink.glb`,
			// and spawn box colliders around the meshes.
			colliderType: 'box',
			// Also apply the following generic actor properties.
			actor: {
				name: 'Uplink Base',
				// Parent the glTF model to the text actor.
				transform: {
					app: {
						position: { x: 0, y: -0.5, z: 0 },
					}
				},
				collider: { geometry: { shape: MRE.ColliderType.Auto } }
			}
		});

		// Set up cursor interaction. We add the input behavior ButtonBehavior to the cube.
		// Button behaviors have two pairs of events: hover start/stop, and click start/stop.
		const buttonBehavior = this.uplinker.setBehavior(MRE.ButtonBehavior);
		buttonBehavior.onClick(async (user: User) => await this.promptForToken(user));

		// Create a new actor with no mesh, but some text.
		const text = MRE.Actor.Create(this.context, {
			actor: {
				name: 'Text',
				parentId: this.uplinker.id,
				transform: {
					local: { position: { x: 0, y: 2, z: 0 } }
				},
				text: {
					contents: "Haptics Uplink",
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					color: { r: 30 / 255, g: 206 / 255, b: 213 / 255 },
					height: 0.3
				}
			}
		});

		// Here we create an animation for our text actor. First we create animation data, which can be used on any
		// actor. We'll reference that actor with the placeholder "text".
		const spinAnimData = this.assets.createAnimationData(
			// The name is a unique identifier for this data. You can use it to find the data in the asset container,
			// but it's merely descriptive in this sample.
			"Spin",
			{
				// Animation data is defined by a list of animation "tracks": a particular property you want to change,
				// and the values you want to change it to.
				tracks: [{
					// This animation targets the rotation of an actor named "text"
					target: MRE.ActorPath("text").transform.local.rotation,
					// And the rotation will be set to spin over 20 seconds
					keyframes: this.generateSpinKeyframes(20, MRE.Vector3.Up()),
					// And it will move smoothly from one frame to the next
					easing: MRE.AnimationEaseCurves.Linear
				}]
			});
		// Once the animation data is created, we can create a real animation from it.
		spinAnimData.bind(
			// We assign our text actor to the actor placeholder "text"
			{ text: text },
			// And set it to play immediately, and bounce back and forth from start to end
			{ isPlaying: true, wrapMode: MRE.AnimationWrapMode.Loop });

	}

	
	/**
	 * Generate keyframe data for a simple spin animation.
	 * Borrows from the Hello World example:
	 * https://github.com/microsoft/mixed-reality-extension-sdk-samples/blob/master/samples/hello-world/src/app.ts
	 * 
	 * @param duration The length of time in seconds it takes to complete a full revolution.
	 * @param axis The axis of rotation in local space.
	 */
	private generateSpinKeyframes(duration: number, axis: MRE.Vector3): Array<MRE.Keyframe<MRE.Quaternion>> {
		return [{
			time: 0 * duration,
			value: MRE.Quaternion.RotationAxis(axis, 0)
		}, {
			time: 0.25 * duration,
			value: MRE.Quaternion.RotationAxis(axis, Math.PI / 2)
		}, {
			time: 0.5 * duration,
			value: MRE.Quaternion.RotationAxis(axis, Math.PI)
		}, {
			time: 0.75 * duration,
			value: MRE.Quaternion.RotationAxis(axis, 3 * Math.PI / 2)
		}, {
			time: 1 * duration,
			value: MRE.Quaternion.RotationAxis(axis, 2 * Math.PI)
		}];
	}

	/**
	 * Called when a BPInteractionMRE application session shuts down.
	 */
	private stopped() {
		MRE.log.info("app", "Last user has left");
	}

	/**
	 * Called when a user connects to the MRe
	 * 
	 * @param user The MRe user
	 */
	private userJoined(user: User) {
		MRE.log.info("app", "User has joined: ", user);
		this.createColliders(user.id);
	}

	private async promptForToken(user: User) {
		const res = await user.prompt("Please enter the haptics token", true);
		if( res.submitted ) {
			MRE.log.info("app", "User has haptics: ", res.text, user.name, user.id);
			if(!this.bridge.has(res.text)) {
				await user.prompt("Invalid token!");
			} else if ( this.bridge.get(res.text).mreContext === null ||
					this.bridge.get(res.text).mreUser === user.id ) {

				const room = this.bridge.get(res.text)
				if(room.mreUser === user.id) {
					return;
				}

				if( this.roomMap.has(user.id) ) {
					this.userLeft(user, true);
				}

				this.userMap.set(res.text, user.id);
				this.roomMap.set(user.id, room);
				room.mreContext = this.context;
				room.mreUser = user.id;
				room.sendStatus();
				this.createBuzzButton(user.id);
			} else {
				await user.prompt("Token is already in use!");
			}
		} else {
			MRE.log.info("app", "User doesn't have haptics", user.name, user.id, res);
		}
	}

	/**
	 * Called when a user disonnects from the MRe
	 * 
	 * @param user The MRe user
	 */
	private userLeft(user: User, justRoom = false) {
		if(!justRoom) {
			MRE.log.info("app", "User has left: ", user);
		}
		if(this.roomMap.has(user.id)) {
			const room = this.roomMap.get(user.id);
			room.mreContext = null;
			room.mreUser = null;
			room.sendStatus();
			this.roomMap.delete(user.id);
			this.userMap.delete(room.id);
		}
	}

	/**
	 * Render a Buzz button
	 * 
	 * Note: This was part of the original PoC code, probably not
	 * required in a world where the events ae reported to the
	 * browser (where the standard embedded or websocket ButtplugClient
	 * can be used directly, without the forwarder layer)
	 * 
	 * The button is only visible for the target user and linked to a
	 * a specific Buttplug connection.
	 * 
	 * The button triggers the buzz() method below.
	 * 
	 * @param user The user's Guid
	 */
	private createBuzzButton(user: Guid) {
		// Create menu button
		const buttonMesh = this.assets.createBoxMesh('button', 0.3, 0.3, 0.01);

		// Create a clickable button.
		const button = MRE.Actor.Create(this.context, {
			actor: {
				parentId: this.uplinker.id,
				exclusiveToUser: user,
				name: "gfg0",
				appearance: { meshId: buttonMesh.id },
				collider: { geometry: { shape: MRE.ColliderType.Auto } },
				transform: {
					local: { position: { x: 0, y: 2.5, z: 0 } }
				}
			}
		});

		// Set a click handler on the button.
		button.setBehavior(MRE.ButtonBehavior)
			.onClick(userId => this.buzz(userId));

		// Create a label for the menu entry.
		MRE.Actor.Create(this.context, {
			actor: {
				parentId: button.id,
				exclusiveToUser: user,
				name: 'label',
				text: {
					contents: "Buzz",
					height: 0.5,
					anchor: MRE.TextAnchorLocation.MiddleLeft
				},
				transform: {
					local: { position: { x: 0.5, y: 0, z: 0 } }
				}
			}
		});
	}
  
	/**
	 * Buzz click handler
	 * 
	 * Runs all user's vibrators for 3 seconds.
	 * 
	 * Note: This uses the Buttplug Fowrdarding infrastructure
	 * because the original PoC assumed that the Buttplug server
	 * would be relayed by another source. This is looking more
	 * and more unnessesary.
	 * 
	 * @param user The user's Guid
	 * @param room The room ID for the Buttplug connection
	 */
	private async buzz(user: User) {
		const room = this.roomMap.get(user.id);
		if(room === null || room === undefined) {
			return;
		}
		if(!room.bpClient?.Connected || false) {
			return;
		}

		for(const dev of room.bpClient.Devices) {
			if (dev.AllowedMessages.includes("VibrateCmd")) {
				await dev.SendVibrateCmd(1.0);
				
				// Now we set a timeout for 3 seconds in the future, to stop the device.
				setTimeout(async () => {
					await dev.SendStopDeviceCmd();
				}, 3000);
			}
		}
	}

	/**
	 * Collision based event generator
	 * 
	 * This method adds colliders to all reasonable mount points on
	 * the user's avatar (realisistically, most of these are unnesseary)
	 * 
	 * The onTrigger() events cause the event to be reported to the
	 * broswer based client, where the data can be used to start/stop
	 * vibrations, etc.
	 */
	private createColliders(user: Guid) {
		// Create collider mesh
		const colliderMesh = this.assets.createSphereMesh('contact', 0.1);

		let map = new Map<MRE.AttachPoint, MRE.Actor>();
		if(this.colliderMap.has(user)) {
			map = this.colliderMap.get(user);
			for(const k of map.keys()) {
				map.get(k).destroy();
				map.delete(k);
			}
		} else {
			this.colliderMap.set(user, map);
		}

		const ap: MRE.AttachPoint[] = ["camera", "head", "neck", "hips", "center-eye",
			"spine-top", "spine-middle", "spine-bottom", "left-eye", "left-upper-leg", 
			"left-lower-leg", "left-foot", "left-toes", "left-shoulder", "left-upper-arm",
			"left-lower-arm", "left-hand", "left-thumb", "left-index", "left-middle",
			"left-ring", "left-pinky", "right-eye", "right-upper-leg", "right-lower-leg",
			"right-foot" , "right-toes" , "right-shoulder" , "right-upper-arm",
			"right-lower-arm", "right-hand", "right-thumb", "right-index",
			"right-middle", "right-ring", "right-pinky"];

		// Create colliders
		for( const x of ap ) {
			const collider = MRE.Actor.Create(this.context, {
				actor: {
					appearance: { meshId: colliderMesh.id },
					collider: {
						geometry: { shape: MRE.ColliderType.Auto },
						isTrigger: true
					},
					transform: {
						local: { position: { x: 0, y: 0, z: 0 } }
					},
					attachment: {
						attachPoint: x,
						userId: user
					}
				}
			});
			map.set(x, collider);
		
			collider.collider.onTrigger("trigger-enter", (data) => {
				if( !isNullOrUndefined(data.attachment)) {
					// collision with other user
					this.roomMap.get(user)?.sendEvent("trigger-enter", x, {
						user: this.context.user(data.attachment.userId)?.name,
						userCollider: data.attachment.attachPoint
					});
				}
			});
			collider.collider.onTrigger("trigger-exit", (data) => {
				if( !isNullOrUndefined(data.attachment)) {
					// un-collision with other user
					this.roomMap.get(user)?.sendEvent("trigger-exit", x, {
						user: this.context.user(data.attachment.userId)?.name,
						userCollider: data.attachment.attachPoint
					});
				}
			});
		}
	}
}
