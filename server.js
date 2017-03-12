const port = 8080;
const WebSocket = require('ws');

const wss = new WebSocket.Server({
    port: port
});

let users = [];

wss.on('connection', (connection) => {
    connection.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log(" Error parsing JSON");
            data = {};
        }

        switch (data.type) {
            case 'login':
                users.push(data.name);

                let message = {
                    type: 'login',
                    payload: {
                        users: users
                    }
                };
                connection.send(JSON.stringify(message));
                broadcastToClients(connection, message);
                console.log(`Login: ${JSON.stringify(message)}`);
                break;

            case 'offer':
                broadcastToClients(connection, data);
                console.log(`Offer: ${JSON.stringify(data)}`);
                break;

            case 'answer':
                broadcastToClients(connection, data);
                console.log(`Answer: ${JSON.stringify(data)}`);
                break;

            case 'candidate':
                broadcastToClients(connection, data);
                console.log(`Candidate: ${JSON.stringify(data)}`);
                break;

            case 'hangup':
                broadcastToClients(connection, data);
                users = [];
                break;
        }
    });
});

wss.on('listening', function () {
    console.log(`Server started....\nListening on port: ${port}`);
});

function broadcastToClients(connection, message) {
    wss.clients.forEach((client) => {
        if (client !== connection && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}
