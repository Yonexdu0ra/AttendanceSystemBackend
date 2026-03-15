import { createClient } from "redis";

const redisConfig = {
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
};

<<<<<<< HEAD
export const redisPub = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

export const redisSub = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});
=======
export const client = createClient(redisConfig);
export const redisPub = createClient(redisConfig);
export const redisSub = createClient(redisConfig);
>>>>>>> 4ba92b8c5fe7cfd5fd02316943380781dacddd04

client.on('error', err => console.log('Redis Client Error', err));
redisPub.on('error', err => console.log('Redis Pub Error', err));
redisSub.on('error', err => console.log('Redis Sub Error', err));

const connectRedis = async () => {
    try {
<<<<<<< HEAD
        await client.connect();
        await redisPub.connect();
        await redisSub.connect();
=======
        await Promise.all([
            client.connect(),
            redisPub.connect(),
            redisSub.connect(),
        ]);
>>>>>>> 4ba92b8c5fe7cfd5fd02316943380781dacddd04
        console.log('connect to redis success !');
    } catch (error) {
        console.log('connect to redis failed !', error.message);
    }

}

connectRedis();



