import { ButtplugServerForwardedConnector, FromJSON,
	ButtplugMessage } from "buttplug";
import * as WS from 'ws';
import { EventEmitter } from "events";
import { log } from "@microsoft/mixed-reality-extension-sdk";
import { StatusEmitter } from "./StatusEmitter";
 
/**
 * ButtplugServerForwardedNodeWebsocketConnector
 *
 * ButtplugServerForwardedConnectors are what the ForwardedDeviceManager
 * uses to receive proxied devices. For this specific example, it will
 * listen on a websocket (already initialed by a webserver), since that
 * works well with browsers.
 */
export class ButtplugServerForwardedNodeWebsocketConnector extends 
	EventEmitter implements ButtplugServerForwardedConnector {
	
	private forwarderConnected = true;

	public constructor(private wsClient: WS, private statusEmitter: StatusEmitter) {
		super();
	}

	// We'll never want this to disconnect on the connector end. It should stay
	// connected for the lifetime of the browser's session.
	public Disconnect = (): Promise<void> => {
		return Promise.resolve();
	}

	// Send a message to the browser.
	public SendMessage = (msg: ButtplugMessage): Promise<void> => {
		this.wsClient.send("[" + msg.toJSON() + "]");
		return Promise.resolve();
	}

	// The name here is a bit misleading, as since we're using an existing WebSoxocket, the
	// listener is set up earlier. However, since this is expected to a server,
	// we have to fill this in anyways, so we use this as a chance to set up the
	// websocket client we've received.
	public Listen = (): Promise<void> => {		
		// If the websocket errors out for some reason, just terminate connection.
		this.wsClient.on("error", (err: any) => {
			log.error("app", `Error in websocket connection: ${err.message}`);
			this.forwarderConnected = false;
			this.statusEmitter.emitLocalDisconnect();
			this.wsClient.terminate();
			this.wsClient.removeAllListeners();
			this.emit("disconnect");
		});

		// If the websocket closes, we want to update our status so another client
		// can connect (or the same one can reconnect), then let the rest of the
		// system know that the client disconnected, so we can do things like
		// flag the event to the user in VR.
		this.wsClient.on("close", () => {
			log.info("app", "Local side disconnected");
			this.forwarderConnected = false;
			this.statusEmitter.emitLocalDisconnect();
			this.wsClient.removeAllListeners();
			this.emit("disconnect");
		});

		// If we get a message, a couple of things can happen, so just keep
		// reading the internal comments.
		this.wsClient.on("message", (message: any) => {
			const msg = FromJSON(message);
			for (const m of msg) {
				log.debug("app", m);
				this.emit("message", m);
			}
		});
		// This function can sometimes be async. Now is not one of those times.
		return Promise.resolve();
	}
}
