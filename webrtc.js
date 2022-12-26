import {
  WebRTC,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'https://lsong.org/scripts/webrtc.js';
import { getUserMedia } from 'https://lsong.org/scripts/media.js';
import { SuperWebSocket } from 'https://lsong.org/scripts/websocket.js';

var localVideo, remoteVideo;
var localVideoStream = null;
var videoCallButton = null, answerButton = null, endCallButton = null;

const rtc = new WebRTC();
const wsc = new SuperWebSocket(`ws://${location.host}`);

var peerConn = rtc.getPeerConnection();

wsc.addListener("message", function (evt) {
  const signal = JSON.parse(evt.data);
  if (signal.sdp) {
    answerButton.removeAttribute("disabled");
    console.log("Received SDP from remote peer.", signal.sdp);
    peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
  } else if (signal.candidate) {
    console.log("Received ICECandidate from remote peer.", signal.candidate);
    peerConn.addIceCandidate(new RTCIceCandidate(signal.candidate));
  } else if (signal.closeConnection) {
    console.log("Received 'close call' signal from remote peer.");
    endCall();
  }
})

function prepareCall() {
  // send any ice candidates to the other peer
  peerConn.addEventListener("icecandidate", onIceCandidateHandler);
  peerConn.addEventListener("track", onAddStreamHandler);
  peerConn.addEventListener("datachannel", e => {
    console.log("onDatachannel");
  });
  // once remote stream arrives, show it in the remote video element
  peerConn.addEventListener("iceconnectionstatechange", () => {
    console.log("ice state:", peerConn.iceConnectionState);
  });
  peerConn.addEventListener("signalingstatechange", () => {
    console.log("signaling state:", peerConn.iceConnectionState);
  });

  setInterval(async () => {
    const stats = await peerConn.getStats()
    let statsOutput = "";
    for (const [, report] of stats) {
      // console.log("report", report);
      statsOutput += `<b>Report: ${report.type}</b>`;
      Object.keys(report).forEach((statName) => {
        statsOutput += `<div>${statName}: ${report[statName]}</div>`;
      })
    }
    document.querySelector("#stats-box").innerHTML = statsOutput;
  }, 1000);

};

function onIceCandidateHandler(evt) {
  console.log('onIceCandidateHandler', evt);
  if (!evt || !evt.candidate) return;
  wsc.send({ "candidate": evt.candidate });
};

function onAddStreamHandler(e) {
  videoCallButton.setAttribute("disabled", true);
  endCallButton.removeAttribute("disabled");
  // set remote video stream as source for remote video HTML5 element
  console.log("onAddStreamHandler", e.streams);
  remoteVideo.srcObject = e.streams[0];
};

const openCameraAndAddStream = async () => {
  // get the local stream, show it in the local video element and send it
  const stream = await getUserMedia({ "audio": true, "video": true });
  localVideo.srcObject = localVideoStream = stream;
  // peerConn.addStream(localVideoStream);
  for (const track of localVideoStream.getTracks()) {
    peerConn.addTrack(track, localVideoStream)
  }
};

// run start(true) to initiate a call
async function initiateCall() {
  console.log("initiateCall");
  await openCameraAndAddStream();
  createAndSendOffer();
};

async function answerCall() {
  console.log("answerCall");
  await openCameraAndAddStream();
  createAndSendAnswer();
};

async function createAndSendOffer() {
  const offer = await peerConn.createOffer();
  await peerConn.setLocalDescription(offer);
  console.log("createOffer", offer);
  wsc.send({ "sdp": offer });
};

async function createAndSendAnswer() {
  const answer = await peerConn.createAnswer();
  await peerConn.setLocalDescription(answer);
  console.log("createAnswer", answer);
  wsc.send({ "sdp": answer });
  answerButton.setAttribute('disabled', 'disabled');
};

function endCall() {
  console.log("endCall");

  for (const video of document.getElementsByTagName("video")) {
    video.pause();
  }
  remoteVideo.pause();
  for (const track of localVideoStream.getTracks()) {
    track.stop();
  }
  peerConn.close();
  videoCallButton.removeAttribute("disabled");
  endCallButton.setAttribute("disabled", true);
};

document.addEventListener("DOMContentLoaded", () => {
  videoCallButton = document.getElementById("call");
  answerButton = document.getElementById("answer");
  endCallButton = document.getElementById("end");
  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');

  videoCallButton.removeAttribute("disabled");
  videoCallButton.addEventListener("click", initiateCall);
  answerButton.addEventListener("click", answerCall);

  endCallButton.addEventListener("click", () => {
    wsc.send({ "closeConnection": true });
    endCall();
  });

  prepareCall();
}, false);