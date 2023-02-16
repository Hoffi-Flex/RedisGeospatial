const { parentPort } = require("worker_threads");
const { faker } = require("@faker-js/faker");
const { Redis } = require("ioredis");
const redis = new Redis();
//parentPort.postMessage(process.env.RESCUE_COUNT);
let rescues = [];

async function initialRescueService() {
    parentPort.postMessage(`Started initial generation of ${process.env.RESCUE_COUNT} rescue services.`)
    await redis.del("rescueservice");
    for (let i = 0; i < process.env.RESCUE_COUNT; i++) {
        const name = `Rescue Service ${i}`;
        rescues.push(name);
        const lat = faker.address.latitude(54.9079, 47.40724, 4);
        const long = faker.address.longitude(14.98853, 5.98815, 4);
        await redis.geoadd("rescueservice", long, lat, name);
    }
    parentPort.postMessage(`All initial ${process.env.RESCUE_COUNT} rescue services were successfully added.`);
}

async function startWorker() {
    let active = true;
    parentPort.postMessage(`Position simulatior started. With ${rescues.length/12000}`);
    
  while (active) {
    //active = false;
    const randomIndex = Math.floor(Math.random() * rescues.length);
    const randomRescue = rescues[randomIndex];
    const position = await redis.geopos("rescueservice", randomRescue);
    const newPos = faker.address.nearbyGPSCoordinate([Number(position[0][1]), Number(position[0][0])], 0.01, true);
    await redis.geoadd("rescueservice", newPos[1], newPos[0], randomRescue);
  }
}

async function main() {
  await initialRescueService();
  await startWorker();
}

main();