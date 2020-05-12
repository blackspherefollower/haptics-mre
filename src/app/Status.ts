import { ButtplugServer } from "buttplug";
import * as WS from 'ws';
import { SessionMap } from "../mre-ex/MultiPeerAdapterEx";

export class Status {

	constructor(private sessions: SessionMap, private bridge: Map<string, ButtplugServer>, private ws: WS) {
		ws.on('message', () => this.sendStatus());
	}

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
