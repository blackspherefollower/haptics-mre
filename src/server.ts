import { WebHost2 } from './WebHost2';
import dotenv from 'dotenv';
import { resolve as resolvePath } from 'path';
import App from './app';
import * as Restify from 'restify';
import { NotFoundError } from 'restify-errors';

/* eslint-disable no-console */
process.on('uncaughtException', err => console.log('uncaughtException', err));
process.on('unhandledRejection', reason => console.log('unhandledRejection', reason));
/* eslint-enable no-console */

// Read .env if file exists
dotenv.config();

// Start listening for connections, and serve static files
const server = new WebHost2({
	// baseUrl: 'http://<ngrok-id>.ngrok.io',
	baseDir: resolvePath(__dirname, '../public')
});

// Handle new application sessions
server.adapter.onConnection(context => new App(context, server.baseUrl));
server.adapter.server.get("/index", (req: Restify.Request, res: Restify.Response, next: Restify.Next) => {
	res.send("Woop");
	next();
});
