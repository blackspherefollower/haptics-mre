import { ButtplugServer, ButtplugClient } from "buttplug";
import * as WS from 'ws';
import { SessionMap } from "../mre-ex/MultiPeerAdapterEx";
import { Context, Guid } from "@microsoft/mixed-reality-extension-sdk";

/**
 * Room - This is the control channel linking the web UI and MRe
 * 
 * Probably needs a better name, but right now it allocates an endpoint
 * for a Buttplug connection and acts as a holder object for that
 * connection. It also holds an MRe context reference for easy association
 * The idenfifier is used as part of the URL the Buttplug forwarder
 * connects to and by the user in AltSpaceVR to identify themselves to
 * the MRe and link their real world and VR contexts.
 * 
 * This connection provides both the room ID to the browser and status
 * information regarding whther the MRe considers the Buttplug and VR
 * connections to be active.
 * 
 * This could be further extended to offer features like enabling/disabling
 * interaction with other users, mapping of devices (and maybe indivdual
 * device features) with particular colliders registered on the VR side, etc.
 */
export class Room {
	// The random room ID
	public id = "";

	// The MRe Context
	public mreContext: Context = null;

	// The User ID for the user who connected the Context to the Room
	public mreUser: Guid = null;

	// The Buttplug Server object (contains the forwarded connection to the broswer)
	public bpServer: ButtplugServer = null;

	// The Buttplug Client object (connected in-process to bpServer)
	public bpClient: ButtplugClient = null;

	// We have to keep the WebSocket alive on cheap PaaS providers
	private timeout: NodeJS.Timeout = null;

	/**
	 * Constructs a new Room
	 * 
	 * This allocates a new room ID and reports it to the client.
	 * 
	 * @param sessions The VR session map
	 * @param bridge The Buttplug connection map
	 * @param ws The new WebSocket
	 */
	constructor(private sessions: SessionMap, private bridge: Map<string, Room>, private ws: WS) {
		// Generate a new unique room ID
		do {
			this.id = Math.random().toString(36).replace(/[^a-z0-9]+/ug, '').substr(0, 6);
		} while (this.bridge.has(this.id));

		// Add the room to the Buttplug connection map
		this.bridge.set(this.id, this);

		// We need to make sure the websock is seen as active,
		// or PaaS services will kill the connection
		ws.on('close', () => this.close());
		this.timeout = setInterval(() => this.ws.ping(), 10000);

		// Report the room ID to the client
		this.sendStatus();
	}

	/**
	 * If the WebSocket closes, stop trying to keep it alive
	 */
	private async close() {
		if(this.bpClient?.Connected || false) {
			await this.bpClient.Disconnect();
		}

		this.bridge.delete(this.id);
		clearInterval(this.timeout);
	}

	/**
	 * Helper method for sending room info to the browser
	 */
	public sendStatus(): void {
		this.ws.send(JSON.stringify({
			room: this.id,
			bpConnected: this.bpClient?.Connected || false,
			mreConnected: this.mreContext !== null
		}));
	}


}
