import { createClient } from "redis";

const redisConfig = {
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    }
};

export const client = createClient(redisConfig);
export const redisPub = client.duplicate();
export const redisSub = client.duplicate();


client.on('error', err => console.log('Redis Client Error', err));
redisPub.on('error', err => console.log('Redis Pub Error', err));
redisSub.on('error', err => console.log('Redis Sub Error', err));

const connectRedis = async () => {
    try {

        await Promise.all([
            client.connect(),
            redisPub.connect(),
            redisSub.connect()
        ]);
        console.log('connect to redis success !');
    } catch (error) {
        console.log('connect to redis failed !', error.message);
    }

}

connectRedis();



