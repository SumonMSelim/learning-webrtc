const port = 8080;
const WebSocket = require('ws');
const fs = require('fs');
const https = require('https');

const privateKey = fs.readFileSync('keys/key.pem', 'utf8');
const certificate = fs.readFileSync('keys/cert.pem', 'utf8');

const credentials = {key: privateKey, cert: certificate};
const express = require('express');

const app = express();
const httpsServer = https.createServer(credentials, app);
httpsServer.listen(port);

const wss = new WebSocket.Server({
    server: httpsServer
});

let users = [];

wss.on('connection', (connection) => {
    connection.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log(`Error parsing JSON: ${e.message}`);
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
                console.log(`Hangup: ${JSON.stringify(data)}`);
                break;

            default:
                console.log(`I don't know how you got here: ${JSON.stringify(data)}`);
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
