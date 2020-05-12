import { StatusEmitter } from "../buttplug/StatusEmitter";
import {
	ButtplugServerForwardedNodeWebsocketConnector
} from "../buttplug/ButtplugServerForwardedNodeWebsocketConnector";
import { ButtplugForwardedNodeWebsocketServer } from "../buttplug/ButtplugForwardedNodeWebsocketServer";
import { ForwardedDeviceManager, ButtplugServer } from "buttplug";
import * as WS from 'ws';
import { log } from '@microsoft/mixed-reality-extension-sdk';

export class ButtplugBridge {
	private timeout: NodeJS.Timeout = null;

	constructor(private bridge: Map<string, ButtplugServer>, private ws: WS, private room: string) {
		if(room === undefined || room === null) {
			ws.close();
			return;
		}

		ws.on('close', () => this.close());

		log.info("app", "Connection to room " + room + " requested");
		if(!bridge.has(room)) {
			ws.close();
			log.info("app", "No such room " + room);
			return;
		}

		if (bridge.get(room) !== null) {
			log.info("app", "Connection is already active on room " + room);
			ws.close();
			return;
		}

		this.timeout = setInterval(() => this.ws.ping(), 10000);
	
		const statusEmmitter = new StatusEmitter();

		// Set up the forwarder and server. First, we have to create a forwarder
		// connector, which uses a websocket to listen for forwarder commands
		// (AddDevice, RemoveDevice), and sends device commands from the controller
		// back to the client that is connected to the forwarder. This connector
		// class is defined below, so in-depth explanation will happen there.
		const connector = new ButtplugServerForwardedNodeWebsocketConnector(ws, statusEmmitter);
		log.info("app","Starting forwarder listener...");
		connector.Listen();
	
		// Now we set up the server that will host forwarded devices.
		const bps = new ButtplugForwardedNodeWebsocketServer("Remote Server", statusEmmitter);

		// Forwarded devices use a "device communication manager", which is another
		// common structure in Buttplug. Device communication managers handle a
		// certain class of devices: bluetooth devices, USB devices, etc... The
		// forwarded device manager doesn't manage actual hardware, but instead
		// manages proxies to devices running in other buttplug instances.
		const fdm = new ForwardedDeviceManager(undefined, connector);
		bps.AddDeviceManager(fdm);
		log.info("app", "Starting server...");

		bridge.set(room, bps);
	}

	private close() {
		clearInterval(this.timeout);
	}
}
