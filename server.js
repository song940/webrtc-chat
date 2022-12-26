import { createServer } from 'http';
import ws from 'ws';
import kelp from 'kelp';
import serve from 'kelp-static';

const app = kelp();

app.use(serve('.'));

const server = createServer(app);

// create the WebSocket server
const wss = new ws.Server({ server });

/** successful connection */
wss.on('connection', function (client) {
  console.log("A new WebSocket client was connected.");
  /** incomming message */
  client.on('message', function (message) {
    /** broadcast message to all clients */
    wss.broadcast(message, client);
  });
});
// broadcasting the message to all WebSocket clients.
wss.broadcast = function (data, exclude) {
  var i = 0, n = this.clients ? this.clients.length : 0, client = null;
  if (n < 1) return;
  console.log("Broadcasting message to all " + n + " WebSocket clients.");
  for (; i < n; i++) {
    client = this.clients[i];
    // don't send the message to the sender...
    if (client === exclude) continue;
    if (client.readyState === client.OPEN) client.send(data);
    else console.error('Error: the client state is ' + client.readyState);
  }
};

server.listen(3000, () => {
  console.log("server is running at http://localhost:3000");
});