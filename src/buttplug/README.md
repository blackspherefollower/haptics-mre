# Buttplug Forwarder Classes

These classes are brorrowed with some minor modification from qdot's [simple-teledildonics-app](https://github.com/qdot/simple-teledildonics-app/blob/master/src/server.ts).

We don't require the authentication piece that the teledildonics app does: we're only really doing one way communication here.

Not everything here is required right now, but will likley be as the project matures (the StatusEmmiter and connection flags for example).

Alternativly, and more likely, the browser based front-end will recieve events from the AltSpace MRe, interpret those events and drive the ButtplugClient directly from the in-broswer web-app. That simplifies the project by removing the extra data channel.