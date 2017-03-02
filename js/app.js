const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

callButton.disabled = true;
hangupButton.disabled = true;

// start media button
startButton.addEventListener('click', function () {
    getMediaAccess();

    startButton.disabled = true;
    callButton.disabled = false;
    hangupButton.disabled = true;
});

// call button
callButton.addEventListener('click', function () {
    startCall(window.localStream);

    startButton.disabled = true;
    callButton.disabled = true;
    hangupButton.disabled = false;
});

// hangup button
hangupButton.addEventListener('click', function () {
    if (window.localStream.active) {
        window.localStream.stop();
        window.remoteStream.stop();
    }

    startButton.disabled = false;
    callButton.disabled = true;
    hangupButton.disabled = true;
});

function getMediaAccess() {
    const constraints = {
        audio: true,
        video: true
    };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        window.localStream = stream;
        localVideo.src = URL.createObjectURL(stream);

        window.localStream.stop = function () {
            this.getTracks().map(function (track) {
                track.stop();
            });
            localVideo.src = '';
        };
    }).catch((err) => {
        console.log(`getMediaAccess: ${err}`);
    });
}

function startCall(stream) {
    const configuration = {
        'iceServers': [{
            'url': 'stun:stun3.l.google.com:19302'
        }]
    };

    /** create PeerConnection object */
    const localConnection = new RTCPeerConnection(configuration);
    const remoteConnection = new RTCPeerConnection(configuration);

    /** Setup stream listening */
    localConnection.addStream(stream);
    remoteConnection.onaddstream = function (event) {
        window.remoteStream = stream;
        remoteVideo.src = window.URL.createObjectURL(event.stream);

        window.remoteStream.stop = function () {
            this.getTracks().map(function (track) {
                track.stop();
            });
            remoteVideo.src = '';
        };
    };

    /** setup ICE handling */
    localConnection.onicecandidate = function (event) {
        /** if candidate found */
        if (event.candidate) {
            console.log(`Local Connection ICE: ${JSON.stringify(event.candidate)}`);
            remoteConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
        }
    };

    remoteConnection.onicecandidate = function (event) {
        /** if candidate found */
        if (event.candidate) {
            console.log(`Remote Connection ICE: ${JSON.stringify(event.candidate)}`);
            localConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
        }
    };

    /** start offer */
    localConnection.createOffer().then(sdp => {
        console.log(`Local Connection SDP: ${JSON.stringify(sdp)}`);
        localConnection.setLocalDescription(sdp);
        remoteConnection.setRemoteDescription(sdp);

        /** remote response */
        remoteConnection.createAnswer().then(sdp => {
            console.log(`Remote Connection SDP: ${JSON.stringify(sdp)}`);
            remoteConnection.setLocalDescription(sdp);
            localConnection.setRemoteDescription(sdp);
        });
    });
}

