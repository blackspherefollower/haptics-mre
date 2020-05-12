import { EventEmitter } from "events";
import { log } from "@microsoft/mixed-reality-extension-sdk";

export class StatusEmitter extends EventEmitter {
	public emitLocalDisconnect() {
		this.emit("local_disconnect");
	}

	public emitRemoteConnect() {
		log.info("app", "Remote connected");
		this.emit("remote_connect");
	}

	public emitRemoteDisconnect() {
		this.emit("remote_disconnect");
	}
}
