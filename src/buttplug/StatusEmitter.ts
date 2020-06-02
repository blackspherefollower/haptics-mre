import { EventEmitter } from "events";
import { log } from "@microsoft/mixed-reality-extension-sdk";

export class StatusEmitter extends EventEmitter {
	public emitLocalDisconnect(): void {
		this.emit("local_disconnect");
	}

	public emitRemoteConnect(): void {
		log.info("app", "Remote connected");
		this.emit("remote_connect");
	}

	public emitRemoteDisconnect(): void {
		this.emit("remote_disconnect");
	}
}
