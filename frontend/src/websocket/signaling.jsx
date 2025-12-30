export const ws = new WebSocket('wss://localhost:8000/ws/signaling/');

ws.onopen = () => console.log('WebSocket connection established');
ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    handleSignalingData(data);
};
ws.onclose = () => console.log('WebSocket connection closed');

export function sendSignal(data) {
    ws.send(JSON.stringify(data));
}