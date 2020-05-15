import { ButtplugServer } from "buttplug";
import * as WS from 'ws';
import { SessionMap } from "../mre-ex/MultiPeerAdapterEx";

/**
 * Status - A debugging data channel
 * 
 * This probably exposes way too much data for production use,
 * but right now it's handy for working out what's going on.
 */
export class Status {

	/**
	 * Constructs a new status channel
	 * 
	 * @param sessions The VR session map
	 * @param bridge The Buttplug connection map
	 * @param ws The new WebSocket
	 */
	constructor(private sessions: SessionMap, private bridge: Map<string, ButtplugServer>, private ws: WS) {
		ws.on('message', () => this.sendStatus());
	}

	/**
	 * Handle a request for the current status of the system
	 * 
	 * Reports:
	 * * sessions: AltSpaceVR instances + users connected to those sessions
	 * * rooms: Browser connections + whether they have active Buttplug connections
	 */
	private sendStatus() {
		const rooms: any = {};
		const bpconns: any = {};
		
		for (const room of Object.keys(this.sessions)) {
			const users: any = {};
			this.sessions[room].context.users.forEach(v => { users[v.id.toString()] = v.name; });
			rooms[room] = users;
		}
		
		for (const conn of Array.from(this.bridge.keys())) {
			bpconns[conn] = this.bridge.get(conn) !== null;
		}

		this.ws.send(JSON.stringify({sessions: rooms, rooms: bpconns}));
	}
}
