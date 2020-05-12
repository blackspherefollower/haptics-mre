import { ButtplugServer } from "buttplug";
import * as WS from 'ws';
import { SessionMap } from "../mre-ex/MultiPeerAdapterEx";

export class Room {
	private timeout: NodeJS.Timeout = null;
	private ran = "";

	constructor(private sessions: SessionMap, private bridge: Map<string, ButtplugServer>, private ws: WS) {
		do {
			this.ran = Math.random().toString(36).replace(/[^a-z0-9]+/ug, '').substr(0, 6);
		} while (this.bridge.has(this.ran));
		this.bridge.set(this.ran, null);
		ws.on('close', () => this.close());

		// We need to make sure the websock is seen as active,
		// or PaaS services will kill the connection
		this.timeout = setInterval(() => this.ws.ping(), 10000);

		this.ws.send(JSON.stringify({room: this.ran}));
	}

	private close() {
		this.bridge.delete(this.ran);
		clearInterval(this.timeout);
	}
}
