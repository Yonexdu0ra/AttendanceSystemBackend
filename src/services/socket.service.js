import { redisPub } from "../configs/redisClient.js";

/**
 * Publish a websocket event via Redis
 * @param {string} channel - The redis channel pattern (e.g. "attendance:update", "notification:new")
 * @param {string} event - The socket.io event name to emit
 * @param {any} data - The payload to send
 * @param {string|null} room - (Optional) The specific room to emit to (e.g. userId, jobId)
 */
export const publishSocketEvent = async (channel, event, data, room = null) => {
    try {
        const message = JSON.stringify({
            room,
            event,
            data
        });
        await redisPub.publish(channel, message);
    } catch (error) {
        console.error(`Error publishing socket event to channel ${channel}:`, error);
        throw error;
    }
};
