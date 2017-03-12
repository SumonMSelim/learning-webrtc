const WebSocket = require('ws');

const wss = new WebSocket.Server({
    perMessageDeflate: false,
    port: 8080
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
        console.log(`Event: ${data.type}`);
        console.log(`Event Data: ${JSON.stringify(data.payload)}`);

        switch (data.type) {
            case 'login':
                console.log(`User logged in: ${data.payload.name}`);
                users.push(data.payload.name);

                let message = {
                    type: 'login',
                    payload: {
                        users: users
                    }
                };
                connection.send(JSON.stringify(message));
                broadcastToClients(connection, message);
                break;
            case "send_offer":
                broadcastToClients(connection, data);
                break;

            case "end_call":
                sendTo(connection, data);
                break;
        }
    });
});

function broadcastToClients(connection, message) {
    wss.clients.forEach((client) => {
        if (client !== connection && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

