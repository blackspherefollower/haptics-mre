# Modifications to the MRe SDK

The MRe SDK is awesome in that it's totally self contained and pretty trivial for getting in-world stuff working fast: you don't have to worry about any of the boilerplate and can get straight into doing cool stuff in VR.

But it has one serious limitation: it assumes that the app is 100% going to be in VR.

WebHost and MultiPeerAdapter consume all HTTP and WS endpoints with no support for additional non-MRe data channels.

Since this project bridges the VR world and the real-world we need a way to add additional communications channels to the app to provide the real-world half of the connection. It makes sense for this to be in the form of additional WebSockets accessible from a web-app served as a set of static assets.

The bulk of the modifications required to support additional WebSockets is in MultiPeerAdapterEX; a copy of MultiPeerAdapter with the following changes:

* A new `handlePath()` method that registers URL patterns against handler callbacks.
* The WebSocket `verifyClient` method has been overridden to allow WebSocket connections from non-MRe clients to pass through so long as the request wasn't for the MRe's root path.
* The WebSocket's on-connection handler now looks up the requested path and if it matches one of the registered paths calls the appropriate callback rather than the MRe handler.

The default WebHost implementation is hard-coded to use MultiPeerAdapter, so WebHostEx was required to use MultiPeerAdapterEx instead.