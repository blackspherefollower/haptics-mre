import { StatusEmitter } from "../buttplug/StatusEmitter";
import {
	ButtplugServerForwardedNodeWebsocketConnector
} from "../buttplug/ButtplugServerForwardedNodeWebsocketConnector";
import { ButtplugForwardedNodeWebsocketServer } from "../buttplug/ButtplugForwardedNodeWebsocketServer";
import { ForwardedDeviceManager, ButtplugServer } from "buttplug";
import * as WS from 'ws';
import { log } from '@microsoft/mixed-reality-extension-sdk';

/**
 * ButtplugBridge - Maps a new Buttplug over WebSocket connection to a "room"
 */ 
export class ButtplugBridge {
	//We have to keep the WebSocket alive on cheap PaaS providers
	private timeout: NodeJS.Timeout = null;

	/**
	 * Constructs a new ButtplugBridge
	 * 
	 * Ensures the room exists and isn't already in use.
	 * Sets up a ping on the WebSocket for keep-alive.
	 * Wraps up the WebSocket a ButtplugServer class: at this point,
	 * creating a ButtplugClient and sending device commands will look
	 * identical to if the ButtplugServer was conected directly to the
	 * hardware.
	 * 
	 * @param bridge The mapping between room IDs and Buttplug connections
	 * @param ws The new WebSocket connection
	 * @param room The room ID passed by URL path
	 */
	constructor(private bridge: Map<string, ButtplugServer>, private ws: WS, private room: string) {

		// Validate that the room ID is valid and exists in the room map
		if(room === undefined || room === null) {
			ws.close();
			return;
		}

		log.info("app", "Connection to room " + room + " requested");
		if(!bridge.has(room)) {
			ws.close();
			log.info("app", "No such room " + room);
			return;
		}

		// Make sure the room isn't already in use
		if (bridge.get(room) !== null) {
			log.info("app", "Connection is already active on room " + room);
			ws.close();
			return;
		}

		// Keep the WebSocket alive
		ws.on('close', () => this.close());
		this.timeout = setInterval(() => this.ws.ping(), 10000);
	
		// The satusEmmitter will act as a signaller for events on either
		// side of the Buttplug connection. We don't actaully use it right now.
		const statusEmmitter = new StatusEmitter();

		// Set up the Buttplug connection forwarder and Buttplug Server.
		// First, we have to create a forwarder connector, which uses a
		// websocket to listen for forwarder commands (AddDevice, RemoveDevice),
		// and sends device commands sent to the new Buttplug Server back
		// back to the browser's Buttplug connection forwardering client.
		// This connector class is defined in it's own file in../buttplug/,
		// so in-depth explanation will happen there.
		const connector = new ButtplugServerForwardedNodeWebsocketConnector(ws, statusEmmitter);
		log.info("app","Starting forwarder listener...");
		connector.Listen();
	
		// Now we set up the Buttplug Server that will host forwarded devices.
		// This server class class is defined in it's own file in../buttplug/,
		// so in-depth explanation will happen there.
		const bps = new ButtplugForwardedNodeWebsocketServer("Remote Server", statusEmmitter);

		// Forwarded devices use a "device communication manager", which is another
		// common structure in Buttplug. Device communication managers handle a
		// certain class of devices: bluetooth devices, USB devices, etc... The
		// forwarded device manager doesn't manage actual hardware, but instead
		// manages proxies to devices running in other buttplug instances.
		const fdm = new ForwardedDeviceManager(undefined, connector);
		bps.AddDeviceManager(fdm);
		log.info("app", "Starting server...");

		// Add the Buttplug connection to the room mapping
		bridge.set(room, bps);
	}

	/**
	 * If the WebSocket closes, stop trying to keep it alive
	 */
	private close() {
		clearInterval(this.timeout);
	}
}
