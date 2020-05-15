import { ButtplugServer } from "buttplug";
import * as WS from 'ws';
import { SessionMap } from "../mre-ex/MultiPeerAdapterEx";

/**
 * Room - This is the control channel linking the web UI and MRe
 * 
 * Probably needs a better name, but right now all it does is allocate
 * an endpoint for a Buttplug connection. The same idenfifier is used
 * by the user in AltSpaceVR to identify themselves to the MRe and
 * link their real world and VR contexts.
 * 
 * This connection could easily be extended to provide functionality
 * like enabling/disabling interaction with other users, mapping of
 * devices (and maybe indivdual features) with particular colliders
 * registered on the VR side, etc.
 */
export class Room {
	// We have to keep the WebSocket alive on cheap PaaS providers
	private timeout: NodeJS.Timeout = null;

	// The random room ID
	private ran = "";

	/**
	 * Constructs a new Room
	 * 
	 * This allocates a new room ID and reports it to the client.
	 * 
	 * @param sessions The VR session map
	 * @param bridge The Buttplug connection map
	 * @param ws The new WebSocket
	 */
	constructor(private sessions: SessionMap, private bridge: Map<string, ButtplugServer>, private ws: WS) {
		// Generate a new unique room ID
		do {
			this.ran = Math.random().toString(36).replace(/[^a-z0-9]+/ug, '').substr(0, 6);
		} while (this.bridge.has(this.ran));

		// Add the room to the Buttplug connection map
		this.bridge.set(this.ran, null);

		// We need to make sure the websock is seen as active,
		// or PaaS services will kill the connection
		ws.on('close', () => this.close());
		this.timeout = setInterval(() => this.ws.ping(), 10000);

		// Report the room ID to the client
		this.ws.send(JSON.stringify({room: this.ran}));
	}

	/**
	 * If the WebSocket closes, stop trying to keep it alive
	 */
	private close() {
		this.bridge.delete(this.ran);
		clearInterval(this.timeout);
	}
}
